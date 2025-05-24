import { Module } from '@nestjs/common';
import { CapturaController } from './captura.controller';
import { CapturaService } from './captura.service';
import { PrismaModule } from '@core/infra';

@Module({
  imports: [PrismaModule],
  controllers: [CapturaController],
  providers: [CapturaService],
})
export class CapturaModule {}
