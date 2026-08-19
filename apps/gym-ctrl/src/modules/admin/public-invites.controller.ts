import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { Public } from '@core/decorators/public.decorator';
import { LoginOutput } from '../../dtos/login.dto';
import {
  AcceptInviteDto,
  PreviewInviteResponseDto,
  PUBLIC_INVITE_TOKEN_PARAM,
} from './dto/accept-invite.dto';
import { InvitesService } from './invites.service';

@ApiTags('Public — Invites')
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
@Controller('public/invites')
export class PublicInvitesController {
  constructor(private readonly invitesService: InvitesService) {}

  @Public()
  @Get(':token')
  @ApiOperation({
    summary: 'Preview de convite pendente (sem autenticação)',
    description:
      'Token no path, não Bearer. 404 genérico se desconhecido, expirado, revogado ou consumido. Inclui tenantId para o front.',
  })
  @ApiParam(PUBLIC_INVITE_TOKEN_PARAM)
  @ApiOkResponse({ type: PreviewInviteResponseDto })
  @ApiNotFoundResponse({ description: 'Convite não encontrado' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit por IP excedido' })
  preview(
    @Param('token') token: string,
    @Req() req: { ip?: string; headers: Record<string, unknown> },
  ) {
    return this.invitesService.preview(token, clientIp(req));
  }

  @Public()
  @Post(':token/accept')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Aceitar convite e criar o usuário (sem autenticação)',
    description:
      'Cria ADMIN (FIRST_ADMIN) ou USER (TENANT_USER). Devolve JWT no mesmo contrato do login. Sem roles no body.',
  })
  @ApiParam(PUBLIC_INVITE_TOKEN_PARAM)
  @ApiCreatedResponse({ type: LoginOutput })
  @ApiNotFoundResponse({ description: 'Convite não encontrado' })
  @ApiForbiddenResponse({ description: 'Tenant inativo' })
  @ApiConflictResponse({
    description: 'E-mail/username duplicado ou tenant já possui usuários',
  })
  @ApiTooManyRequestsResponse({ description: 'Rate limit por IP excedido' })
  accept(
    @Param('token') token: string,
    @Body() dto: AcceptInviteDto,
    @Req() req: { ip?: string; headers: Record<string, unknown> },
  ) {
    return this.invitesService.accept(token, dto, clientIp(req));
  }
}

function clientIp(req: {
  ip?: string;
  headers: Record<string, unknown>;
}): string {
  const forwarded = req.headers['x-forwarded-for'];
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  if (typeof raw === 'string' && raw.trim()) {
    return raw.split(',')[0].trim();
  }
  return req.ip?.trim() || 'unknown';
}
