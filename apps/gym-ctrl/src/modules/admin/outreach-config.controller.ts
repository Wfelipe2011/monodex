import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Put,
  Req,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RolesAuth } from '@core/decorators/roles.decorator';
import { Roles } from '@prisma/client';
import type { Request } from 'express';
import { OutreachConfigService } from './outreach-config.service';
import { UpsertOutreachConfigDto } from './dto/upsert-outreach-config.dto';
import { PatchOutreachConfigDto } from './dto/patch-outreach-config.dto';
import { rejectSecretTokenFields } from './reject-secret-token-fields';

@ApiTags('Admin — Outreach Config')
@ApiBearerAuth()
@RolesAuth(Roles.SUPER_ADMIN)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
@Controller('admin/tenants/:tenantId/outreach-config')
export class OutreachConfigController {
  constructor(private readonly outreachConfigService: OutreachConfigService) {}

  @Get()
  @ApiOperation({
    summary: 'Obter outreach config do tenant (404 se não houver)',
    description:
      'Devolve o model completo, incluindo leadsPerRun, headerImageUrl e sendIntervalSeconds.',
  })
  get(@Param('tenantId', ParseIntPipe) tenantId: number) {
    return this.outreachConfigService.get(tenantId);
  }

  @Put()
  @ApiOperation({
    summary: 'Upsert completo de outreach config',
    description:
      'Cria ou substitui a config. enabled=true exige tenant.active e phone preenchido. ' +
      'leadsPerRun, headerImageUrl e sendIntervalSeconds são opcionais (defaults 5 / null / 5).',
  })
  upsert(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Body() dto: UpsertOutreachConfigDto,
    @Req() req: Request,
  ) {
    rejectSecretTokenFields(req.body);
    return this.outreachConfigService.upsert(tenantId, dto);
  }

  @Patch()
  @ApiOperation({
    summary: 'Patch parcial de outreach config',
    description:
      'Altera só campos enviados (inclui leadsPerRun, headerImageUrl, sendIntervalSeconds). ' +
      'enabled=true exige tenant pronto + campos obrigatórios já persistidos.',
  })
  patch(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Body() dto: PatchOutreachConfigDto,
    @Req() req: Request,
  ) {
    rejectSecretTokenFields(req.body);
    return this.outreachConfigService.patch(tenantId, dto);
  }
}
