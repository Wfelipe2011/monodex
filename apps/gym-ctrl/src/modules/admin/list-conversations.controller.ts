import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBadGatewayResponse,
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { RolesAuth } from '@core/decorators/roles.decorator';
import { Roles } from '@prisma/client';
import type { Request } from 'express';
import { ListConversationsService } from './list-conversations.service';
import { SendListConversationMessageDto } from './dto/send-list-conversation-message.dto';
import { rejectSecretTokenFields } from './reject-secret-token-fields';
import {
  ADMIN_TENANT_ID_PARAM,
  ConversationMessageResponseDto,
  LEAD_LIST_ID_PARAM,
  LIST_LEAD_ID_PARAM,
} from './dto/swagger/tenant-list.swagger.dto';

@ApiTags('Admin — List Conversations')
@ApiBearerAuth()
@RolesAuth(Roles.SUPER_ADMIN)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
@Controller('admin/tenants/:tenantId/lead-lists/:listId/leads/:leadId/messages')
export class ListConversationsController {
  constructor(
    private readonly listConversationsService: ListConversationsService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Histórico de mensagens do lead',
    description:
      'Mensagens de conversa (IN/OUT) ordenadas por createdAt ascendente. Use query `since` (ISO8601) para polling incremental no front.',
  })
  @ApiParam(ADMIN_TENANT_ID_PARAM)
  @ApiParam(LEAD_LIST_ID_PARAM)
  @ApiParam(LIST_LEAD_ID_PARAM)
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
  @ApiNotFoundResponse({ description: 'Tenant, lista ou lead não encontrado' })
  listMessages(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Param('listId', ParseIntPipe) listId: number,
    @Param('leadId', ParseIntPipe) leadId: number,
    @Query('since') since?: string,
  ) {
    return this.listConversationsService.listMessages(
      tenantId,
      listId,
      leadId,
      since,
    );
  }

  @Post()
  @ApiOperation({
    summary: 'Enviar texto livre via Cloud API',
    description:
      'Exige inbound do lead nas últimas 24h (janela Meta customer care). ' +
      '400 com corpo `OUTSIDE_MESSAGING_WINDOW` se não houver inbound recente. ' +
      '502 se a Graph API falhar.',
  })
  @ApiParam(ADMIN_TENANT_ID_PARAM)
  @ApiParam(LEAD_LIST_ID_PARAM)
  @ApiParam(LIST_LEAD_ID_PARAM)
  @ApiCreatedResponse({
    type: ConversationMessageResponseDto,
    description: 'Mensagem OUT persistida com wamid retornado pela Meta',
  })
  @ApiBadRequestResponse({
    description:
      'Texto vazio, fora da janela 24h (OUTSIDE_MESSAGING_WINDOW) ou erro 4xx da Graph',
  })
  @ApiBadGatewayResponse({ description: 'Erro 5xx da Graph API' })
  @ApiNotFoundResponse({ description: 'Tenant, lista ou lead não encontrado' })
  sendTextMessage(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Param('listId', ParseIntPipe) listId: number,
    @Param('leadId', ParseIntPipe) leadId: number,
    @Body() dto: SendListConversationMessageDto,
    @Req() req: Request,
  ) {
    rejectSecretTokenFields(req.body);
    return this.listConversationsService.sendTextMessage(
      tenantId,
      listId,
      leadId,
      dto,
    );
  }
}
