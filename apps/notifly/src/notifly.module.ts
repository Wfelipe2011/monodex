import { Module } from '@nestjs/common';
import { NotiflyController } from './notifly.controller';
import { NotiflyService } from './notifly.service';

@Module({
  imports: [],
  controllers: [NotiflyController],
  providers: [NotiflyService],
})
export class NotiflyModule {}
