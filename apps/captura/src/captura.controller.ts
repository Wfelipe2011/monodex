import { Body, Controller, Get, Post } from '@nestjs/common';
import { LeadsService } from './leads.service';

@Controller()
export class CapturaController {
  constructor(private readonly leadsService: LeadsService) {}

  @Post('response-leads')
  async responseLeads(@Body() body: { phoneNumber: string, textMessage: string }) {
    return this.leadsService.responseLeads(body);
  }
}
