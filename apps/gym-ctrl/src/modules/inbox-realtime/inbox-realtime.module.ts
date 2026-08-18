import { Module } from '@nestjs/common';
import { InboxRealtimeGateway } from './inbox-realtime.gateway';
import { InboxRealtimeService } from './inbox-realtime.service';
import { InternalInboxRealtimeController } from './internal-inbox-realtime.controller';
import { InternalSecretGuard } from './guards/internal-secret.guard';

@Module({
  controllers: [InternalInboxRealtimeController],
  providers: [InboxRealtimeGateway, InboxRealtimeService, InternalSecretGuard],
  exports: [InboxRealtimeService],
})
export class InboxRealtimeModule {}
