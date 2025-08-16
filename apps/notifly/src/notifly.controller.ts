import { All, Body, Controller, Get, Post, Query, Req, Res } from '@nestjs/common';
import { LeadsService } from './leads.service';
import { WhatsAppWebhook } from './interfaces';
import { PrismaService } from '@core/infra/prisma/prisma.service';

@Controller()
export class NotiflyController {
  constructor(private readonly leadsService: LeadsService, private prisma: PrismaService,) { }

  @Get()
  async healthCheck() {
    const databaseInfo = await this.getDatabaseInfo();
    const {
      max_connections,
      countActive,
      countIdle,
    } = databaseInfo
    console.log('Database Info:', {
      message: 'Notifly API is running',
      version: 'v1.0.2',
      timestamp: new Date().toISOString(),
      database_info: {
        active: +countActive.toString(),
        idle: +countIdle.toString(),
        max_connections: +max_connections,
      },
    });
    return {
      message: 'Notifly API is running',
      version: 'v1.0.2',
      timestamp: new Date().toISOString(),
      database_info: {
        active: +countActive.toString(),
        idle: +countIdle.toString(),
        max_connections: +max_connections,
      },
    };
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
      if (message.type === 'button' && message['button'].text === 'Sim') {
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
