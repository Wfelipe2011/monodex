import { Module } from '@nestjs/common';
import { CapturaController } from './captura.controller';
import { CapturaScraperService } from './captura-scraper.service';
import { PrismaModule } from '@core/infra';
import { ScheduleModule } from '@nestjs/schedule';
import { GoogleMapsScraper } from './scraper/google-maps.scraper';
import { LeadsService } from './leads.service';

@Module({
  imports: [PrismaModule, ScheduleModule.forRoot()],
  controllers: [CapturaController],
  providers: [CapturaScraperService, GoogleMapsScraper, LeadsService],
})
export class CapturaModule { }
