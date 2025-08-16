import { All, Body, Controller, Get, Post, Query, Req, Res } from '@nestjs/common';
import { LeadsService } from './leads.service';
import { WhatsAppWebhook } from './interfaces';
import { PrismaService } from '@core/infra/prisma/prisma.service';
import { MessageDirection } from '@prisma/client';

@Controller()
export class NotiflyController {
  constructor(private readonly leadsService: LeadsService, private prisma: PrismaService,) { }

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
    if (body.entry[0].changes[0].value['messages']) {
      const message = body.entry[0].changes[0].value['messages'][0]
      await this.prisma.message.create({
        data: {
          body: message?.text?.body || message?.button?.text || JSON.stringify(message),
          direction: MessageDirection.ENTRADA,
          contact: {
            connectOrCreate: {
              where: { phone: message.from },
              create: { phone: message.from }
            }
          }
        }
      }).catch((e) => console.log("Erro", JSON.stringify(message, null, 2)))
      if (message['button'].text === 'Sim' || message?.text?.body?.includes('Sim')) {
        await this.leadsService.responseLeads(message);
      } else {
        console.log('[responseLeads] Received text response:', message);
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
