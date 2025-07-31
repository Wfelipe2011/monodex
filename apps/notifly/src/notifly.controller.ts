import { All, Body, Controller, Get, Post, Query, Req, Res } from '@nestjs/common';
import { LeadsService } from './leads.service';
import { WhatsAppWebhook } from './interfaces';

@Controller()
export class NotiflyController {
  constructor(private readonly leadsService: LeadsService) { }

  @Get()
  async healthCheck() {
    return { status: 'ok' };
  }

  @Get('response-leads')
  async responseLeadsVerify(@Body() body: { phoneNumber: string, textMessage: string }, @Query() query, @Res() res) {
    console.log('[responseLeads] Received response:', query);
    return res.status(200).json(Number(query['hub.challenge']));
  }

  @Post('response-leads')
  async responseLeads(@Body() body: WhatsAppWebhook, @Query() query, @Res() res) {
    if(body.entry[0].changes[0].value['messages']) {
      const message = body.entry[0].changes[0].value['messages'][0]
      if(message.type === 'button' && message['button'].text === 'Sim') {
        await this.leadsService.responseLeads(message);
      } else {
        console.log('[responseLeads] Received text response:', message);
      }
    }
    return res.status(200).json({ status: 'ok' });
  }
}
