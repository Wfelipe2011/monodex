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
import { WebhookPersistenceService } from './webhook-persistence.service';
import { CoinDebitOnStatusService } from './coin-debit-on-status.service';
import { ListCampaignsService } from './list-campaigns.service';
import { ListCampaignReplyService } from './list-campaign-reply.service';
import { InboxRealtimeNotifyService } from './inbox-realtime-notify.service';
import { OnDemandScheduleCronService } from './on-demand-schedule-cron.service';

@Module({
  imports: [PrismaModule, ScheduleModule.forRoot(), HttpModule],
  controllers: [NotiflyController, WhatsappController],
  providers: [
    LeadsService,
    PlatformWhatsappService,
    WhatsappTemplateSyncService,
    OnDemandScheduleCronService,
    CoinDebitOnStatusService,
    WebhookPersistenceService,
    ListCampaignsService,
    ListCampaignReplyService,
    InboxRealtimeNotifyService,
  ],
})
export class NotiflyModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(PrismaConnectionMiddleware).forRoutes('*');
  }
}