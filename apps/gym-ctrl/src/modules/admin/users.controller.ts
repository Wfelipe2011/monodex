import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RolesAuth } from '@core/decorators/roles.decorator';
import { Roles } from '@prisma/client';
import { UsersService } from './users.service';
import { CreateTenantUserDto } from './dto/create-tenant-user.dto';
import { UpdateTenantUserDto } from './dto/update-tenant-user.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

@ApiTags('Admin — Tenant Users')
@ApiBearerAuth()
@RolesAuth(Roles.SUPER_ADMIN)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
@Controller('admin/tenants/:tenantId/users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'Listar users do tenant (sem password)' })
  list(@Param('tenantId', ParseIntPipe) tenantId: number) {
    return this.usersService.listByTenant(tenantId);
  }

  @Post()
  @ApiOperation({ summary: 'Criar user do tenant (default roles: ADMIN)' })
  create(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Body() dto: CreateTenantUserDto,
  ) {
    return this.usersService.create(tenantId, dto);
  }

  @Patch(':userId')
  @ApiOperation({ summary: 'Atualizar name/roles do user do tenant' })
  update(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Param('userId', ParseIntPipe) userId: number,
    @Body() dto: UpdateTenantUserDto,
  ) {
    return this.usersService.update(tenantId, userId, dto);
  }

  @Post(':userId/reset-password')
  @ApiOperation({ summary: 'Resetar senha do user (bcrypt)' })
  resetPassword(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Param('userId', ParseIntPipe) userId: number,
    @Body() dto: ResetPasswordDto,
  ) {
    return this.usersService.resetPassword(tenantId, userId, dto);
  }
}
