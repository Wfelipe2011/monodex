import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { PrismaModule } from '@core/infra';
import { LeadsService } from './leads.service';
import { PlatformWhatsappService } from './platform-whatsapp.service';
import { WhatsappTemplateSyncService } from './whatsapp-template-sync.service';
import { ScheduleModule } from '@nestjs/schedule';
import { HttpModule } from '@nestjs/axios';
import { NotiflyController } from './notifly.controller';
import { WhatsappController } from './WhatsappController';
import { PrismaConnectionMiddleware } from '@core/infra/prisma/prisma-connection.middleware';

@Module({
  imports: [PrismaModule, ScheduleModule.forRoot(), HttpModule],
  controllers: [NotiflyController, WhatsappController],
  providers: [LeadsService, PlatformWhatsappService, WhatsappTemplateSyncService],
})
export class NotiflyModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(PrismaConnectionMiddleware).forRoutes('*');
  }
}