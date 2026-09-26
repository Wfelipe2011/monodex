import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { ApiTenantScopedErrors } from '../../swagger/api-route-errors.decorator';
import { RolesAuth } from '@core/decorators/roles.decorator';
import { RequestUser } from '@core/contracts/request-user';
import { Roles } from '@prisma/client';
import { TenantScopeGuard } from '@core/guard/tenant-scope.guard';
import { TenantActiveGuard } from '@core/guard/tenant-active.guard';
import { OutreachCampaignsService } from './outreach-campaigns.service';
import { UpsertOutreachCampaignDto } from './dto/upsert-outreach-campaign.dto';
import { PatchOutreachCampaignDto } from './dto/patch-outreach-campaign.dto';
import { rejectSecretTokenFields } from './reject-secret-token-fields';
import { ADMIN_TENANT_ID_PARAM } from './dto/swagger/tenant-list.swagger.dto';
import {
  OUTREACH_CAMPAIGN_ID_PARAM,
  OutreachCampaignResponseDto,
} from './dto/swagger/outreach-campaign.swagger.dto';

@ApiTags('Tenant — Outreach Campaigns')
@ApiBearerAuth()
@RolesAuth(Roles.ADMIN, Roles.SUPER_ADMIN)
@UseGuards(TenantScopeGuard, TenantActiveGuard)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
@Controller('tenant/:tenantId/outreach-campaigns')
export class OutreachCampaignsController {
  constructor(
    private readonly outreachCampaignsService: OutreachCampaignsService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Listar campanhas de prospecção (pool)',
    description:
      'Inclui relação mínima dos templates (id, name, language, status) e bindings persistidos.',
  })
  @ApiParam(ADMIN_TENANT_ID_PARAM)
  @ApiOkResponse({ type: OutreachCampaignResponseDto, isArray: true })
  @ApiTenantScopedErrors({ notFound: 'Tenant não encontrado' })
  listCampaigns(@Param('tenantId', ParseIntPipe) tenantId: number) {
    return this.outreachCampaignsService.listCampaigns(tenantId);
  }

  @Post()
  @ApiOperation({
    summary: 'Criar campanha de prospecção',
    description:
      'enabled=true exige templates APPROVED, grants válidos e slotBindings outreach/notify completos.',
  })
  @ApiParam(ADMIN_TENANT_ID_PARAM)
  @ApiCreatedResponse({ type: OutreachCampaignResponseDto })
  @ApiTenantScopedErrors({
    badRequest: 'Validação de enable, cityId, categorias ou bindings',
    notFound: 'Tenant não encontrado',
  })
  createCampaign(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Body() dto: UpsertOutreachCampaignDto,
    @Req() req: RequestUser,
  ) {
    rejectSecretTokenFields(req.body);
    return this.outreachCampaignsService.createCampaign(
      tenantId,
      dto,
      req.user.roles,
    );
  }

  @Get(':campaignId')
  @ApiOperation({ summary: 'Obter campanha por id' })
  @ApiParam(ADMIN_TENANT_ID_PARAM)
  @ApiParam(OUTREACH_CAMPAIGN_ID_PARAM)
  @ApiOkResponse({ type: OutreachCampaignResponseDto })
  @ApiTenantScopedErrors({
    notFound: 'Tenant ou campanha não encontrado',
  })
  getCampaign(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Param('campaignId', ParseIntPipe) campaignId: number,
  ) {
    return this.outreachCampaignsService.getCampaign(tenantId, campaignId);
  }

  @Patch(':campaignId')
  @ApiOperation({
    summary: 'Atualizar campanha (parcial)',
    description:
      'Merge com valores existentes. enabled=true revalida templates e bindings resultantes.',
  })
  @ApiParam(ADMIN_TENANT_ID_PARAM)
  @ApiParam(OUTREACH_CAMPAIGN_ID_PARAM)
  @ApiOkResponse({ type: OutreachCampaignResponseDto })
  @ApiTenantScopedErrors({
    badRequest: 'Validação falhou',
    notFound: 'Tenant ou campanha não encontrado',
  })
  patchCampaign(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Param('campaignId', ParseIntPipe) campaignId: number,
    @Body() dto: PatchOutreachCampaignDto,
    @Req() req: RequestUser,
  ) {
    rejectSecretTokenFields(req.body);
    return this.outreachCampaignsService.patchCampaign(
      tenantId,
      campaignId,
      dto,
      req.user.roles,
    );
  }

  @Delete(':campaignId')
  @ApiOperation({ summary: 'Excluir campanha (hard delete)' })
  @ApiParam(ADMIN_TENANT_ID_PARAM)
  @ApiParam(OUTREACH_CAMPAIGN_ID_PARAM)
  @ApiOkResponse({
    schema: { type: 'object', properties: { ok: { type: 'boolean' } } },
  })
  @ApiTenantScopedErrors({
    notFound: 'Tenant ou campanha não encontrado',
  })
  deleteCampaign(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Param('campaignId', ParseIntPipe) campaignId: number,
    @Req() req: RequestUser,
  ) {
    return this.outreachCampaignsService.deleteCampaign(
      tenantId,
      campaignId,
      req.user.roles,
    );
  }
}
