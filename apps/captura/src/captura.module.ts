import { Module } from '@nestjs/common';
import { CapturaController } from './captura.controller';
import { CapturaScraperService } from './captura-scraper.service';
import { PrismaModule } from '@core/infra';
import { ScheduleModule } from '@nestjs/schedule';
import { GoogleMapsScraper } from './scraper/google-maps.scraper';
import { LeadsService } from './leads.service';
import { HttpModule } from '@nestjs/axios';
import { GoogleMapsNeighborhoodScraper } from './scraper/google-maps-neighborhood.scraper';

@Module({
  imports: [PrismaModule, ScheduleModule.forRoot(), HttpModule],
  controllers: [CapturaController],
  providers: [CapturaScraperService, GoogleMapsScraper, LeadsService, GoogleMapsNeighborhoodScraper],
})
export class CapturaModule { }
