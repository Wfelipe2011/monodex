import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { ApiKeyAllowlist } from '@core/decorators/api-key-allowlist.decorator';
import { RolesAuth } from '@core/decorators/roles.decorator';
import { TenantActiveGuard } from '@core/guard/tenant-active.guard';
import { TenantScopeGuard } from '@core/guard/tenant-scope.guard';
import { Roles } from '@prisma/client';
import { ADMIN_TENANT_ID_PARAM } from './dto/swagger/tenant-list.swagger.dto';
import { OnDemandSendStatusDto } from './dto/swagger/tenant-on-demand.swagger.dto';
import { OnDemandSendsService } from './on-demand-sends.service';

@ApiTags('Tenant — On-Demand Sends')
@ApiBearerAuth()
@ApiSecurity('X-API-KEY')
@ApiKeyAllowlist()
@RolesAuth(Roles.ADMIN, Roles.SUPER_ADMIN)
@UseGuards(TenantScopeGuard, TenantActiveGuard)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
@Controller('tenant/:tenantId/on-demand-sends')
export class OnDemandSendsController {
  constructor(private readonly onDemandSendsService: OnDemandSendsService) {}

  @Get()
  @ApiOperation({
    summary: 'Listar envios on-demand do tenant',
    description: 'Últimos 100 por sentAt desc. Inclui lastStatus e latestError se failed.',
  })
  @ApiParam(ADMIN_TENANT_ID_PARAM)
  @ApiOkResponse({
    type: OnDemandSendStatusDto,
    isArray: true,
    description: 'Lista de envios on-demand',
  })
  @ApiNotFoundResponse({ description: 'Tenant não encontrado' })
  list(@Param('tenantId', ParseIntPipe) tenantId: number) {
    return this.onDemandSendsService.list(tenantId);
  }

  @Get(':sendId')
  @ApiOperation({ summary: 'Detalhe de um envio on-demand' })
  @ApiParam(ADMIN_TENANT_ID_PARAM)
  @ApiParam({ name: 'sendId', type: Number })
  @ApiOkResponse({ type: OnDemandSendStatusDto, description: 'Envio on-demand' })
  @ApiNotFoundResponse({ description: 'Tenant ou send não encontrado' })
  getById(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Param('sendId', ParseIntPipe) sendId: number,
  ) {
    return this.onDemandSendsService.getById(tenantId, sendId);
  }
}
