import { All, Body, Controller, Get, Post, Query, Req, Res } from '@nestjs/common';
import { LeadsService } from './leads.service';
import { Message, WhatsAppWebhook } from './interfaces';
import { PrismaService } from '@core/infra/prisma/prisma.service';
import { WebhookPersistenceService } from './webhook-persistence.service';
import { ListCampaignReplyService } from './list-campaign-reply.service';

function isTenhoInteresse(msg: Message): boolean {
  return (
    msg.button?.text === 'Tenho Interesse!' ||
    Boolean(msg.text?.body?.includes('Tenho Interesse!'))
  );
}

@Controller()
export class NotiflyController {
  constructor(
    private readonly leadsService: LeadsService,
    private readonly prisma: PrismaService,
    private readonly webhookPersistence: WebhookPersistenceService,
    private readonly listCampaignReplyService: ListCampaignReplyService,
  ) {}

  @Get('health-check')
  async healthCheck() {
    const databaseInfo = await this.getDatabaseInfo();
    const {
      max_connections,
      countActive,
      countIdle,
    } = databaseInfo

    const payload = {
      message: 'Notifly API is running',
      version: 'v1.1.0',
      timestamp: new Date().toISOString(),
      database_info: {
        active: +countActive.toString(),
        idle: +countIdle.toString(),
        max_connections: +max_connections,
      },
    }

    return payload;
  }

  @Get('response-leads')
  async responseLeadsVerify(@Body() body: { phoneNumber: string, textMessage: string }, @Query() query, @Res() res) {
    console.log('[responseLeads] Received response:', query);
    return res.status(200).json(Number(query['hub.challenge']));
  }

  @Post('response-leads')
  async responseLeads(@Body() body: WhatsAppWebhook, @Query() query, @Res() res) {
    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const value = change.value;
        for (const msg of value.messages ?? []) {
          const result = await this.webhookPersistence.handleInboundMessage(
            msg,
            value.metadata,
          );
          if (
            result.correlation === 'list_send' &&
            msg.type === 'button' &&
            msg.context?.id
          ) {
            const listSend = await this.prisma.tenantListSend.findUnique({
              where: { wamid: msg.context.id },
            });
            if (listSend) {
              await this.listCampaignReplyService.handleButtonReply(
                msg,
                listSend,
              );
            }
          } else if (
            result.correlation === 'tenant_lead' &&
            isTenhoInteresse(msg)
          ) {
            await this.leadsService.responseLeads(msg);
          } else if (!isTenhoInteresse(msg)) {
            console.log('[responseLeads] Received text response:', msg);
          }
        }
        for (const status of value.statuses ?? []) {
          await this.webhookPersistence.handleStatus(status);
        }
      }
    }
    return res.status(200).json({ status: 'ok' });
  }

  private async getDatabaseInfo() {
    const [[{ max_connections }], [{ count: countActive }], [{ count: countIdle }]] = await Promise.all([
      this.prisma.$queryRaw`show max_connections` as Promise<{ max_connections: string }[]>,
      this.prisma.$queryRaw`select count(1) from pg_stat_activity where state = 'active' and datname = ${process.env.POSTGRES_DB}` as Promise<{ count: BigInt }[]>,
      this.prisma.$queryRaw`select count(1) from pg_stat_activity where state = 'idle' and datname = ${process.env.POSTGRES_DB}` as Promise<{ count: BigInt }[]>,
    ]);
    return {
      max_connections,
      countActive,
      countIdle
    };
  }
}
