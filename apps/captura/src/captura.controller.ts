import { Controller, Get } from '@nestjs/common';
import { CapturaScraperService } from './captura-scraper.service';

@Controller()
export class CapturaController {
  constructor(private readonly capturaService: CapturaScraperService) {}

  @Get()
  getHello(): string {
    return this.capturaService.getHello();
  }
}
