import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseIntPipe,
  Put,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RolesAuth } from '@core/decorators/roles.decorator';
import { TenantActiveGuard } from '@core/guard/tenant-active.guard';
import { TenantScopeGuard } from '@core/guard/tenant-scope.guard';
import { Roles } from '@prisma/client';
import { UpsertSendPolicyDto } from './dto/upsert-send-policy.dto';
import { SendPolicyService } from './send-policy.service';

@ApiTags('Platform — Send Policy')
@ApiBearerAuth()
@RolesAuth(Roles.SUPER_ADMIN)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
@Controller('platform/tenants/:tenantId/send-policy')
export class SendPolicyController {
  constructor(private readonly sendPolicyService: SendPolicyService) {}

  @Get()
  @ApiOperation({
    summary: 'Obter send-policy do tenant',
    description:
      'Devolve allowedCityIds, deniedCityIds, respectAllTenants, exclusive e respectTenantIds. ' +
      'Sem row, arrays vazios e flags false.',
  })
  get(@Param('tenantId', ParseIntPipe) tenantId: number) {
    return this.sendPolicyService.get(tenantId);
  }

  @Put()
  @ApiOperation({
    summary: 'Upsert send-policy e edges TenantRespect',
    description:
      'allowedCityIds e deniedCityIds são XOR (ambos não-vazios → 400). ' +
      'respectTenantIds não pode incluir o próprio tenantId. Substitui as edges de respect.',
  })
  upsert(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Body() dto: UpsertSendPolicyDto,
  ) {
    return this.sendPolicyService.upsert(tenantId, dto);
  }
}

@ApiTags('Tenant — Send Policy')
@ApiBearerAuth()
@RolesAuth(Roles.ADMIN, Roles.SUPER_ADMIN)
@UseGuards(TenantScopeGuard, TenantActiveGuard)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
@Controller('tenant/:tenantId/send-policy')
export class TenantSendPolicyController {
  constructor(private readonly sendPolicyService: SendPolicyService) {}

  @Get()
  @ApiOperation({
    summary: 'Ler send-policy do tenant (somente leitura)',
    description:
      'Admin lê a policy do próprio tenant, incluindo flags e respectTenantIds. Sem PUT neste prefixo.',
  })
  get(@Param('tenantId', ParseIntPipe) tenantId: number) {
    return this.sendPolicyService.get(tenantId);
  }

  @Put()
  @ApiOperation({
    summary: 'Escrita de send-policy no prefixo tenant é proibida',
  })
  rejectWrite() {
    throw new ForbiddenException('Acesso não permitido');
  }
}
