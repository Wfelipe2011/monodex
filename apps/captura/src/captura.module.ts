import { Module } from '@nestjs/common';
import { CapturaController } from './captura.controller';
import { CapturaScraperService } from './captura-scraper.service';
import { PrismaModule } from '@core/infra';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [PrismaModule, ScheduleModule.forRoot()],
  controllers: [CapturaController],
  providers: [CapturaScraperService],
})
export class CapturaModule { }
