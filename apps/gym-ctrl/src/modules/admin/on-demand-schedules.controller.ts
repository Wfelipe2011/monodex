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
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { ApiKeyAllowlist } from '@core/decorators/api-key-allowlist.decorator';
import { RolesAuth } from '@core/decorators/roles.decorator';
import { RequestUser } from '@core/contracts/request-user';
import { TenantActiveGuard } from '@core/guard/tenant-active.guard';
import { TenantScopeGuard } from '@core/guard/tenant-scope.guard';
import { Roles } from '@prisma/client';
import { CreateOnDemandScheduleDto } from './dto/create-on-demand-schedule.dto';
import { ADMIN_TENANT_ID_PARAM } from './dto/swagger/tenant-list.swagger.dto';
import { OnDemandScheduleDto } from './dto/swagger/tenant-on-demand.swagger.dto';
import { OnDemandSchedulesService } from './on-demand-schedules.service';
import { rejectSecretTokenFields } from './reject-secret-token-fields';

@ApiTags('Tenant — On-Demand Schedules')
@ApiBearerAuth()
@ApiSecurity('X-API-KEY')
@ApiKeyAllowlist()
@RolesAuth(Roles.ADMIN, Roles.SUPER_ADMIN)
@UseGuards(TenantScopeGuard, TenantActiveGuard)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
@Controller('tenant/:tenantId/on-demand-schedules')
export class OnDemandSchedulesController {
  constructor(
    private readonly onDemandSchedulesService: OnDemandSchedulesService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Agendar envio on-demand (1 dest + 1 template + hora SP)',
    description:
      'Persiste PENDING sem chamar Graph. scheduledFor = início da hora em America/Sao_Paulo. ' +
      'Super Admin → 403. API key permitida.',
  })
  @ApiParam(ADMIN_TENANT_ID_PARAM)
  @ApiCreatedResponse({
    type: OnDemandScheduleDto,
    description: 'Agenda PENDING criada',
  })
  @ApiForbiddenResponse({ description: 'Super Admin ou tenant inativo' })
  @ApiNotFoundResponse({ description: 'Tenant ou template não encontrado' })
  create(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Body() dto: CreateOnDemandScheduleDto,
    @Req() req: RequestUser,
  ) {
    rejectSecretTokenFields(req.body);
    return this.onDemandSchedulesService.create(tenantId, dto, {
      roles: req.user.roles,
    });
  }

  @Get()
  @ApiOperation({
    summary: 'Listar agendas on-demand do tenant',
    description: 'Até 100 por scheduledFor asc. Super Admin pode ler.',
  })
  @ApiParam(ADMIN_TENANT_ID_PARAM)
  @ApiOkResponse({
    type: OnDemandScheduleDto,
    isArray: true,
    description: 'Lista de agendas',
  })
  @ApiNotFoundResponse({ description: 'Tenant não encontrado' })
  list(@Param('tenantId', ParseIntPipe) tenantId: number) {
    return this.onDemandSchedulesService.list(tenantId);
  }

  @Get(':scheduleId')
  @ApiOperation({ summary: 'Detalhe de uma agenda on-demand' })
  @ApiParam(ADMIN_TENANT_ID_PARAM)
  @ApiParam({ name: 'scheduleId', type: Number })
  @ApiOkResponse({ type: OnDemandScheduleDto, description: 'Agenda' })
  @ApiNotFoundResponse({ description: 'Tenant ou agenda não encontrada' })
  getById(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Param('scheduleId', ParseIntPipe) scheduleId: number,
  ) {
    return this.onDemandSchedulesService.getById(tenantId, scheduleId);
  }

  @Post(':scheduleId/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cancelar agenda PENDING',
    description: 'Só PENDING. SENT/FAILED/CANCELLED → 409. Super Admin → 403.',
  })
  @ApiParam(ADMIN_TENANT_ID_PARAM)
  @ApiParam({ name: 'scheduleId', type: Number })
  @ApiOkResponse({ type: OnDemandScheduleDto, description: 'Agenda CANCELLED' })
  @ApiConflictResponse({ description: 'Agenda não está PENDING' })
  @ApiForbiddenResponse({ description: 'Super Admin ou tenant inativo' })
  @ApiNotFoundResponse({ description: 'Tenant ou agenda não encontrada' })
  cancel(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Param('scheduleId', ParseIntPipe) scheduleId: number,
    @Req() req: RequestUser,
  ) {
    return this.onDemandSchedulesService.cancel(tenantId, scheduleId, {
      roles: req.user.roles,
    });
  }
}
