import {
  Body,
  Controller,
  HttpCode,
  Post,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { Public } from '@core/decorators/public.decorator';
import { InboxInboundEventDto } from './dto/inbox-inbound-event.dto';
import { InternalSecretGuard } from './guards/internal-secret.guard';
import { InboxRealtimeService } from './inbox-realtime.service';

@Controller('internal/inbox/realtime')
@Public()
@UseGuards(InternalSecretGuard)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class InternalInboxRealtimeController {
  constructor(private readonly inboxRealtimeService: InboxRealtimeService) {}

  @Post('notify')
  @HttpCode(204)
  notify(@Body() dto: InboxInboundEventDto): void {
    this.inboxRealtimeService.publishInbound(dto);
  }
}
