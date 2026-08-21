import "dotenv/config";
import { PrismaService } from '@core/infra/prisma/prisma.service';
import { HttpService } from '@nestjs/axios';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  Lead,
  Prisma,
  Tenant,
  TenantOutreachConfig,
  TenantSendPolicy,
  WhatsappConversationDirection,
  WhatsappMessageTemplate,
} from '@prisma/client';
import {
  resolveBindingValue,
  SlotBinding,
} from '@core/shared/whatsapp-template-bindings';
import { TemplateSlot } from '@core/shared/whatsapp-template-slots';
import { buildTemplateSendBody } from '@core/shared/whatsapp-template-payload';
import {
  asIntArray,
  cityIdFilter,
  mergeExcludedPhones,
} from '@core/shared/send-policy';
import { Message } from './interfaces';
import { PlatformWhatsappService } from './platform-whatsapp.service';
import { WhatsAppSendMessageResponse } from './WhatsAppSendMessageResponse';
import {
  isDedicatedBoundToTenant,
  upsertConversationThenMessage,
} from './conversation-thread';
import { normalizeListPhone } from '@core/shared/list-campaign-helpers';
import {
  affordableFromAvailable,
  cityUsedPhonesWhere,
  computeAvailableBalance,
  loadCrossChannelPending,
} from './coin-reservation';
import {
  buildCategoryAverages,
  computeY,
  excludeUsedPhones,
  isPremium,
  selectStratifiedBatch,
  uniqueByPhone,
} from './premium-mix';

type OutreachConfigWithTemplates = TenantOutreachConfig & {
  outreachTemplate: WhatsappMessageTemplate | null;
  notifyTemplate: WhatsappMessageTemplate | null;
};

type TenantWithOutreach = Tenant & {
  outreachConfig: OutreachConfigWithTemplates;
  sendPolicy?: TenantSendPolicy | null;
};

type LeadWithCity = Lead & { city?: { name: string } | null };

const OUTREACH_INCLUDE = {
  outreachTemplate: true,
  notifyTemplate: true,
} as const;

@Injectable()
export class LeadsService implements OnModuleInit {
  logger = new Logger(LeadsService.name);
  constructor(
    private prisma: PrismaService,
    private httpService: HttpService,
    private platformWhatsapp: PlatformWhatsappService,
  ) { }

  onModuleInit() {
    this.logger.log('[onModuleInit] LeadsService initialized');
    // this.handleCron();
    const tokenPresent = Boolean(process.env.WHATSAPP_TOKEN);
    this.logger.log(`[onModuleInit] WHATSAPP_TOKEN present=${tokenPresent}`);
  }

  /** schedule Json: mapa dia-da-semana → horas UTC, ex. { "2": [18], "4": [13, 18] } */
  private isWithinSchedule(
    schedule: Prisma.JsonValue,
    day: number,
    hour: number,
  ): boolean {
    if (!schedule || typeof schedule !== 'object' || Array.isArray(schedule)) {
      return false;
    }
    const map = schedule as Record<string, unknown>;
    const hours = map[String(day)];
    return Array.isArray(hours) && hours.includes(hour);
  }

  private asStringArray(value: Prisma.JsonValue): string[] {
    if (!Array.isArray(value)) {
      return [];
    }
    return value.filter((item): item is string => typeof item === 'string');
  }

  private sleep(ms: number): Promise<void> {
    if (ms <= 0) {
      return Promise.resolve();
    }
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  @Cron(CronExpression.EVERY_HOUR) // Terça a Quinta às 10h e 15h (horário de São Paulo convertido pra UTC)
  async handleCron() {
    this.logger.log('[handleCron] Executando tarefa agendada...');
    const currentHour = new Date().getHours();
    const currentDay = new Date().getDay(); // 0 = Domingo, 1 = Segunda, ..., 6 = Sábado
    console.log(`[handleCron] Hora atual: ${currentHour}, Dia atual: ${currentDay}`);

    const tenants = await this.prisma.tenant.findMany({
      where: {
        active: true,
        outreachConfig: {
          enabled: true,
        },
        NOT: {
          OR: [{ phone: null }, { phone: '' }],
        },
      },
      include: {
        outreachConfig: {
          include: OUTREACH_INCLUDE,
        },
        sendPolicy: true,
      },
    });

    console.log(
      `[handleCron] Encontrados ${tenants.length} tenants active com outreach enabled + phone`,
    );

    for (const tenant of tenants) {
      const config = tenant.outreachConfig;
      if (!config) {
        continue;
      }

      if (!this.isWithinSchedule(config.schedule, currentDay, currentHour)) {
        this.logger.log(
          `[handleCron] Tenant ${tenant.name} (ID: ${tenant.id}) fora da janela de schedule; pulando`,
        );
        continue;
      }

      const saldo = await this.prisma.coin.findFirst({
        where: {
          tenantId: tenant.id,
        },
        select: {
          balance: true,
        },
      });
      if (!saldo || saldo.balance < config.costPerLead) {
        this.logger.warn(
          `[handleCron] Tenant ${tenant.name} (ID: ${tenant.id}) não possui saldo suficiente para contatar leads. Saldo atual: ${saldo?.balance ?? 0}, costPerLead: ${config.costPerLead}`,
        );
        continue;
      }

      this.logger.log(
        `[handleCron] Iniciando contato com leads do tenant: ${tenant.name} (ID: ${tenant.id})`,
      );
      try {
        await this.contactLeads(tenant as TenantWithOutreach);
        this.logger.log(
          `[handleCron] Contato com leads do tenant ${tenant.name} concluído.`,
        );
      } catch (error) {
        console.log(error['response']?.['data']);
        this.logger.error(
          `[handleCron] Erro ao contatar leads do tenant ${tenant.name}: ${error}`,
        );
      }
    }
  }

  private async loadPolicyExclusionPhones(
    tenantId: number,
    respectAllTenants: boolean,
  ): Promise<{
    pairwise: string[];
    allOthersIfRespectAll: string[];
    exclusiveTenants: string[];
  }> {
    const respects = await this.prisma.tenantRespect.findMany({
      where: { tenantId },
      select: { respectedTenantId: true },
    });
    const respectTenantIds = respects.map((row) => row.respectedTenantId);

    const exclusivePolicies = await this.prisma.tenantSendPolicy.findMany({
      where: { exclusive: true, tenantId: { not: tenantId } },
      select: { tenantId: true },
    });
    const exclusiveTenantIds = exclusivePolicies.map((row) => row.tenantId);

    const [pairwise, exclusiveTenants, allOthersIfRespectAll] =
      await Promise.all([
        this.contactedPhonesForTenants(respectTenantIds),
        this.contactedPhonesForTenants(exclusiveTenantIds),
        respectAllTenants
          ? this.contactedPhonesForOtherTenants(tenantId)
          : Promise.resolve([] as string[]),
      ]);

    return { pairwise, allOthersIfRespectAll, exclusiveTenants };
  }

  private async contactedPhonesForTenants(
    tenantIds: number[],
  ): Promise<string[]> {
    if (tenantIds.length === 0) {
      return [];
    }
    const rows = await this.prisma.tenantLead.findMany({
      where: {
        contacted: true,
        tenantId: { in: tenantIds },
      },
      select: { lead: { select: { phone: true } } },
    });
    return rows.map((row) => row.lead.phone);
  }

  private async contactedPhonesForOtherTenants(
    tenantId: number,
  ): Promise<string[]> {
    const rows = await this.prisma.tenantLead.findMany({
      where: {
        contacted: true,
        tenantId: { not: tenantId },
      },
      select: { lead: { select: { phone: true } } },
    });
    return rows.map((row) => row.lead.phone);
  }

  private categoryWhere(tenantCategories: string[]): Prisma.LeadWhereInput {
    return {
      OR: [
        { categories: { hasSome: tenantCategories } },
        {
          AND: [
            { categories: { isEmpty: true } },
            { category: { in: tenantCategories } },
          ],
        },
      ],
    };
  }

  async contactLeads(tenant: TenantWithOutreach) {
    const config = tenant.outreachConfig;
    const categories = this.asStringArray(config.categories);
    this.logger.log(
      `[contactLeads] Buscando leads para contato (tenant=${tenant.id}, categories=${categories.length})...`,
    );

    if (categories.length === 0) {
      this.logger.log(
        `[contactLeads] Tenant ${tenant.id} sem categories configuradas; não selecionando leads`,
      );
      return;
    }

    if (config.costPerLead <= 0) {
      this.logger.warn(
        `[contactLeads] Tenant ${tenant.id} com costPerLead=${config.costPerLead}; não enviando`,
      );
      return;
    }

    const coin = await this.prisma.coin.findFirst({
      where: {
        tenantId: tenant.id,
      },
      select: {
        balance: true,
      },
    });
    const balance = coin?.balance ?? 0;
    const { pendingCity, pendingListAmount, pendingOnDemand } =
      await loadCrossChannelPending(this.prisma, tenant.id);
    const costPerOnDemandSend = config.costPerOnDemandSend ?? 0;
    const available = computeAvailableBalance({
      balance,
      pendingCity,
      costPerLead: config.costPerLead,
      pendingListAmount,
      pendingOnDemand,
      costPerOnDemandSend,
    });
    const affordable = affordableFromAvailable(
      available,
      config.costPerLead,
    );
    if (affordable <= 0) {
      this.logger.warn(
        `[contactLeads] Tenant ${tenant.id} sem saldo disponível para um lead. Saldo: ${balance}, available=${available}, pendingCity=${pendingCity}, pendingListAmount=${pendingListAmount}, pendingOnDemand=${pendingOnDemand}, costPerLead: ${config.costPerLead}`,
      );
      return;
    }

    const used = await this.prisma.tenantLead.findMany({
      where: cityUsedPhonesWhere(tenant.id),
      select: {
        lead: { select: { phone: true } },
      },
    });
    const usedPhones = [...new Set(used.map((row) => row.lead.phone))];
    const categoryFilter = this.categoryWhere(categories);
    const allowedCityIds = asIntArray(tenant.sendPolicy?.allowedCityIds);
    const deniedCityIds = asIntArray(tenant.sendPolicy?.deniedCityIds);
    const cityFilter = cityIdFilter(allowedCityIds, deniedCityIds);
    const extraExcluded = await this.loadPolicyExclusionPhones(
      tenant.id,
      tenant.sendPolicy?.respectAllTenants ?? false,
    );
    const excludedPhones = mergeExcludedPhones({
      own: usedPhones,
      pairwise: extraExcluded.pairwise,
      allOthersIfRespectAll: extraExcluded.allOthersIfRespectAll,
      exclusiveTenants: extraExcluded.exclusiveTenants,
    });
    const excludedList = [...excludedPhones];

    const leads = await this.prisma.lead.findMany({
      where: {
        deletedAt: null,
        ...(cityFilter ? { cityId: cityFilter } : {}),
        AND: [
          categoryFilter,
          {
            phone: {
              not: {
                contains: '153',
              },
              ...(excludedList.length > 0 ? { notIn: excludedList } : {}),
            },
          },
        ],
      },
      include: { city: true },
    });

    const uniquePool = uniqueByPhone(excludeUsedPhones(leads, excludedPhones));

    const allForAvg = await this.prisma.lead.findMany({
      where: {
        deletedAt: null,
        ...categoryFilter,
      },
      select: {
        categories: true,
        category: true,
        reviews: true,
      },
    });
    const avgByCategory = buildCategoryAverages(allForAvg, categories);

    const premium: Lead[] = [];
    const regular: Lead[] = [];
    for (const candidate of uniquePool) {
      if (isPremium(candidate, avgByCategory, categories)) {
        premium.push(candidate);
      } else {
        regular.push(candidate);
      }
    }

    const P = premium.length;
    const R = regular.length;
    const X = Math.min(config.leadsPerRun, affordable, P + R);
    const Y = computeY(P, R, X);
    const leadsToContact = selectStratifiedBatch(premium, regular, X, Y);
    this.logger.log(
      `[contactLeads] Mix X=${X} P=${P} R=${R} Y=${Y} (leadsPerRun=${config.leadsPerRun}, affordable=${affordable}, uniquePhones=${uniquePool.length})`,
    );

    if (leadsToContact.length === 0) {
      return;
    }

    const outreachTemplate = config.outreachTemplate;
    if (!outreachTemplate || outreachTemplate.status.toUpperCase() !== 'APPROVED') {
      this.logger.warn(
        `[contactLeads] outreachTemplate ausente ou status≠APPROVED (tenant=${tenant.id}, status=${outreachTemplate?.status ?? 'null'}); não enviando`,
      );
      return;
    }

    const { messagesUrl, token, accountId } = await this.platformWhatsapp.resolveCredentials(tenant.id);
    const persistConversation = await isDedicatedBoundToTenant(
      this.prisma,
      tenant.id,
      { accountId },
    );
    const slots = this.asSlots(outreachTemplate.slots);
    const bindings = this.roleBindings(config.slotBindings, 'outreach');

    for (let i = 0; i < leadsToContact.length; i++) {
      const lead = leadsToContact[i] as LeadWithCity;
      try {
        const values = this.resolveRoleValues(slots, bindings, {
          lead,
          tenant,
        });
        if (!values) {
          this.logger.warn(
            `[contactLeads] slot literal/header_image vazio; skip POST lead=${lead.id}`,
          );
        } else {
        await this.prisma.$transaction(async (tsx) => {
          console.log(`[contactLeads] Selecionando lead aleatório: ${lead.id} (${lead.phone})`);

          const sendBody = buildTemplateSendBody({
            name: outreachTemplate.name,
            language: outreachTemplate.language,
            slots,
            values,
          });
          const res = await this.httpService.axiosRef.post<WhatsAppSendMessageResponse>(
            messagesUrl,
            {
              ...sendBody,
              recipient_type: 'individual',
              to: `55${lead.phone.replace(/[^0-9]/g, '')}`,
            },
            {
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
            },
          );

          this.logger.log(`[contactLeads] Mensagem enviada para o lead ${lead.id} (${lead.phone}): ${res.data}`);
          await tsx.tenantLead.create({
            data: {
              tenantId: tenant.id,
              leadId: lead.id,
              contacted: true,
              replied: false,
              deleted: false,
              messageId: res.data.messages[0].id,
              templateName: outreachTemplate.name,
            },
          });

          if (persistConversation) {
            await upsertConversationThenMessage(tsx, {
              tenantId: tenant.id,
              phone: normalizeListPhone(lead.phone),
              profileName: lead.name ?? null,
              direction: WhatsappConversationDirection.OUT,
              wamid: res.data.messages[0].id,
              type: 'template',
              body: outreachTemplate.name,
              raw: {
                ...sendBody,
                to: `55${lead.phone.replace(/[^0-9]/g, '')}`,
              } as unknown as Prisma.InputJsonValue,
            });
          }

          this.logger.log(`[contactLeads] Lead ${lead.id} (${lead.phone}) marcado como contatado.`);
        });
        }
      } catch (error) {
        this.logger.error(`[contactLeads] Erro ao enviar mensagem para o lead ${lead.id} (${lead.phone}): ${error}`);
      }

      if (i < leadsToContact.length - 1) {
        await this.sleep(config.sendIntervalSeconds * 1000);
      }
    }

    await this.sleep(config.sendIntervalSeconds * 1000);
  }

  @Cron('0 0 0 * * *')
  async deleteOldLeads() {
    this.logger.log('[deleteOldLeads] Deletando leads antigos...');
    const fiveDaysAgo = new Date();
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 3);
    const leadsToDelete = await this.prisma.tenantLead.findMany({
      where: {
        contacted: true,
        replied: false,
        deleted: false,
        updatedAt: {
          lt: fiveDaysAgo,
        },
      },
    });
    this.logger.log(`[deleteOldLeads] Encontrados ${leadsToDelete.length} leads para deletar`);
    for (const lead of leadsToDelete) {
      try {
        await this.prisma.tenantLead.update({
          where: {
            id: lead.id,
          },
          data: {
            deleted: true,
          },
        });
        this.logger.log(`[deleteOldLeads] Lead deletado: id=${lead.id}`);
      } catch (error) {
        this.logger.error(`[deleteOldLeads] Erro ao deletar lead ${lead.id}: ${error}`);
      }
    }
  }

  async responseLeads(body: Message) {
    console.log('[responseLeads] Received response:', body);
    const lead = await this.prisma.tenantLead.findFirst({
      where: {
        messageId: body.context?.id,
      },
      include: {
        lead: { include: { city: true } },
        tenant: {
          include: {
            outreachConfig: {
              include: OUTREACH_INCLUDE,
            },
          },
        },
      },
    });

    if (!lead) {
      console.log(`[responseLeads] No lead found for messageId: ${body}`);
      return;
    }

    await this.prisma.tenantLead.updateMany({
      where: {
        messageId: body.context?.id,
      },
      data: {
        contacted: true,
        replied: true,
        deleted: false,
      },
    });
    console.log(`[responseLeads] Lead ${lead.lead.id} (${lead.lead.phone}) updated: contacted=true, replied=true`);
    if (body.type === 'button' && body.button.text === 'Tenho Interesse!') {
      const config = lead.tenant.outreachConfig;
      if (!config) {
        this.logger.warn(
          `[responseLeads] Tenant ${lead.tenant.id} sem TenantOutreachConfig; pulando notify/cashback`,
        );
        return;
      }

      const notifyTemplate = config.notifyTemplate;
      if (!notifyTemplate || notifyTemplate.status.toUpperCase() !== 'APPROVED') {
        this.logger.warn(
          `[responseLeads] notifyTemplate ausente ou status≠APPROVED (tenant=${lead.tenant.id}, status=${notifyTemplate?.status ?? 'null'}); pulando notify/cashback`,
        );
        return;
      }

      console.log(
        `[responseLeads] Notificando tenant=${lead.tenant.id} lead=${lead.lead.name} phone=${lead.lead.phone}`,
      );
      const { messagesUrl, token } = await this.platformWhatsapp.resolveCredentials(lead.tenant.id);
      const slots = this.asSlots(notifyTemplate.slots);
      const bindings = this.roleBindings(config.slotBindings, 'notify');
      const values = this.resolveRoleValues(slots, bindings, {
        lead: lead.lead as LeadWithCity,
        tenant: lead.tenant,
      });
      if (!values) {
        this.logger.warn(
          `[responseLeads] slot literal/header_image vazio; skip notify tenant=${lead.tenant.id}`,
        );
        return;
      }

      await this.prisma.$transaction(async (tsx) => {
        const sendBody = buildTemplateSendBody({
          name: notifyTemplate.name,
          language: notifyTemplate.language,
          slots,
          values,
        });
        await this.httpService.axiosRef.post(
          messagesUrl,
          {
            ...sendBody,
            recipient_type: 'individual',
            to: `55${lead.tenant.phone.replace(/[^0-9]/g, '')}`,
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          },
        );
        console.log(`[responseLeads] Notify template enviado ao tenant ${lead.tenant.phone}`);

        const user = await tsx.user.findFirst({
          where: {
            tenantId: lead.tenant.id,
          },
        });
        await tsx.coin.update({
          where: {
            userId_tenantId: {
              tenantId: lead.tenant.id,
              userId: user.id,
            },
          },
          data: {
            balance: {
              increment: config.cashbackOnReply,
            },
          },
        });
        await tsx.coinTransaction.create({
          data: {
            userId: user.id,
            tenantId: lead.tenant.id,
            leadId: lead.lead.id,
            type: 'CREDITO',
            amount: config.cashbackOnReply,
            description: `Cashback - Lead respondeu Tenho Interesse!`,
          },
        });
      })
    }
  }

  private asSlots(value: Prisma.JsonValue): TemplateSlot[] {
    if (!Array.isArray(value)) {
      return [];
    }
    return value as TemplateSlot[];
  }

  private roleBindings(
    slotBindings: Prisma.JsonValue,
    role: 'outreach' | 'notify',
  ): Record<string, SlotBinding> {
    if (!slotBindings || typeof slotBindings !== 'object' || Array.isArray(slotBindings)) {
      return {};
    }
    const roleObj = (slotBindings as Record<string, unknown>)[role];
    if (!roleObj || typeof roleObj !== 'object' || Array.isArray(roleObj)) {
      return {};
    }
    const out: Record<string, SlotBinding> = {};
    for (const [key, raw] of Object.entries(roleObj as Record<string, unknown>)) {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        continue;
      }
      const rec = raw as Record<string, unknown>;
      if (typeof rec.type !== 'string') {
        continue;
      }
      out[key] = {
        type: rec.type,
        value: typeof rec.value === 'string' ? rec.value : rec.value == null ? null : String(rec.value),
      };
    }
    return out;
  }

  private resolveRoleValues(
    slots: TemplateSlot[],
    bindings: Record<string, SlotBinding>,
    ctx: { lead: LeadWithCity; tenant: Tenant },
  ): Record<string, string> | null {
    const now = new Date();
    const resolveCtx = {
      lead: {
        name: ctx.lead.name,
        phone: ctx.lead.phone,
        cityName: ctx.lead.city?.name ?? null,
        category: ctx.lead.category,
        rating: ctx.lead.rating,
      },
      tenant: { phone: ctx.tenant.phone },
      now,
    };
    const values: Record<string, string> = {};
    for (const slot of slots) {
      const binding = bindings[slot.key];
      if (!binding) {
        this.logger.warn(`[resolveRoleValues] binding ausente para slot ${slot.key}`);
        return null;
      }
      const value = resolveBindingValue(binding, resolveCtx);
      if (
        (binding.type === 'literal' || binding.type === 'header_image') &&
        !value
      ) {
        return null;
      }
      values[slot.key] = value;
    }
    return values;
  }
}
