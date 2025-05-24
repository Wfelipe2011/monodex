import { Module } from '@nestjs/common';
import { NotiflyController } from './notifly.controller';
import { NotiflyService } from './notifly.service';
import { PrismaModule } from '@core/infra';

@Module({
  imports: [PrismaModule],
  controllers: [NotiflyController],
  providers: [NotiflyService],
})
export class NotiflyModule {}
