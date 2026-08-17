import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
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
import { ListCampaignsService } from './list-campaigns.service';
import { UpsertListCampaignDto } from './dto/upsert-list-campaign.dto';
import { PatchListCampaignDto } from './dto/patch-list-campaign.dto';
import { rejectSecretTokenFields } from './reject-secret-token-fields';
import {
  ADMIN_TENANT_ID_PARAM,
  CAMPAIGN_ID_PARAM,
  LEAD_LIST_ID_PARAM,
  ListCampaignResponseDto,
  ListSendResponseDto,
} from './dto/swagger/tenant-list.swagger.dto';

@ApiTags('Admin — List Campaigns')
@ApiBearerAuth()
@RolesAuth(Roles.SUPER_ADMIN)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
@Controller('admin/tenants/:tenantId/lead-lists/:listId/campaigns')
export class ListCampaignsController {
  constructor(private readonly listCampaignsService: ListCampaignsService) {}

  @Get()
  @ApiOperation({
    summary: 'Listar campanhas da lista',
    description:
      'Inclui relação mínima dos templates (id, name, language, status) e bindings persistidos.',
  })
  @ApiParam(ADMIN_TENANT_ID_PARAM)
  @ApiParam(LEAD_LIST_ID_PARAM)
  @ApiOkResponse({ type: ListCampaignResponseDto, isArray: true })
  @ApiNotFoundResponse({ description: 'Tenant ou lista não encontrado' })
  listCampaigns(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Param('listId', ParseIntPipe) listId: number,
  ) {
    return this.listCampaignsService.listCampaigns(tenantId, listId);
  }

  @Post()
  @ApiOperation({
    summary: 'Criar campanha',
    description:
      'enabled=true exige template APPROVED, bindings `send` completos, notifyTemplate + bindings `notify` se algum buttonAction for NOTIFY, e labels QUICK_REPLY válidos no template de disparo.',
  })
  @ApiParam(ADMIN_TENANT_ID_PARAM)
  @ApiParam(LEAD_LIST_ID_PARAM)
  @ApiCreatedResponse({ type: ListCampaignResponseDto })
  @ApiBadRequestResponse({
    description: 'Validação de enable, bindings ou buttonActions',
  })
  @ApiNotFoundResponse({ description: 'Tenant ou lista não encontrado' })
  createCampaign(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Param('listId', ParseIntPipe) listId: number,
    @Body() dto: UpsertListCampaignDto,
    @Req() req: Request,
  ) {
    rejectSecretTokenFields(req.body);
    return this.listCampaignsService.createCampaign(tenantId, listId, dto);
  }

  @Get(':campaignId')
  @ApiOperation({ summary: 'Obter campanha por id' })
  @ApiParam(ADMIN_TENANT_ID_PARAM)
  @ApiParam(LEAD_LIST_ID_PARAM)
  @ApiParam(CAMPAIGN_ID_PARAM)
  @ApiOkResponse({ type: ListCampaignResponseDto })
  @ApiNotFoundResponse({ description: 'Tenant, lista ou campanha não encontrado' })
  getCampaign(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Param('listId', ParseIntPipe) listId: number,
    @Param('campaignId', ParseIntPipe) campaignId: number,
  ) {
    return this.listCampaignsService.getCampaign(tenantId, listId, campaignId);
  }

  @Put(':campaignId')
  @ApiOperation({
    summary: 'Substituir campanha (corpo completo)',
    description: 'Mesmas regras de validação do POST.',
  })
  @ApiParam(ADMIN_TENANT_ID_PARAM)
  @ApiParam(LEAD_LIST_ID_PARAM)
  @ApiParam(CAMPAIGN_ID_PARAM)
  @ApiOkResponse({ type: ListCampaignResponseDto })
  @ApiBadRequestResponse({ description: 'Validação falhou' })
  replaceCampaign(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Param('listId', ParseIntPipe) listId: number,
    @Param('campaignId', ParseIntPipe) campaignId: number,
    @Body() dto: UpsertListCampaignDto,
    @Req() req: Request,
  ) {
    rejectSecretTokenFields(req.body);
    return this.listCampaignsService.replaceCampaign(
      tenantId,
      listId,
      campaignId,
      dto,
    );
  }

  @Patch(':campaignId')
  @ApiOperation({
    summary: 'Atualizar campanha (parcial)',
    description:
      'Merge com valores existentes. enabled=true revalida templates e bindings resultantes.',
  })
  @ApiParam(ADMIN_TENANT_ID_PARAM)
  @ApiParam(LEAD_LIST_ID_PARAM)
  @ApiParam(CAMPAIGN_ID_PARAM)
  @ApiOkResponse({ type: ListCampaignResponseDto })
  @ApiBadRequestResponse({ description: 'Validação falhou' })
  patchCampaign(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Param('listId', ParseIntPipe) listId: number,
    @Param('campaignId', ParseIntPipe) campaignId: number,
    @Body() dto: PatchListCampaignDto,
    @Req() req: Request,
  ) {
    rejectSecretTokenFields(req.body);
    return this.listCampaignsService.patchCampaign(
      tenantId,
      listId,
      campaignId,
      dto,
    );
  }
}

@ApiTags('Admin — List Campaigns')
@ApiBearerAuth()
@RolesAuth(Roles.SUPER_ADMIN)
@Controller('admin/tenants/:tenantId/lead-lists/:listId/sends')
export class ListSendsController {
  constructor(private readonly listCampaignsService: ListCampaignsService) {}

  @Get()
  @ApiOperation({
    summary: 'Listar envios (sends) da lista',
    description:
      'Até 100 registros, ordenados por sentAt desc. status=failed filtra por lastStatus failed e inclui latestError quando disponível.',
  })
  @ApiParam(ADMIN_TENANT_ID_PARAM)
  @ApiParam(LEAD_LIST_ID_PARAM)
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['failed'],
    description: 'Filtrar apenas sends com falha de entrega Meta',
    example: 'failed',
  })
  @ApiQuery({
    name: 'campaignId',
    required: false,
    type: Number,
    description: 'Filtrar sends de uma campanha específica',
    example: 3,
  })
  @ApiOkResponse({ type: ListSendResponseDto, isArray: true })
  @ApiBadRequestResponse({ description: 'campaignId inválido' })
  @ApiNotFoundResponse({ description: 'Tenant ou lista não encontrado' })
  listSends(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Param('listId', ParseIntPipe) listId: number,
    @Query('status') status?: string,
    @Query('campaignId') campaignIdRaw?: string,
  ) {
    if (campaignIdRaw !== undefined && campaignIdRaw !== '') {
      const campaignId = Number.parseInt(campaignIdRaw, 10);
      if (!Number.isInteger(campaignId) || campaignId < 1) {
        throw new BadRequestException('campaignId inválido');
      }
      return this.listCampaignsService.listSends(tenantId, listId, {
        status,
        campaignId,
      });
    }
    return this.listCampaignsService.listSends(tenantId, listId, { status });
  }
}
