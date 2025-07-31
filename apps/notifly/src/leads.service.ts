import { PrismaService } from '@core/infra/prisma/prisma.service';
import { HttpService } from '@nestjs/axios';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Tenant } from '@prisma/client';
import { Message } from './interfaces';
import { WhatsAppSendMessageResponse } from './WhatsAppSendMessageResponse';

@Injectable()
export class LeadsService implements OnModuleInit {
  logger = new Logger(LeadsService.name);
  constructor(
    private prisma: PrismaService,
    private httpService: HttpService,
  ) {}

  onModuleInit() {
    this.logger.log('[onModuleInit] LeadsService initialized');
    this.handleCron();
  }

  // @Cron(CronExpression.EVERY_MINUTE)
  async handleCron() {
    this.logger.log('[handleCron] Executando tarefa agendada...');
    const currentHour = new Date().getHours();
    const currentDay = new Date().getDay(); // 0 = Domingo, 1 = Segunda, ..., 6 = Sábado
    console.log(`[handleCron] Hora atual: ${currentHour}, Dia atual: ${currentDay}`);
    const validHours = [10, 11, 13, 14, 15, 16]; // Horários válidos: 12h, 13h, 14h, 17h, 18h, 0h, 1h, 2h, 3h, 4h, 5h
    const validDays = [1, 2, 3, 4, 5]; // Segunda, Terça, Quinta, Sexta
    // if (validHours.includes(currentHour) && validDays.includes(currentDay)) {
    if (true) {
      this.logger.log('[handleCron] Hora e dia válidos, iniciando contato com leads...');

      const tentants = await this.prisma.tenant.findMany({
        where: {
          id: 8,
        },
      });
      console.log(`[handleCron] Encontrados ${tentants.length} tenants para contato`);
      for (const tenant of tentants) {
        const saldo = await this.prisma.coin.findFirst({
          where: {
            tenantId: tenant.id,
          },
          select: {
            balance: true,
          },
        });
        if (saldo.balance < 1) {
          this.logger.warn(
            `[handleCron] Tenant ${tenant.name} (ID: ${tenant.id}) não possui saldo suficiente para contatar leads. Saldo atual: ${saldo.balance}`,
          );
          continue;
        }
        this.logger.log(`[handleCron] Iniciando contato com leads do tenant: ${tenant.name} (ID: ${tenant.id})`);
        try {
          await this.contactLeads(tenant);
          this.logger.log(`[handleCron] Contato com leads do tenant ${tenant.name} concluído.`);
        } catch (error) {
          console.log(error['response']['data']);
          this.logger.error(`[handleCron] Erro ao contatar leads do tenant ${tenant.name}: ${error}`);
        }
      }
    }
  }

  async contactLeads(tenant: Tenant) {
    this.logger.log('[contactLeads] Buscando leads para contato...');
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
          in: [
            'Construtoras',
            'Escritórios de advocacia',
            'Clínicas médicas',
            'Clínicas odontológicas',
            'Consultórios',
            'Estéticas',
            'Consutorias',
            // 'Cursos de inglês',
            // 'Agência Marketing Digital',
            // 'Web Design',
          ],
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
    const [lead] = leads.sort(() => Math.random() - 0.5);
    console.log(`[contactLeads] Selecionando lead aleatório: ${lead.id} (${lead.phone})`);
    const res = await this.httpService.axiosRef.post<WhatsAppSendMessageResponse>(
      `https://graph.facebook.com/v22.0/688645744332614/messages`,
      {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        // to: `55${lead.phone.replace(/[^0-9]/g, '')}`,
        to: `5515981785706`,
        type: 'template',
        template: {
          name: 'amigavel',
          language: {
            code: 'pt_BR',
          },
          components: [
            {
              type: 'body',
              parameters: [
                {
                  parameter_name: 'nome',
                  type: 'text',
                  text: lead.name,
                },
                {
                  parameter_name: 'empresa',
                  type: 'text',
                  text: tenant.name,
                },
                {
                  parameter_name: 'descricao',
                  type: 'text',
                  text: 'Oferecemos serviços como: criação de sites profissionais, otimização para Google e aumento da sua presença online.',
                },
              ],
            },
          ],
        },
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json',
        },
      },
    );

    this.logger.log(`[contactLeads] Mensagem enviada para o lead ${lead.id} (${lead.phone}): ${res.data}`);
    await this.prisma.tenantLead.create({
      data: {
        tenantId: tenant.id,
        leadId: lead.id,
        contacted: true,
        replied: false,
        deleted: false,
        messageId: res.data.messages[0].id,
      },
    });

    const user = await this.prisma.user.findFirst({
      where: {
        tenantId: tenant.id,
      },
    });

    await this.prisma.coin.update({
      where: {
        userId_tenantId: {
          tenantId: tenant.id,
          userId: user.id,
        },
      },
      data: {
        balance: {
          decrement: 0.50,
        },
      },
    });
    await this.prisma.coinTransaction.create({
      data: {
        userId: user.id,
        tenantId: tenant.id,
        leadId: lead.id,
        type: 'DEBITO',
        amount: -0.50,
        description: `Lead ${lead.id} (${lead.phone}) contatado`,
      },
    });
    this.logger.log(`[contactLeads] Lead ${lead.id} (${lead.phone}) marcado como contatado.`);
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
        tenant: true,
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
    if (body.type === 'button' && body.button.text === 'Sim') {
      const tenantLink = `https://wa.me/+55${lead.lead.phone.replace(/[^0-9]/g, '')}`;
      const message = `Olá ${lead.tenant.name}, o ${lead.lead.name} demonstrou interesse em seus serviços e respondeu sua mensagem.\nVocê pode entrar em contato com ele através do link: ${tenantLink}.`;
      console.log(`[responseLeads] Sending message to tenant: ${message}`);
      await this.httpService.axiosRef.post(
        `https://graph.facebook.com/v22.0/688645744332614/messages`,
        //   to: `55${lead.tenant.phone.replace(/[^0-9]/g, '')}`,
        {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: '5515981785706',
          type: 'template',
          template: {
            name: 'lembrete_entrar_contato_cliente',
            language: {
              code: 'pt_BR',
            },
            components: [
              {
                type: 'header',
                parameters: [
                  {
                    parameter_name: 'customer_name',
                    type: 'text',
                    text: lead.tenant.name,
                  },
                ],
              },
              {
                type: 'body',
                parameters: [
                  {
                    parameter_name: 'end_customer_name',
                    type: 'text',
                    text: lead.lead.name,
                  },
                  {
                    parameter_name: 'end_customer_phone',
                    type: 'text',
                    text: tenantLink,
                  },
                ],
              },
            ],
          },
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
            'Content-Type': 'application/json',
          },
        },
      );
      console.log(`[responseLeads] Message sent to tenant: ${message}`);

      const user = await this.prisma.user.findFirst({
        where: {
          tenantId: lead.tenant.id,
        },
      });
      await this.prisma.coin.update({
        where: {
          userId_tenantId: {
            tenantId: lead.tenant.id,
            userId: user.id,
          },
        },
        data: {
          balance: {
            increment: 0.05,
          },
        },
      });
      await this.prisma.coinTransaction.create({
        data: {
          userId: user.id,
          tenantId: lead.tenant.id,
          leadId: lead.lead.id,
          type: 'CREDITO',
          amount: 0.05,
          description: `Lead ${lead.lead.id} (${lead.lead.phone}) respondeu SIM à mensagem`,
        },
      });
      console.log(`[responseLeads] Coin updated for user ${user.id} in tenant ${lead.tenant.id}: -10 coins`);
    }
  }

  async shuffleLeads(leads: any[]) {
    console.log(`[shuffleLeads] Shuffling ${leads.length} leads`);
    const shuffledLeads = leads.sort(() => Math.random() - 0.5);
    return shuffledLeads;
  }
}
