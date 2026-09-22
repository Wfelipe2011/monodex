import { Module } from '@nestjs/common';
import { CapturaController } from './captura.controller';
import { InternalScrapeController } from './internal-scrape.controller';
import { CapturaScraperService } from './captura-scraper.service';
import { DynamicScrapeCronService } from './dynamic-scrape-cron.service';
import { PrismaModule } from '@core/infra';
import { ScheduleModule } from '@nestjs/schedule';
import { GoogleMapsScraper } from './scraper/google-maps.scraper';
import { LeadsService } from './leads.service';
import { HttpModule } from '@nestjs/axios';
import { GoogleMapsNeighborhoodScraper } from './scraper/google-maps-neighborhood.scraper';
import { ScrapePairLockService } from './scrape-pair-lock.service';
import { InternalScrapeSecretGuard } from './guards/internal-scrape-secret.guard';

@Module({
  imports: [PrismaModule, ScheduleModule.forRoot(), HttpModule],
  controllers: [CapturaController, InternalScrapeController],
  providers: [
    CapturaScraperService,
    ScrapePairLockService,
    InternalScrapeSecretGuard,
    DynamicScrapeCronService,
    GoogleMapsScraper,
    LeadsService,
    GoogleMapsNeighborhoodScraper,
  ],
})
export class CapturaModule { }
