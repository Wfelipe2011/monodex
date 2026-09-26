import { Controller, Get, Param, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { RolesAuth } from '@core/decorators/roles.decorator';
import { Roles } from '@prisma/client';
import { TenantScopeGuard } from '@core/guard/tenant-scope.guard';
import { TenantActiveGuard } from '@core/guard/tenant-active.guard';
import {
  ApiPlatformSuperAdminErrors,
  ApiTenantScopedErrors,
} from '../../swagger/api-route-errors.decorator';
import { OutreachSendsService } from './outreach-sends.service';
import { ADMIN_TENANT_ID_PARAM } from './dto/swagger/tenant-list.swagger.dto';
import { CityOutreachSendResponseDto } from './dto/swagger/city-outreach-sends.swagger.dto';

const LIST_SENDS_OPERATION = {
  summary: 'Listar envios de outreach de cidade',
  description:
    'Até 100 TenantLead com messageId (wamid), ordenados por sentAt desc. ' +
    'status=failed filtra por lastStatus failed e inclui latestError quando disponível. ' +
    'Não inclui envios de lista (TenantListSend). GET é leitura: TenantActiveGuard não bloqueia tenant inativo.',
};

// 403 de role fica a cargo de RolesAuth (padrão do módulo); sem e2e de guard nesta task.

@ApiTags('Tenant — City Outreach Sends')
@ApiBearerAuth()
@RolesAuth(Roles.ADMIN, Roles.SUPER_ADMIN)
@UseGuards(TenantScopeGuard, TenantActiveGuard)
@Controller('tenant/:tenantId/outreach/sends')
export class TenantOutreachSendsController {
  constructor(private readonly outreachSendsService: OutreachSendsService) {}

  @Get()
  @ApiOperation(LIST_SENDS_OPERATION)
  @ApiParam(ADMIN_TENANT_ID_PARAM)
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['failed'],
    description: 'Filtrar apenas envios com falha de entrega Meta',
    example: 'failed',
  })
  @ApiQuery({
    name: 'outreachCampaignId',
    required: false,
    type: Number,
    description: 'Restringe aos envios da campanha de prospecção indicada',
    example: 12,
  })
  @ApiOkResponse({ type: CityOutreachSendResponseDto, isArray: true })
  @ApiTenantScopedErrors({ badRequest: 'Query status inválida' })
  listSends(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Query('status') status?: string,
    @Query('outreachCampaignId', new ParseIntPipe({ optional: true }))
    outreachCampaignId?: number,
  ) {
    return this.outreachSendsService.listSends(tenantId, {
      status,
      outreachCampaignId,
    });
  }
}

@ApiTags('Platform — City Outreach Sends')
@ApiBearerAuth()
@RolesAuth(Roles.SUPER_ADMIN)
@Controller('platform/tenants/:tenantId/outreach/sends')
export class PlatformOutreachSendsController {
  constructor(private readonly outreachSendsService: OutreachSendsService) {}

  @Get()
  @ApiOperation(LIST_SENDS_OPERATION)
  @ApiParam(ADMIN_TENANT_ID_PARAM)
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['failed'],
    description: 'Filtrar apenas envios com falha de entrega Meta',
    example: 'failed',
  })
  @ApiQuery({
    name: 'outreachCampaignId',
    required: false,
    type: Number,
    description: 'Restringe aos envios da campanha de prospecção indicada',
    example: 12,
  })
  @ApiOkResponse({ type: CityOutreachSendResponseDto, isArray: true })
  @ApiPlatformSuperAdminErrors({
    notFound: 'Tenant não encontrado',
    badRequest: 'Query status inválida',
  })
  listSends(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Query('status') status?: string,
    @Query('outreachCampaignId', new ParseIntPipe({ optional: true }))
    outreachCampaignId?: number,
  ) {
    return this.outreachSendsService.listSends(tenantId, {
      status,
      outreachCampaignId,
    });
  }
}
