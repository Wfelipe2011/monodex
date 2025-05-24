import { Controller, Get } from '@nestjs/common';
import { CapturaService } from './captura.service';

@Controller()
export class CapturaController {
  constructor(private readonly capturaService: CapturaService) {}

  @Get()
  getHello(): string {
    return this.capturaService.getHello();
  }
}
