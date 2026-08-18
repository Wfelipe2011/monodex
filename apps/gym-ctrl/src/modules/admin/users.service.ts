import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Roles } from '@prisma/client';
import { PrismaService } from '@core/infra/prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { CreateTenantUserDto } from './dto/create-tenant-user.dto';
import { UpdateTenantUserDto } from './dto/update-tenant-user.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

const BCRYPT_ROUNDS = 10;

const userSelect = {
  id: true,
  name: true,
  username: true,
  email: true,
  roles: true,
  uuid: true,
  tenantId: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async listByTenant(tenantId: number) {
    await this.ensureTenant(tenantId);
    return this.prisma.user.findMany({
      where: { tenantId },
      select: userSelect,
      orderBy: { id: 'asc' },
    });
  }

  async create(tenantId: number, dto: CreateTenantUserDto) {
    await this.ensureTenant(tenantId);
    const existingCount = await this.prisma.user.count({ where: { tenantId } });
    if (existingCount > 0) {
      throw new ForbiddenException('Acesso não permitido');
    }
    const roles = dto.roles ?? [Roles.ADMIN];
    this.rejectSuperAdmin(roles);

    const hashed = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    try {
      return await this.prisma.user.create({
        data: {
          name: dto.name,
          username: dto.username,
          email: dto.email.toLowerCase(),
          password: hashed,
          roles,
          tenantId,
        },
        select: userSelect,
      });
    } catch (error) {
      this.rethrowUnique(error);
    }
  }

  async createByTenantAdmin(
    tenantId: number,
    dto: CreateTenantUserDto,
    roles: Roles[],
  ) {
    if (roles?.includes(Roles.SUPER_ADMIN)) {
      throw new ForbiddenException('Acesso não permitido');
    }
    await this.ensureTenant(tenantId);
    const userRoles = dto.roles ?? [Roles.ADMIN];
    this.rejectSuperAdmin(userRoles);

    const hashed = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    try {
      return await this.prisma.user.create({
        data: {
          name: dto.name,
          username: dto.username,
          email: dto.email.toLowerCase(),
          password: hashed,
          roles: userRoles,
          tenantId,
        },
        select: userSelect,
      });
    } catch (error) {
      this.rethrowUnique(error);
    }
  }

  async update(
    tenantId: number,
    userId: number,
    dto: UpdateTenantUserDto,
    roles: Roles[],
  ) {
    if (roles?.includes(Roles.SUPER_ADMIN)) {
      throw new ForbiddenException('Acesso não permitido');
    }
    await this.getTenantUser(tenantId, userId);
    if (dto.roles !== undefined) {
      this.rejectSuperAdmin(dto.roles);
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.roles !== undefined ? { roles: dto.roles } : {}),
      },
      select: userSelect,
    });
  }

  async resetPassword(
    tenantId: number,
    userId: number,
    dto: ResetPasswordDto,
    roles: Roles[],
  ) {
    if (roles?.includes(Roles.SUPER_ADMIN)) {
      throw new ForbiddenException('Acesso não permitido');
    }
    await this.getTenantUser(tenantId, userId);
    const hashed = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    return this.prisma.user.update({
      where: { id: userId },
      data: { password: hashed },
      select: userSelect,
    });
  }

  private rejectSuperAdmin(roles: Roles[]) {
    if (roles.includes(Roles.SUPER_ADMIN)) {
      throw new BadRequestException(
        'SUPER_ADMIN não é permitido em usuários de tenant',
      );
    }
  }

  private async ensureTenant(tenantId: number) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true },
    });
    if (!tenant) throw new NotFoundException(`Tenant ${tenantId} não encontrado`);
  }

  private async getTenantUser(tenantId: number, userId: number) {
    await this.ensureTenant(tenantId);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: userSelect,
    });
    if (!user || user.tenantId !== tenantId) {
      throw new NotFoundException(
        `User ${userId} não encontrado no tenant ${tenantId}`,
      );
    }
    return user;
  }

  private rethrowUnique(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      const target = Array.isArray(error.meta?.target)
        ? (error.meta.target as string[]).join(', ')
        : String(error.meta?.target ?? 'email/username');
      throw new ConflictException(`Valor único já em uso (${target})`);
    }
    throw error;
  }
}
