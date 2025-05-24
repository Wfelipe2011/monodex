import { Controller, Get } from '@nestjs/common';
import { NotiflyService } from './notifly.service';

@Controller()
export class NotiflyController {
  constructor(private readonly notiflyService: NotiflyService) {}

  @Get()
  getHello(): string {
    return this.notiflyService.getHello();
  }
}
