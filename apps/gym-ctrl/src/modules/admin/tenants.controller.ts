import {
  Body,
  Controller,
  Get,
  Param,
  ParseBoolPipe,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { RolesAuth } from '@core/decorators/roles.decorator';
import { RequestUser } from '@core/contracts/request-user';
import { Roles } from '@prisma/client';
import { TenantScopeGuard } from '@core/guard/tenant-scope.guard';
import { TenantActiveGuard } from '@core/guard/tenant-active.guard';
import { TenantsService } from './tenants.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { PatchTenantPhoneDto } from './dto/patch-tenant-phone.dto';
import { rejectForbiddenBodyKeys } from './reject-forbidden-body-keys';

@ApiTags('Platform — Tenants')
@ApiBearerAuth()
@RolesAuth(Roles.SUPER_ADMIN)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
@Controller('platform/tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar tenants' })
  @ApiQuery({
    name: 'active',
    required: false,
    type: Boolean,
    description: 'Filtrar por active',
  })
  list(
    @Query('active', new ParseBoolPipe({ optional: true })) active?: boolean,
  ) {
    return this.tenantsService.list(active);
  }

  @Post()
  @ApiOperation({ summary: 'Criar tenant' })
  create(@Body() dto: CreateTenantDto) {
    return this.tenantsService.create(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obter tenant por id' })
  getById(@Param('id', ParseIntPipe) id: number) {
    return this.tenantsService.getById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualizar tenant (incl. active)' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTenantDto,
  ) {
    return this.tenantsService.update(id, dto);
  }
}

@ApiTags('Tenant — Tenant')
@ApiBearerAuth()
@RolesAuth(Roles.ADMIN, Roles.SUPER_ADMIN)
@UseGuards(TenantScopeGuard, TenantActiveGuard)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
@Controller('tenant/:tenantId')
export class TenantSelfController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Patch()
  @ApiOperation({
    summary: 'Atualizar phone do tenant',
    description: 'Somente `{ phone }`. `active` neste path retorna 403.',
  })
  patchPhone(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Body() dto: PatchTenantPhoneDto,
    @Req() req: RequestUser,
  ) {
    rejectForbiddenBodyKeys(req.body, ['active']);
    return this.tenantsService.updatePhone(tenantId, dto.phone);
  }
}
