import {
  Body,
  Controller,
  HttpCode,
  Post,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBody,
  ApiNoContentResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '@core/decorators/public.decorator';
import {
  ApiDocErrors,
  ApiPublicRouteErrors,
} from '../../swagger/api-route-errors.decorator';
import { InboxInboundEventDto } from './dto/inbox-inbound-event.dto';
import { InternalSecretGuard } from './guards/internal-secret.guard';
import { InboxRealtimeService } from './inbox-realtime.service';

@ApiTags('Internal')
@Controller('internal/inbox/realtime')
@Public()
@UseGuards(InternalSecretGuard)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class InternalInboxRealtimeController {
  constructor(private readonly inboxRealtimeService: InboxRealtimeService) {}

  @Post('notify')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Publicar evento inbound para WebSocket/push (notifly → gym-ctrl)',
    description:
      'Requer header `X-Internal-Secret` igual a INTERNAL_WS_NOTIFY_SECRET. ' +
      'Sem JWT. Resposta 204 sem corpo.',
  })
  @ApiBody({ type: InboxInboundEventDto })
  @ApiNoContentResponse({
    description: 'Evento aceito e publicado para assinantes do tenant',
  })
  @ApiDocErrors.unauthorized(
    'Header X-Internal-Secret ausente ou diferente de INTERNAL_WS_NOTIFY_SECRET',
  )
  @ApiPublicRouteErrors({
    badRequest: 'Validação do body (type, tenantId, conversationId, message)',
  })
  notify(@Body() dto: InboxInboundEventDto): void {
    this.inboxRealtimeService.publishInbound(dto);
  }
}
