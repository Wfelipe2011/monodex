import {
  Body,
  Controller,
  HttpCode,
  Post,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { CapturaScraperService } from './captura-scraper.service';
import { OnDemandScrapeDto } from './dto/on-demand-scrape.dto';
import { InternalScrapeSecretGuard } from './guards/internal-scrape-secret.guard';

@Controller('internal/scrape')
@UseGuards(InternalScrapeSecretGuard)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class InternalScrapeController {
  constructor(private readonly scraperService: CapturaScraperService) {}

  @Post('on-demand')
  @HttpCode(200)
  async onDemand(@Body() dto: OnDemandScrapeDto) {
    return this.scraperService.runOnDemandScrape(
      dto.tenantId,
      dto.scrapeTargetId,
    );
  }
}
