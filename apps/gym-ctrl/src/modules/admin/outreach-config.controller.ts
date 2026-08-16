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
import { rejectLegacyOutreachFields } from './reject-legacy-outreach-fields';

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
      'Devolve ids de catálogo, slotBindings, knobs de envio e relações mínimas dos templates (id, name, language, status).',
  })
  get(@Param('tenantId', ParseIntPipe) tenantId: number) {
    return this.outreachConfigService.get(tenantId);
  }

  @Put()
  @ApiOperation({
    summary: 'Upsert completo de outreach config',
    description:
      'Cria ou substitui a config. Obrigatórios: costPerLead, outreachTemplateId, notifyTemplateId, slotBindings, schedule, categories. ' +
      'Campos legado (outreachTemplateName, notifyTenantTemplateName, outreachContactText, headerImageUrl) retornam 400. ' +
      'enabled=true exige tenant ativo com phone, templates APPROVED e cobertura de slots. ' +
      'leadsPerRun e sendIntervalSeconds default 5.',
  })
  upsert(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Body() dto: UpsertOutreachConfigDto,
    @Req() req: Request,
  ) {
    rejectSecretTokenFields(req.body);
    rejectLegacyOutreachFields(req.body);
    return this.outreachConfigService.upsert(tenantId, dto);
  }

  @Patch()
  @ApiOperation({
    summary: 'Patch parcial de outreach config',
    description:
      'Altera só campos enviados. Merge com a config existente. ' +
      'Campos legado retornam 400. enabled=true exige templates APPROVED e bindings completos já persistidos ou no body.',
  })
  patch(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Body() dto: PatchOutreachConfigDto,
    @Req() req: Request,
  ) {
    rejectSecretTokenFields(req.body);
    rejectLegacyOutreachFields(req.body);
    return this.outreachConfigService.patch(tenantId, dto);
  }
}
