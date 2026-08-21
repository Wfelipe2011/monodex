import { PrismaService } from '@core/infra/prisma/prisma.service';
import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  Prisma,
  Tenant,
  TenantListCampaign,
  TenantListLead,
  TenantLeadList,
  WhatsappConversationDirection,
  WhatsappDeliveryStatus,
  WhatsappMessageTemplate,
} from '@prisma/client';
import {
  isWithinSchedule,
  normalizeListPhone,
} from '@core/shared/list-campaign-helpers';
import {
  isDedicatedBoundToTenant,
  upsertConversationThenMessage,
} from './conversation-thread';
import {
  resolveBindingValue,
  SlotBinding,
} from '@core/shared/whatsapp-template-bindings';
import { TemplateSlot } from '@core/shared/whatsapp-template-slots';
import { buildTemplateSendBody } from '@core/shared/whatsapp-template-payload';
import { PlatformWhatsappService } from './platform-whatsapp.service';
import { WhatsAppSendMessageResponse } from './WhatsAppSendMessageResponse';
import {
  computeAffordableSends,
  pendingUnchargedListSendsWhere,
} from './coin-reservation';

type CampaignWithRelations = TenantListCampaign & {
  list: TenantLeadList & { tenant: Tenant };
  template: WhatsappMessageTemplate;
};

type ListLeadWithSends = TenantListLead & {
  sends: Array<{ campaignId: number; sentAt: Date; lastStatus: WhatsappDeliveryStatus | null }>;
};

const CAMPAIGN_INCLUDE = {
  list: { include: { tenant: true } },
  template: true,
} as const;

@Injectable()
export class ListCampaignsService {
  private readonly logger = new Logger(ListCampaignsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly httpService: HttpService,
    private readonly platformWhatsapp: PlatformWhatsappService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handleCron() {
    this.logger.log('[handleCron] Executando campanhas de lista...');
    const currentHour = new Date().getHours();
    const currentDay = new Date().getDay();

    const campaigns = await this.prisma.tenantListCampaign.findMany({
      where: { enabled: true },
      include: CAMPAIGN_INCLUDE,
    });

    this.logger.log(`[handleCron] ${campaigns.length} campanhas enabled`);

    for (const campaign of campaigns) {
      if (!isWithinSchedule(campaign.schedule, currentDay, currentHour)) {
        this.logger.log(
          `[handleCron] Campanha ${campaign.id} fora da janela de schedule; pulando`,
        );
        continue;
      }

      try {
        await this.runCampaign(campaign as CampaignWithRelations);
      } catch (error) {
        this.logger.error(
          `[handleCron] Erro na campanha ${campaign.id}: ${error}`,
        );
      }
    }
  }

  private async runCampaign(campaign: CampaignWithRelations) {
    const tenant = campaign.list.tenant;
    const costPerSend = campaign.list.costPerSend;

    if (!tenant.active) {
      this.logger.log(
        `[runCampaign] Tenant ${tenant.id} inativo; pulando campanha ${campaign.id}`,
      );
      return;
    }

    if (costPerSend <= 0) {
      this.logger.warn(
        `[runCampaign] Lista ${campaign.listId} com costPerSend=${costPerSend}; pulando`,
      );
      return;
    }

    const coin = await this.prisma.coin.findFirst({
      where: { tenantId: tenant.id },
      select: { balance: true },
    });
    const balance = coin?.balance ?? 0;
    const pendingUncharged = await this.prisma.tenantListSend.count({
      where: pendingUnchargedListSendsWhere(campaign.listId),
    });
    const affordable = computeAffordableSends(
      balance,
      pendingUncharged,
      costPerSend,
    );
    if (affordable <= 0) {
      this.logger.warn(
        `[runCampaign] Tenant ${tenant.id} saldo disponível insuficiente (balance=${balance}, pending=${pendingUncharged}, costPerSend=${costPerSend})`,
      );
      return;
    }

    const sendTemplate = campaign.template;
    if (sendTemplate.status.toUpperCase() !== 'APPROVED') {
      this.logger.warn(
        `[runCampaign] Template ${sendTemplate.id} status≠APPROVED; pulando campanha ${campaign.id}`,
      );
      return;
    }

    const eligible = await this.findEligibleLeads(campaign.listId);
    const batchSize = Math.min(
      campaign.sendsPerRun,
      affordable,
      eligible.length,
    );

    if (batchSize <= 0) {
      this.logger.log(
        `[runCampaign] Campanha ${campaign.id}: nenhum envio neste tick (eligible=${eligible.length}, affordable=${affordable})`,
      );
      return;
    }

    const batch = eligible.slice(0, batchSize);
    this.logger.log(
      `[runCampaign] Campanha ${campaign.id}: enviando ${batch.length} leads`,
    );

    const { messagesUrl, token, accountId } =
      await this.platformWhatsapp.resolveCredentials(tenant.id);
    const persistConversation = await isDedicatedBoundToTenant(
      this.prisma,
      tenant.id,
      { accountId },
    );
    const slots = this.asSlots(sendTemplate.slots);
    const bindings = this.roleBindings(campaign.slotBindings, 'send');

    for (let i = 0; i < batch.length; i++) {
      const listLead = batch[i];
      try {
        await this.sendToLead({
          campaign,
          tenant,
          listLead,
          messagesUrl,
          token,
          slots,
          bindings,
          sendTemplate,
          persistConversation,
        });
      } catch (error) {
        const errData = (error as { response?: { data?: unknown } })?.response
          ?.data;
        this.logger.error(
          `[runCampaign] Erro Graph lead ${listLead.id}: ${error}${errData ? ` ${JSON.stringify(errData)}` : ''}`,
        );
      }

      if (i < batch.length - 1) {
        await this.sleep(campaign.sendIntervalSeconds * 1000);
      }
    }
  }

  private async sendToLead(args: {
    campaign: CampaignWithRelations;
    tenant: Tenant;
    listLead: TenantListLead;
    messagesUrl: string;
    token: string;
    slots: TemplateSlot[];
    bindings: Record<string, SlotBinding>;
    sendTemplate: WhatsappMessageTemplate;
    persistConversation: boolean;
  }) {
    const {
      campaign,
      tenant,
      listLead,
      messagesUrl,
      token,
      slots,
      bindings,
      sendTemplate,
      persistConversation,
    } = args;

    const values = this.resolveRoleValues(slots, bindings, {
      recipient: listLead,
      tenant,
    });
    if (!values) {
      this.logger.warn(
        `[sendToLead] binding inválido; skip lead ${listLead.id}`,
      );
      return;
    }

    const sendBody = buildTemplateSendBody({
      name: sendTemplate.name,
      language: sendTemplate.language,
      slots,
      values,
    });

    const res = await this.httpService.axiosRef.post<WhatsAppSendMessageResponse>(
      messagesUrl,
      {
        ...sendBody,
        recipient_type: 'individual',
        to: normalizeListPhone(listLead.phone),
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      },
    );

    const wamid = res.data.messages[0].id;
    const phone = normalizeListPhone(listLead.phone);

    await this.prisma.$transaction(async (tsx) => {
      const send = await tsx.tenantListSend.create({
        data: {
          campaignId: campaign.id,
          listLeadId: listLead.id,
          wamid,
        },
      });

      await tsx.tenantListLead.update({
        where: { id: listLead.id },
        data: { sendLockCampaignId: campaign.id },
      });

      if (persistConversation) {
        await upsertConversationThenMessage(tsx, {
          tenantId: tenant.id,
          phone,
          profileName: listLead.name ?? null,
          direction: WhatsappConversationDirection.OUT,
          wamid,
          type: 'template',
          body: sendTemplate.name,
          raw: {
            ...sendBody,
            to: phone,
          } as unknown as Prisma.InputJsonValue,
          listLeadId: listLead.id,
          listSendId: send.id,
        });
      }
    });

    this.logger.log(
      `[sendToLead] Enviado lead ${listLead.id} wamid=${wamid} campanha ${campaign.id}`,
    );
  }

  private async findEligibleLeads(listId: number): Promise<TenantListLead[]> {
    const leads = await this.prisma.tenantListLead.findMany({
      where: { listId },
      include: {
        sends: {
          orderBy: { sentAt: 'desc' },
          select: {
            campaignId: true,
            sentAt: true,
            lastStatus: true,
          },
        },
      },
    });

    return (leads as ListLeadWithSends[]).filter((lead) =>
      this.isLeadEligible(lead),
    );
  }

  private isLeadEligible(lead: ListLeadWithSends): boolean {
    if (lead.sendLockCampaignId == null) {
      return true;
    }
    const lockId = lead.sendLockCampaignId;
    const lastFromLock = lead.sends
      .filter((s) => s.campaignId === lockId)
      .sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime())[0];
    return lastFromLock?.lastStatus === WhatsappDeliveryStatus.failed;
  }

  private asSlots(value: Prisma.JsonValue): TemplateSlot[] {
    if (!Array.isArray(value)) {
      return [];
    }
    return value as TemplateSlot[];
  }

  private roleBindings(
    slotBindings: Prisma.JsonValue,
    role: 'send' | 'notify',
  ): Record<string, SlotBinding> {
    if (
      !slotBindings ||
      typeof slotBindings !== 'object' ||
      Array.isArray(slotBindings)
    ) {
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
        value:
          typeof rec.value === 'string'
            ? rec.value
            : rec.value == null
              ? null
              : String(rec.value),
      };
    }
    return out;
  }

  private resolveRoleValues(
    slots: TemplateSlot[],
    bindings: Record<string, SlotBinding>,
    ctx: { recipient: TenantListLead; tenant: Tenant },
  ): Record<string, string> | null {
    const now = new Date();
    const resolveCtx = {
      recipient: {
        name: ctx.recipient.name,
        phone: ctx.recipient.phone,
        category: ctx.recipient.category,
        website: ctx.recipient.website,
        reviews: ctx.recipient.reviews,
      },
      tenant: { phone: ctx.tenant.phone },
      now,
    };
    const values: Record<string, string> = {};
    for (const slot of slots) {
      const binding = bindings[slot.key];
      if (!binding) {
        this.logger.warn(
          `[resolveRoleValues] binding ausente para slot ${slot.key}`,
        );
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

  private sleep(ms: number): Promise<void> {
    if (ms <= 0) {
      return Promise.resolve();
    }
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
