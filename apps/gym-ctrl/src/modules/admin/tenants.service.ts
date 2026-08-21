import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@core/infra/prisma/prisma.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';

const tenantSelect = {
  id: true,
  name: true,
  phone: true,
  uuid: true,
  active: true,
  apiAccessEnabled: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.TenantSelect;

@Injectable()
export class TenantsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(active?: boolean) {
    return this.prisma.tenant.findMany({
      where: active === undefined ? undefined : { active },
      select: tenantSelect,
      orderBy: { id: 'asc' },
    });
  }

  async create(dto: CreateTenantDto) {
    try {
      return await this.prisma.tenant.create({
        data: {
          name: dto.name,
          phone: dto.phone,
          active: dto.active ?? true,
        },
        select: tenantSelect,
      });
    } catch (error) {
      this.rethrowUnique(error);
    }
  }

  async getById(id: number) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      select: tenantSelect,
    });
    if (!tenant) throw new NotFoundException(`Tenant ${id} não encontrado`);
    return tenant;
  }

  async update(id: number, dto: UpdateTenantDto) {
    await this.getById(id);
    try {
      return await this.prisma.tenant.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
          ...(dto.active !== undefined ? { active: dto.active } : {}),
          ...(dto.apiAccessEnabled !== undefined
            ? { apiAccessEnabled: dto.apiAccessEnabled }
            : {}),
        },
        select: tenantSelect,
      });
    } catch (error) {
      this.rethrowUnique(error);
    }
  }

  async updatePhone(id: number, phone: string) {
    await this.getById(id);
    try {
      return await this.prisma.tenant.update({
        where: { id },
        data: { phone },
        select: tenantSelect,
      });
    } catch (error) {
      this.rethrowUnique(error);
    }
  }

  private rethrowUnique(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException('Valor único já em uso (phone)');
    }
    throw error;
  }
}
