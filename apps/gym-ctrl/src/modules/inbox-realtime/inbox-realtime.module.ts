import { Module } from '@nestjs/common';
import { PrismaModule } from '@core/infra';
import { InboxRealtimeGateway } from './inbox-realtime.gateway';
import { InboxRealtimeService } from './inbox-realtime.service';
import { InboxWebPushService } from './inbox-web-push.service';
import { InternalInboxRealtimeController } from './internal-inbox-realtime.controller';
import { PushSubscriptionsController } from './push-subscriptions.controller';
import { InternalSecretGuard } from './guards/internal-secret.guard';

@Module({
  imports: [PrismaModule],
  controllers: [InternalInboxRealtimeController, PushSubscriptionsController],
  providers: [
    InboxRealtimeGateway,
    InboxRealtimeService,
    InboxWebPushService,
    InternalSecretGuard,
  ],
  exports: [InboxRealtimeService, InboxWebPushService],
})
export class InboxRealtimeModule {}
