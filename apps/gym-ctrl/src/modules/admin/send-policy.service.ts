import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@core/infra/prisma/prisma.service';
import { assertCityPolicyXor } from '@core/shared/send-policy';
import { UpsertSendPolicyDto } from './dto/upsert-send-policy.dto';

export type SendPolicyResponse = {
  allowedCityIds: number[];
  deniedCityIds: number[];
  respectAllTenants: boolean;
  exclusive: boolean;
  respectTenantIds: number[];
};

const EMPTY_POLICY: SendPolicyResponse = {
  allowedCityIds: [],
  deniedCityIds: [],
  respectAllTenants: false,
  exclusive: false,
  respectTenantIds: [],
};

@Injectable()
export class SendPolicyService {
  constructor(private readonly prisma: PrismaService) {}

  async get(tenantId: number): Promise<SendPolicyResponse> {
    await this.assertTenant(tenantId);
    const policy = await this.prisma.tenantSendPolicy.findUnique({
      where: { tenantId },
    });
    const respects = await this.prisma.tenantRespect.findMany({
      where: { tenantId },
      select: { respectedTenantId: true },
      orderBy: { respectedTenantId: 'asc' },
    });
    if (!policy) {
      return { ...EMPTY_POLICY, respectTenantIds: respects.map((r) => r.respectedTenantId) };
    }
    return {
      allowedCityIds: asIntArray(policy.allowedCityIds),
      deniedCityIds: asIntArray(policy.deniedCityIds),
      respectAllTenants: policy.respectAllTenants,
      exclusive: policy.exclusive,
      respectTenantIds: respects.map((r) => r.respectedTenantId),
    };
  }

  async upsert(
    tenantId: number,
    dto: UpsertSendPolicyDto,
  ): Promise<SendPolicyResponse> {
    await this.assertTenant(tenantId);
    assertCityPolicyXor(dto.allowedCityIds, dto.deniedCityIds);

    if (dto.respectTenantIds.includes(tenantId)) {
      throw new BadRequestException(
        'respectTenantIds não pode incluir o próprio tenantId',
      );
    }

    const uniqueRespectIds = [...new Set(dto.respectTenantIds)];
    if (uniqueRespectIds.length > 0) {
      const found = await this.prisma.tenant.findMany({
        where: { id: { in: uniqueRespectIds } },
        select: { id: true },
      });
      if (found.length !== uniqueRespectIds.length) {
        throw new BadRequestException(
          'respectTenantIds contém tenant inexistente',
        );
      }
    }

    const cityJson = (value: number[]) =>
      value as unknown as Prisma.InputJsonValue;

    await this.prisma.$transaction(async (tx) => {
      await tx.tenantSendPolicy.upsert({
        where: { tenantId },
        create: {
          tenantId,
          allowedCityIds: cityJson(dto.allowedCityIds),
          deniedCityIds: cityJson(dto.deniedCityIds),
          respectAllTenants: dto.respectAllTenants,
          exclusive: dto.exclusive,
        },
        update: {
          allowedCityIds: cityJson(dto.allowedCityIds),
          deniedCityIds: cityJson(dto.deniedCityIds),
          respectAllTenants: dto.respectAllTenants,
          exclusive: dto.exclusive,
        },
      });
      await tx.tenantRespect.deleteMany({ where: { tenantId } });
      if (uniqueRespectIds.length > 0) {
        await tx.tenantRespect.createMany({
          data: uniqueRespectIds.map((respectedTenantId) => ({
            tenantId,
            respectedTenantId,
          })),
        });
      }
    });

    return this.get(tenantId);
  }

  private async assertTenant(tenantId: number) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true },
    });
    if (!tenant) {
      throw new NotFoundException(`Tenant ${tenantId} não encontrado`);
    }
  }
}

function asIntArray(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => Number(item))
    .filter((n) => Number.isInteger(n) && n >= 1);
}
