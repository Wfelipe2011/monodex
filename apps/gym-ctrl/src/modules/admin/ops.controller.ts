import { Controller, Get, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiTags,
} from '@nestjs/swagger';
import { RolesAuth } from '@core/decorators/roles.decorator';
import { Roles } from '@prisma/client';
import { TenantScopeGuard } from '@core/guard/tenant-scope.guard';
import { TenantActiveGuard } from '@core/guard/tenant-active.guard';
import { OpsService } from './ops.service';

class OpsSummaryDto {
  @ApiProperty({ example: 10 })
  totalTenants: number;

  @ApiProperty({ example: 8 })
  activeTenants: number;

  @ApiProperty({ example: 3 })
  outreachEnabledTenants: number;

  @ApiProperty({
    description: 'Leads no pool global com deletedAt null',
    example: 150,
  })
  totalLeads: number;
}

class TenantLeadStatsDto {
  @ApiProperty({ example: 12 })
  contacted: number;

  @ApiProperty({ example: 4 })
  replied: number;

  @ApiProperty({ example: 1 })
  quoted: number;

  @ApiProperty({ example: 0 })
  closed: number;

  @ApiProperty({ example: 2 })
  deleted: number;
}

class LeadCountDto {
  @ApiProperty({
    description: 'Quantidade de Lead com deletedAt null',
    example: 150,
  })
  count: number;
}

class TenantHomeCoinsDto {
  @ApiProperty({ example: 12.5 })
  balance: number;
}

class TenantHomeOutreachDto {
  @ApiProperty({ example: true })
  enabled: boolean;

  @ApiProperty({ example: true })
  hasDedicatedNumber: boolean;

  @ApiProperty({ type: TenantLeadStatsDto })
  cityFunnel: TenantLeadStatsDto;
}

class TenantHomeInboxDto {
  @ApiProperty({ example: 10 })
  threadCount: number;

  @ApiProperty({ example: 3 })
  openWindows: number;

  @ApiProperty({
    example: '2026-08-19T11:00:00.000Z',
    nullable: true,
  })
  lastInboundAt: string | null;
}

class TenantHomeSendBucketsDto {
  @ApiProperty({ example: 1 })
  sent: number;

  @ApiProperty({ example: 4 })
  delivered: number;

  @ApiProperty({ example: 2 })
  read: number;

  @ApiProperty({ example: 0 })
  failed: number;

  @ApiProperty({ example: 1 })
  pending: number;

  @ApiProperty({ example: 8 })
  total: number;
}

class TenantHomeSendsDto {
  @ApiProperty({ example: 'America/Sao_Paulo' })
  timezone: string;

  @ApiProperty({ type: TenantHomeSendBucketsDto })
  today: TenantHomeSendBucketsDto;

  @ApiProperty({ type: TenantHomeSendBucketsDto })
  yesterday: TenantHomeSendBucketsDto;
}

class TenantHomeDto {
  @ApiProperty({ type: TenantHomeCoinsDto })
  coins: TenantHomeCoinsDto;

  @ApiProperty({ type: TenantHomeOutreachDto })
  outreach: TenantHomeOutreachDto;

  @ApiProperty({ type: TenantHomeInboxDto })
  inbox: TenantHomeInboxDto;

  @ApiProperty({ type: TenantHomeSendsDto })
  sends: TenantHomeSendsDto;
}

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
  @ApiOkResponse({ type: OpsSummaryDto })
  summary() {
    return this.opsService.summary();
  }

  @Get('tenants/:tenantId/leads/stats')
  @ApiOperation({
    summary: 'Funil de TenantLead por tenant',
    description:
      'Counts onde cada booleano de TenantLead é true. 404 se o tenant não existir.',
  })
  @ApiOkResponse({ type: TenantLeadStatsDto })
  leadsStats(@Param('tenantId', ParseIntPipe) tenantId: number) {
    return this.opsService.leadsStats(tenantId);
  }

  @Get('leads/count')
  @ApiOperation({
    summary: 'Contagem do pool global de leads',
    description: 'Lead com deletedAt = null.',
  })
  @ApiOkResponse({ type: LeadCountDto })
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
  @ApiOkResponse({ type: TenantLeadStatsDto })
  leadsStats(@Param('tenantId', ParseIntPipe) tenantId: number) {
    return this.opsService.leadsStats(tenantId);
  }

  @Get('ops/home')
  @ApiOperation({
    summary: 'Snapshot operacional da home do tenant',
    description:
      'Coins (soma), outreach/funil cidade, flag de número dedicado, resumo de inbox e envios hoje/ontem em America/Sao_Paulo.',
  })
  @ApiOkResponse({ type: TenantHomeDto })
  home(@Param('tenantId', ParseIntPipe) tenantId: number) {
    return this.opsService.home(tenantId);
  }
}
