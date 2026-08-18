import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RolesAuth } from '@core/decorators/roles.decorator';
import { TenantActiveGuard } from '@core/guard/tenant-active.guard';
import { TenantScopeGuard } from '@core/guard/tenant-scope.guard';
import { Roles } from '@prisma/client';
import type { Request } from 'express';
import { RequestTenantScrapeTargetDto } from './dto/request-tenant-scrape-target.dto';
import { rejectSecretTokenFields } from './reject-secret-token-fields';
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
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Listar scrape targets vinculados ao tenant',
    description:
      'Só vínculos TenantScrapeTarget deste tenant, com city e enabled. ' +
      'Targets sem vínculo não aparecem. Lista global permanece em /platform/scrape-targets.',
  })
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
  request(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Body() dto: RequestTenantScrapeTargetDto,
    @Req() req: Request,
  ) {
    rejectSecretTokenFields(req.body);
    return this.tenantScrapeTargetsService.request(tenantId, dto);
  }
}
