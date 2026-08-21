import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Put,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RolesAuth } from '@core/decorators/roles.decorator';
import { RequestUser } from '@core/contracts/request-user';
import { Roles } from '@prisma/client';
import { TenantScopeGuard } from '@core/guard/tenant-scope.guard';
import { TenantActiveGuard } from '@core/guard/tenant-active.guard';
import { OutreachConfigService } from './outreach-config.service';
import { UpsertOutreachConfigDto } from './dto/upsert-outreach-config.dto';
import { UpsertTenantOutreachConfigDto } from './dto/upsert-tenant-outreach-config.dto';
import { PatchOutreachConfigDto } from './dto/patch-outreach-config.dto';
import { PatchPlatformOutreachConfigDto } from './dto/patch-platform-outreach-config.dto';
import { rejectSecretTokenFields } from './reject-secret-token-fields';
import { rejectLegacyOutreachFields } from './reject-legacy-outreach-fields';

@ApiTags('Platform — Outreach Config')
@ApiBearerAuth()
@RolesAuth(Roles.SUPER_ADMIN)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
@Controller('platform/tenants/:tenantId/outreach-config')
export class OutreachConfigController {
  constructor(private readonly outreachConfigService: OutreachConfigService) {}

  @Get()
  @ApiOperation({
    summary: 'Obter outreach config do tenant (404 se não houver)',
    description:
      'Devolve ids de catálogo, slotBindings, knobs de envio, relações mínimas dos templates (id, name, language, status), ' +
      'coinDebitOnStatus (sent|delivered|read, default delivered), whatsappAccountId e resolvedWhatsappAccount ' +
      '(default da plataforma se a FK for null).',
  })
  get(@Param('tenantId', ParseIntPipe) tenantId: number) {
    return this.outreachConfigService.get(tenantId);
  }

  @Put()
  @ApiOperation({
    summary: 'Bootstrap de outreach config (somente se ainda não existir)',
    description:
      'Cria a config se não houver row. Se já existir, 403 — use PATCH para preço, gatilho de débito e número. ' +
      'Body completo permitido no pontapé (inclui campos tenant-owned e whatsappAccountId opcional). ' +
      'coinDebitOnStatus omisso → delivered no schema. ' +
      'Campos legado (outreachTemplateName, notifyTenantTemplateName, outreachContactText, headerImageUrl) retornam 400. ' +
      'enabled=true exige tenant ativo com phone, templates APPROVED e cobertura de slots.',
  })
  upsert(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Body() dto: UpsertOutreachConfigDto,
    @Req() req: RequestUser,
  ) {
    rejectSecretTokenFields(req.body);
    rejectLegacyOutreachFields(req.body);
    return this.outreachConfigService.createBootstrap(
      tenantId,
      dto,
      req.user.roles,
    );
  }

  @Patch()
  @ApiOperation({
    summary:
      'Patch de preço, gatilho de débito e número WhatsApp (costPerLead / costPerOnDemandSend / cashbackOnReply / coinDebitOnStatus / whatsappAccountId)',
    description:
      'Somente campos de plataforma (preço cidade, preço on-demand, coinDebitOnStatus, número). Campos tenant-owned (enabled, schedule, categories, leadsPerRun, etc.) no body → 403. ' +
      'costPerOnDemandSend: coins por envio on-demand; 0 fecha o canal. ' +
      'coinDebitOnStatus: sent | delivered | read (failed → 400). ' +
      'whatsappAccountId null volta ao remetente default. Id da default ou número já de outro tenant → 400. ' +
      'Campos legado retornam 400.',
  })
  patch(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Body() dto: PatchPlatformOutreachConfigDto,
    @Req() req: RequestUser,
  ) {
    rejectSecretTokenFields(req.body);
    rejectLegacyOutreachFields(req.body);
    return this.outreachConfigService.patchPlatform(
      tenantId,
      dto,
      req.user.roles,
      req.body,
    );
  }
}

@ApiTags('Tenant — Outreach Config')
@ApiBearerAuth()
@RolesAuth(Roles.ADMIN, Roles.SUPER_ADMIN)
@UseGuards(TenantScopeGuard, TenantActiveGuard)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
@Controller('tenant/:tenantId/outreach-config')
export class TenantOutreachConfigController {
  constructor(private readonly outreachConfigService: OutreachConfigService) {}

  @Get()
  @ApiOperation({
    summary: 'Obter outreach config do tenant (inclui preço, gatilho e número read-only)',
    description:
      'Devolve a row completa, inclusive costPerLead/costPerOnDemandSend/cashbackOnReply, coinDebitOnStatus, whatsappAccountId e resolvedWhatsappAccount. ' +
      'Admin não altera preço (cidade ou on-demand), gatilho de débito nem número neste path.',
  })
  get(@Param('tenantId', ParseIntPipe) tenantId: number) {
    return this.outreachConfigService.get(tenantId);
  }

  @Put()
  @ApiOperation({
    summary: 'Criar outreach config se ainda não existir',
    description:
      'Cria com costPerLead=0, cashbackOnReply=0, coinDebitOnStatus=delivered (schema) e whatsappAccountId null. Se já existir, 403 — use PATCH. ' +
      'costPerLead/cashbackOnReply/coinDebitOnStatus/whatsappAccountId no body → 403. Super Admin só no pontapé (recurso ausente).',
  })
  create(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Body() dto: UpsertTenantOutreachConfigDto,
    @Req() req: RequestUser,
  ) {
    rejectSecretTokenFields(req.body);
    rejectLegacyOutreachFields(req.body);
    return this.outreachConfigService.createTenant(
      tenantId,
      dto,
      req.user.roles,
      req.body,
    );
  }

  @Patch()
  @ApiOperation({
    summary: 'Patch operacional (knobs, schedule, templates, enabled)',
    description:
      'Não aceita costPerLead/costPerOnDemandSend/cashbackOnReply/coinDebitOnStatus/whatsappAccountId (403). Super Admin só dentro da janela de 30 min. ' +
      'enabled=true exige phone, tenant ativo, templates APPROVED, grants e bindings.',
  })
  patch(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Body() dto: PatchOutreachConfigDto,
    @Req() req: RequestUser,
  ) {
    rejectSecretTokenFields(req.body);
    rejectLegacyOutreachFields(req.body);
    return this.outreachConfigService.patchTenant(
      tenantId,
      dto,
      req.user.roles,
      req.body,
    );
  }
}
