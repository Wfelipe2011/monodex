import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
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
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { RolesAuth } from '@core/decorators/roles.decorator';
import { TenantActiveGuard } from '@core/guard/tenant-active.guard';
import { TenantScopeGuard } from '@core/guard/tenant-scope.guard';
import { Roles } from '@prisma/client';
import type { Request } from 'express';
import { ApiTenantScopedErrors } from '../../swagger/api-route-errors.decorator';
import { RequestTenantScrapeTargetDto } from './dto/request-tenant-scrape-target.dto';
import { rejectSecretTokenFields } from './reject-secret-token-fields';
import { PatchTenantScrapeOnDemandDto } from './dto/patch-tenant-scrape-on-demand.dto';
import { ScrapeTargetResponseDto } from './dto/swagger/scrape-target.swagger.dto';
import {
  TenantScrapeOnDemandPatchResultDto,
  TenantScrapeOnDemandStatusDto,
  TenantScrapeOnDemandTriggerResultDto,
} from './dto/swagger/tenant-scrape-on-demand.swagger.dto';
import { ADMIN_TENANT_ID_PARAM } from './dto/swagger/tenant-list.swagger.dto';
import { TenantScrapeOnDemandService } from './tenant-scrape-on-demand.service';
import { TenantScrapeTargetsService } from './tenant-scrape-targets.service';

@ApiTags('Tenant — Scrape')
@ApiBearerAuth()
@RolesAuth(Roles.ADMIN, Roles.SUPER_ADMIN)
@UseGuards(TenantScopeGuard, TenantActiveGuard)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
@Controller('tenant/:tenantId/scrape-targets')
export class TenantScrapeTargetsController {
  constructor(
    private readonly tenantScrapeTargetsService: TenantScrapeTargetsService,
    private readonly tenantScrapeOnDemandService: TenantScrapeOnDemandService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Listar scrape targets vinculados ao tenant',
    description:
      'Só vínculos TenantScrapeTarget deste tenant, com city e enabled. ' +
      'Targets sem vínculo não aparecem. Lista global permanece em /platform/scrape-targets.',
  })
  @ApiParam(ADMIN_TENANT_ID_PARAM)
  @ApiOkResponse({ type: ScrapeTargetResponseDto, isArray: true })
  @ApiTenantScopedErrors()
  list(@Param('tenantId', ParseIntPipe) tenantId: number) {
    return this.tenantScrapeTargetsService.list(tenantId);
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Pedir par cidade/categoria compartilhado',
    description:
      'Body `{ cityName, state?, category }` (sem enabled). Resolve/cria City, ' +
      'checa send-policy, upsert ScrapeTarget (create enabled=true; update não altera enabled) ' +
      'e upsert o vínculo do tenant. Não dispara scrape.',
  })
  @ApiParam(ADMIN_TENANT_ID_PARAM)
  @ApiOkResponse({ type: ScrapeTargetResponseDto })
  @ApiTenantScopedErrors({
    badRequest: 'Cidade fora da política de envio ou validação do body',
  })
  request(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Body() dto: RequestTenantScrapeTargetDto,
    @Req() req: Request,
  ) {
    rejectSecretTokenFields(req.body);
    return this.tenantScrapeTargetsService.request(tenantId, dto);
  }

  @Post(':targetId/on-demand')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Disparar scrape on-demand (curto) para par vinculado',
    description:
      'Valida vínculo, política de cidade, flags e quota (2/dia America/Sao_Paulo). ' +
      '409 se lock global do par; 429 se quota esgotada.',
  })
  @ApiParam(ADMIN_TENANT_ID_PARAM)
  @ApiParam({ name: 'targetId', type: Number, example: 12 })
  @ApiOkResponse({ type: TenantScrapeOnDemandTriggerResultDto })
  @ApiTenantScopedErrors({
    notFound: 'Vínculo tenant × scrape target não encontrado',
    badRequest: 'Cidade fora da política de envio do tenant',
    conflict: 'On-demand desabilitado ou scrape em andamento para o par',
  })
  triggerOnDemand(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Param('targetId', ParseIntPipe) targetId: number,
  ) {
    return this.tenantScrapeOnDemandService.trigger(tenantId, targetId);
  }

  @Get(':targetId/on-demand')
  @ApiOperation({
    summary: 'Status on-demand (quota, cursor, último run)',
  })
  @ApiParam(ADMIN_TENANT_ID_PARAM)
  @ApiParam({ name: 'targetId', type: Number, example: 12 })
  @ApiOkResponse({ type: TenantScrapeOnDemandStatusDto })
  @ApiTenantScopedErrors({
    notFound: 'Vínculo tenant × scrape target não encontrado',
  })
  getOnDemandStatus(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Param('targetId', ParseIntPipe) targetId: number,
  ) {
    return this.tenantScrapeOnDemandService.getStatus(tenantId, targetId);
  }

  @Patch(':targetId/on-demand')
  @ApiOperation({
    summary: 'Ligar/desligar on-demand do tenant neste target',
    description: 'Não altera ScrapeTarget.enabled global.',
  })
  @ApiParam(ADMIN_TENANT_ID_PARAM)
  @ApiParam({ name: 'targetId', type: Number, example: 12 })
  @ApiOkResponse({ type: TenantScrapeOnDemandPatchResultDto })
  @ApiTenantScopedErrors({
    notFound: 'Vínculo tenant × scrape target não encontrado',
    badRequest: 'Validação do body',
  })
  patchOnDemand(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Param('targetId', ParseIntPipe) targetId: number,
    @Body() dto: PatchTenantScrapeOnDemandDto,
    @Req() req: Request,
  ) {
    rejectSecretTokenFields(req.body);
    return this.tenantScrapeOnDemandService.patchEnabled(
      tenantId,
      targetId,
      dto,
    );
  }
}
