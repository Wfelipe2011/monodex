import { Module } from '@nestjs/common';
import { CapturaController } from './captura.controller';
import { CapturaService } from './captura.service';

@Module({
  imports: [],
  controllers: [CapturaController],
  providers: [CapturaService],
})
export class CapturaModule {}
