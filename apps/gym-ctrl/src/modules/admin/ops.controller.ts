import { Controller, Get, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { RolesAuth } from '@core/decorators/roles.decorator';
import { Roles } from '@prisma/client';
import { TenantScopeGuard } from '@core/guard/tenant-scope.guard';
import { TenantActiveGuard } from '@core/guard/tenant-active.guard';
import { OpsService } from './ops.service';
import {
  ApiPlatformSuperAdminErrors,
  ApiTenantScopedErrors,
} from '../../swagger/api-route-errors.decorator';
import {
  LeadCountResponseDto,
  OpsSummaryResponseDto,
  TenantHomeResponseDto,
  TenantLeadStatsResponseDto,
} from './dto/swagger/ops.swagger.dto';

@ApiTags('Platform — Ops')
@ApiBearerAuth()
@RolesAuth(Roles.SUPER_ADMIN)
@Controller('platform')
export class OpsController {
  constructor(private readonly opsService: OpsService) {}

  @Get('ops/summary')
  @ApiOperation({
    summary: 'Resumo operacional da plataforma',
    description:
      'Contadores: total de tenants, ativos, com outreach enabled, e leads no pool global (não soft-deleted).',
  })
  @ApiOkResponse({ type: OpsSummaryResponseDto })
  @ApiPlatformSuperAdminErrors()
  summary() {
    return this.opsService.summary();
  }

  @Get('tenants/:tenantId/leads/stats')
  @ApiOperation({
    summary: 'Funil de TenantLead por tenant',
    description:
      'Counts onde cada booleano de TenantLead é true. 404 se o tenant não existir.',
  })
  @ApiOkResponse({ type: TenantLeadStatsResponseDto })
  @ApiPlatformSuperAdminErrors({ notFound: 'Tenant não encontrado' })
  leadsStats(@Param('tenantId', ParseIntPipe) tenantId: number) {
    return this.opsService.leadsStats(tenantId);
  }

  @Get('leads/count')
  @ApiOperation({
    summary: 'Contagem do pool global de leads',
    description: 'Lead com deletedAt = null.',
  })
  @ApiOkResponse({ type: LeadCountResponseDto })
  @ApiPlatformSuperAdminErrors()
  leadsCount() {
    return this.opsService.leadsCount();
  }
}

@ApiTags('Tenant — Ops')
@ApiBearerAuth()
@RolesAuth(Roles.ADMIN, Roles.SUPER_ADMIN)
@UseGuards(TenantScopeGuard, TenantActiveGuard)
@Controller('tenant/:tenantId')
export class TenantLeadsStatsController {
  constructor(private readonly opsService: OpsService) {}

  @Get('leads/stats')
  @ApiOperation({
    summary: 'Funil de TenantLead do próprio tenant',
    description:
      'Counts onde cada booleano de TenantLead é true. 404 se o tenant não existir.',
  })
  @ApiOkResponse({ type: TenantLeadStatsResponseDto })
  @ApiTenantScopedErrors()
  leadsStats(@Param('tenantId', ParseIntPipe) tenantId: number) {
    return this.opsService.leadsStats(tenantId);
  }

  @Get('ops/home')
  @ApiOperation({
    summary: 'Snapshot operacional da home do tenant',
    description:
      'Coins (soma), outreach/funil cidade, flag de número dedicado, resumo de inbox e envios hoje/ontem em America/Sao_Paulo.',
  })
  @ApiOkResponse({ type: TenantHomeResponseDto })
  @ApiTenantScopedErrors()
  home(@Param('tenantId', ParseIntPipe) tenantId: number) {
    return this.opsService.home(tenantId);
  }
}
