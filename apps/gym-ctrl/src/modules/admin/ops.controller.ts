import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiTags,
} from '@nestjs/swagger';
import { RolesAuth } from '@core/decorators/roles.decorator';
import { Roles } from '@prisma/client';
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

@ApiTags('Admin — Ops')
@ApiBearerAuth()
@RolesAuth(Roles.SUPER_ADMIN)
@Controller('admin')
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
