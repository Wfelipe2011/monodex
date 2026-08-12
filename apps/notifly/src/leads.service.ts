import "dotenv/config";
import { PrismaService } from '@core/infra/prisma/prisma.service';
import { HttpService } from '@nestjs/axios';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Prisma, Tenant, TenantOutreachConfig } from '@prisma/client';
import { Message } from './interfaces';
import { PlatformWhatsappService } from './platform-whatsapp.service';
import { WhatsAppSendMessageResponse } from './WhatsAppSendMessageResponse';

type TenantWithOutreach = Tenant & { outreachConfig: TenantOutreachConfig };

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
    this.handleCron();
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

  @Cron(CronExpression.EVERY_HOUR) // Terça a Quinta às 10h e 15h (horário de São Paulo convertido pra UTC)
  async handleCron() {
    this.logger.log('[handleCron] Executando tarefa agendada...');
    const currentHour = new Date().getHours();
    const currentDay = new Date().getDay(); // 0 = Domingo, 1 = Segunda, ..., 6 = Sábado
    console.log(`[handleCron] Hora atual: ${currentHour}, Dia atual: ${currentDay}`);

    const tenants = await this.prisma.tenant.findMany({
      where: {
        outreachConfig: {
          enabled: true,
        },
        NOT: {
          OR: [{ phone: null }, { phone: '' }],
        },
      },
      include: {
        outreachConfig: true,
      },
    });

    console.log(
      `[handleCron] Encontrados ${tenants.length} tenants com outreach enabled + phone`,
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

  async contactLeads(tenant: TenantWithOutreach) {
    const config = tenant.outreachConfig;
    const categories = this.asStringArray(config.categories);
    this.logger.log(
      `[contactLeads] Buscando leads para contato (tenant=${tenant.id}, categories=${categories.length})...`,
    );

    const leadsTenant = await this.prisma.tenantLead.findMany({
      where: {
        tenantId: tenant.id,
      },
      select: {
        leadId: true,
        contacted: true,
      },
    });

    const leads = await this.prisma.lead.findMany({
      where: {
        id: {
          notIn: leadsTenant.map((lt) => lt.leadId),
        },
        deletedAt: null,
        category: {
          in: categories,
        },
        phone: {
          not: {
            contains: '153',
          },
        },
        OR: [
          { website: '' },
          { website: { contains: 'facebo', mode: 'insensitive' } },
          { website: { contains: 'instagra', mode: 'insensitive' } },
          { website: { contains: 'sites', mode: 'insensitive' } },
          { website: { contains: 'link', mode: 'insensitive' } },
          { website: { contains: 'w.app', mode: 'insensitive' } },
          { website: { contains: 'wixsite', mode: 'insensitive' } },
          { website: { contains: 'wa.me', mode: 'insensitive' } },
          { website: { contains: 'whatsapp', mode: 'insensitive' } },
        ],
      },
    });
    this.logger.log(`[contactLeads] Encontrados ${leads.length} leads para contato`);
    const leadsSorted = leads.sort(() => Math.random() - 0.5);
    const leadsToContact = leadsSorted.slice(0, 5);
    const { messagesUrl, token } = await this.platformWhatsapp.resolveCredentials();

    for (const lead of leadsToContact) {
      try {
        await this.prisma.$transaction(async (tsx) => {
          console.log(`[contactLeads] Selecionando lead aleatório: ${lead.id} (${lead.phone})`);
          // test_gladson (e similares): BODY sem variáveis; HEADER IMAGE via env opcional
          const headerImageUrl = process.env.WHATSAPP_OUTREACH_HEADER_IMAGE_URL;
          const templateComponents: Array<Record<string, unknown>> = [];
          if (headerImageUrl) {
            templateComponents.push({
              type: 'header',
              parameters: [
                {
                  type: 'image',
                  image: { link: headerImageUrl },
                },
              ],
            });
          } else {
            this.logger.warn(
              '[contactLeads] WHATSAPP_OUTREACH_HEADER_IMAGE_URL ausente; enviando template sem header image (Meta pode rejeitar templates com HEADER IMAGE)',
            );
          }

          const res = await this.httpService.axiosRef.post<WhatsAppSendMessageResponse>(
            messagesUrl,
            {
              messaging_product: 'whatsapp',
              recipient_type: 'individual',
              to: `55${lead.phone.replace(/[^0-9]/g, '')}`,
              type: 'template',
              template: {
                name: config.outreachTemplateName,
                language: {
                  code: 'pt_BR',
                },
                ...(templateComponents.length > 0
                  ? { components: templateComponents }
                  : {}),
              },
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
            },
          });

          const user = await tsx.user.findFirst({
            where: {
              tenantId: tenant.id,
            },
          });

          await tsx.coin.update({
            where: {
              userId_tenantId: {
                tenantId: tenant.id,
                userId: user.id,
              },
            },
            data: {
              balance: {
                decrement: config.costPerLead,
              },
            },
          });
          await tsx.coinTransaction.create({
            data: {
              userId: user.id,
              tenantId: tenant.id,
              leadId: lead.id,
              type: 'DEBITO',
              amount: -config.costPerLead,
              description: `Lead ${lead.id} (${lead.phone}) contatado`,
            },
          });
          this.logger.log(`[contactLeads] Lead ${lead.id} (${lead.phone}) marcado como contatado.`);
        })
      } catch (error) {
        this.logger.error(`[contactLeads] Erro ao enviar mensagem para o lead ${lead.id} (${lead.phone}): ${error}`);
      }
    }
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
        lead: true,
        tenant: {
          include: {
            outreachConfig: true,
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

      const leadPhoneDigits = lead.lead.phone.replace(/[^0-9]/g, '');
      const customerPhone = leadPhoneDigits.startsWith('55')
        ? leadPhoneDigits
        : `55${leadPhoneDigits}`;
      const customerLead =
        process.env.WHATSAPP_NOTIFY_CUSTOMER_LEAD ??
        'interessado em contratar *Certificados Digitais*';
      console.log(
        `[responseLeads] Notificando tenant=${lead.tenant.id} lead=${lead.lead.name} phone=${customerPhone}`,
      );
      const { messagesUrl, token } = await this.platformWhatsapp.resolveCredentials();
      await this.prisma.$transaction(async (tsx) => {
        // lembrete_entrar_contato_interessado: NAMED body + URL button {{1}}
        await this.httpService.axiosRef.post(
          messagesUrl,
          {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: `55${lead.tenant.phone.replace(/[^0-9]/g, '')}`,
            type: 'template',
            template: {
              name: config.notifyTenantTemplateName,
              language: {
                code: 'pt_BR',
              },
              components: [
                {
                  type: 'body',
                  parameters: [
                    {
                      type: 'text',
                      parameter_name: 'customer_lead',
                      text: customerLead,
                    },
                    {
                      type: 'text',
                      parameter_name: 'customer_name',
                      text: lead.lead.name,
                    },
                    {
                      type: 'text',
                      parameter_name: 'customer_phone',
                      text: customerPhone,
                    },
                  ],
                },
                {
                  type: 'button',
                  sub_type: 'url',
                  index: '0',
                  parameters: [
                    {
                      type: 'text',
                      text: customerPhone,
                    },
                  ],
                },
              ],
            },
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

  async shuffleLeads(leads: any[]) {
    console.log(`[shuffleLeads] Shuffling ${leads.length} leads`);
    const shuffledLeads = leads.sort(() => Math.random() - 0.5);
    return shuffledLeads;
  }
}
