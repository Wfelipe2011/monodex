import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
  UsePipes,
  ValidationPipe,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RolesAuth } from '@core/decorators/roles.decorator';
import { RequestUser } from '@core/contracts/request-user';
import { Roles } from '@prisma/client';
import { TenantScopeGuard } from '@core/guard/tenant-scope.guard';
import { TenantActiveGuard } from '@core/guard/tenant-active.guard';
import { UsersService } from './users.service';
import { CreateTenantUserDto } from './dto/create-tenant-user.dto';
import { UpdateTenantUserDto } from './dto/update-tenant-user.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

@ApiTags('Platform — Tenant Users')
@ApiBearerAuth()
@RolesAuth(Roles.SUPER_ADMIN)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
@Controller('platform/tenants/:tenantId/users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'Listar users do tenant (sem password)' })
  list(@Param('tenantId', ParseIntPipe) tenantId: number) {
    return this.usersService.listByTenant(tenantId);
  }

  @Post()
  @ApiOperation({
    summary: 'Criar o primeiro user do tenant (default roles: ADMIN)',
    description:
      'Permitido somente se o tenant ainda não tiver users. PATCH e reset de senha ficam na superfície /tenant.',
  })
  create(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Body() dto: CreateTenantUserDto,
  ) {
    return this.usersService.create(tenantId, dto);
  }
}

@ApiTags('Tenant — Users')
@ApiBearerAuth()
@RolesAuth(Roles.ADMIN, Roles.SUPER_ADMIN)
@UseGuards(TenantScopeGuard, TenantActiveGuard)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
@Controller('tenant/:tenantId/users')
export class TenantUsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'Listar users do tenant (sem password)' })
  list(@Param('tenantId', ParseIntPipe) tenantId: number) {
    return this.usersService.listByTenant(tenantId);
  }

  @Post()
  @ApiOperation({
    summary: 'Criar user adicional do tenant (default roles: ADMIN)',
    description:
      'Admin do tenant. Super Admin sempre 403 (primeiro user é /platform).',
  })
  create(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Body() dto: CreateTenantUserDto,
    @Req() req: RequestUser,
  ) {
    return this.usersService.createByTenantAdmin(
      tenantId,
      dto,
      req.user.roles,
    );
  }

  @Patch(':userId')
  @ApiOperation({ summary: 'Atualizar nome/roles de um user do tenant' })
  update(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Param('userId', ParseIntPipe) userId: number,
    @Body() dto: UpdateTenantUserDto,
    @Req() req: RequestUser,
  ) {
    return this.usersService.update(
      tenantId,
      userId,
      dto,
      req.user.roles,
    );
  }

  @Post(':userId/reset-password')
  @ApiOperation({ summary: 'Resetar senha de um user do tenant' })
  resetPassword(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Param('userId', ParseIntPipe) userId: number,
    @Body() dto: ResetPasswordDto,
    @Req() req: RequestUser,
  ) {
    return this.usersService.resetPassword(
      tenantId,
      userId,
      dto,
      req.user.roles,
    );
  }
}
