import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBadGatewayResponse,
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { ApiKeyAllowlist } from '@core/decorators/api-key-allowlist.decorator';
import { RolesAuth } from '@core/decorators/roles.decorator';
import { RequestUser } from '@core/contracts/request-user';
import { Roles } from '@prisma/client';
import { TenantScopeGuard } from '@core/guard/tenant-scope.guard';
import { TenantActiveGuard } from '@core/guard/tenant-active.guard';
import { ConversationsService } from './conversations.service';
import { SendConversationMessageDto } from './dto/send-conversation-message.dto';
import { rejectSecretTokenFields } from './reject-secret-token-fields';
import { ADMIN_TENANT_ID_PARAM } from './dto/swagger/tenant-list.swagger.dto';
import {
  CONVERSATION_ID_PARAM,
  ConversationMessageResponseDto,
  ConversationThreadResponseDto,
} from './dto/swagger/tenant-conversations.swagger.dto';

@ApiTags('Tenant — Conversations')
@ApiBearerAuth()
@ApiSecurity('X-API-KEY')
@ApiKeyAllowlist()
@RolesAuth(Roles.ADMIN, Roles.SUPER_ADMIN)
@UseGuards(TenantScopeGuard, TenantActiveGuard)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
@Controller('tenant/:tenantId/conversations')
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Get()
  @ApiOperation({
    summary: 'Listar threads de conversa do tenant',
    description:
      'Threads ordenadas por lastMessageAt descendente. Inclui resumo da última mensagem e windowOpen (inbound nas últimas 24h).',
  })
  @ApiParam(ADMIN_TENANT_ID_PARAM)
  @ApiOkResponse({
    type: ConversationThreadResponseDto,
    isArray: true,
    description: 'Threads do tenant, mais recente primeiro',
  })
  @ApiNotFoundResponse({ description: 'Tenant não encontrado' })
  listConversations(@Param('tenantId', ParseIntPipe) tenantId: number) {
    return this.conversationsService.listConversations(tenantId);
  }

  @Get(':conversationId/messages')
  @ApiOperation({
    summary: 'Histórico de mensagens da thread',
    description:
      'Mensagens (IN/OUT) ordenadas por createdAt ascendente. Use query `since` (ISO8601) para polling incremental no front.',
  })
  @ApiParam(ADMIN_TENANT_ID_PARAM)
  @ApiParam(CONVERSATION_ID_PARAM)
  @ApiQuery({
    name: 'since',
    required: false,
    description: 'Retorna apenas mensagens com createdAt > since',
    example: '2026-08-17T12:00:00.000Z',
  })
  @ApiOkResponse({
    type: ConversationMessageResponseDto,
    isArray: true,
    description: 'Histórico completo ou delta desde `since`',
  })
  @ApiBadRequestResponse({ description: 'since inválido (não ISO8601)' })
  @ApiNotFoundResponse({ description: 'Tenant ou conversa não encontrada' })
  listMessages(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Param('conversationId', ParseIntPipe) conversationId: number,
    @Query('since') since?: string,
  ) {
    return this.conversationsService.listMessages(
      tenantId,
      conversationId,
      since,
    );
  }

  @Post(':conversationId/messages')
  @ApiOperation({
    summary: 'Enviar texto livre via Cloud API',
    description:
      'Exige número dedicado do tenant e inbound na thread nas últimas 24h (janela Meta customer care). ' +
      '400 com corpo `OUTSIDE_MESSAGING_WINDOW` se não houver inbound recente. ' +
      '502 se a Graph API falhar. Super Admin sempre 403 (sem pontapé).',
  })
  @ApiParam(ADMIN_TENANT_ID_PARAM)
  @ApiParam(CONVERSATION_ID_PARAM)
  @ApiCreatedResponse({
    type: ConversationMessageResponseDto,
    description: 'Mensagem OUT persistida com wamid retornado pela Meta',
  })
  @ApiBadRequestResponse({
    description:
      'Texto vazio, sem número dedicado, fora da janela 24h (OUTSIDE_MESSAGING_WINDOW) ou erro 4xx da Graph',
  })
  @ApiForbiddenResponse({ description: 'Super Admin ou tenant inativo' })
  @ApiBadGatewayResponse({ description: 'Erro 5xx da Graph API' })
  @ApiNotFoundResponse({ description: 'Tenant ou conversa não encontrada' })
  sendTextMessage(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Param('conversationId', ParseIntPipe) conversationId: number,
    @Body() dto: SendConversationMessageDto,
    @Req() req: RequestUser,
  ) {
    if (req.user.roles?.includes(Roles.SUPER_ADMIN)) {
      throw new ForbiddenException('Acesso não permitido');
    }
    rejectSecretTokenFields(req.body);
    return this.conversationsService.sendTextMessage(
      tenantId,
      conversationId,
      dto,
    );
  }
}
