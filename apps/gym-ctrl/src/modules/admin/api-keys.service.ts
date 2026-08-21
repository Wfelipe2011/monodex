import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@core/infra/prisma/prisma.service';
import {
  apiKeyPrefix,
  generateApiKey,
  hashApiKey,
} from '@core/shared/api-key';

const apiKeyListSelect = {
  id: true,
  name: true,
  prefix: true,
  lastUsedAt: true,
  revokedAt: true,
  createdAt: true,
} satisfies Prisma.TenantApiKeySelect;

const MAX_ACTIVE_KEYS = 3;

@Injectable()
export class ApiKeysService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: number) {
    await this.ensureTenant(tenantId);
    return this.prisma.tenantApiKey.findMany({
      where: { tenantId },
      select: apiKeyListSelect,
      orderBy: { id: 'asc' },
    });
  }

  async create(tenantId: number, name: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, apiAccessEnabled: true },
    });
    if (!tenant) {
      throw new NotFoundException(`Tenant ${tenantId} não encontrado`);
    }
    if (!tenant.apiAccessEnabled) {
      throw new ForbiddenException('Acesso não permitido');
    }

    const activeCount = await this.prisma.tenantApiKey.count({
      where: { tenantId, revokedAt: null },
    });
    if (activeCount >= MAX_ACTIVE_KEYS) {
      throw new ConflictException(
        `Tenant já possui ${MAX_ACTIVE_KEYS} chaves ativas`,
      );
    }

    const raw = generateApiKey();
    const created = await this.prisma.tenantApiKey.create({
      data: {
        tenantId,
        name,
        prefix: apiKeyPrefix(raw),
        keyHash: hashApiKey(raw),
      },
      select: {
        id: true,
        name: true,
        prefix: true,
        createdAt: true,
      },
    });

    return { ...created, key: raw };
  }

  async revoke(tenantId: number, keyId: number) {
    await this.ensureTenant(tenantId);
    const existing = await this.prisma.tenantApiKey.findFirst({
      where: { id: keyId, tenantId },
      select: apiKeyListSelect,
    });
    if (!existing) {
      throw new NotFoundException(
        `API key ${keyId} não encontrada no tenant ${tenantId}`,
      );
    }
    if (existing.revokedAt != null) {
      return existing;
    }

    return this.prisma.tenantApiKey.update({
      where: { id: keyId },
      data: { revokedAt: new Date() },
      select: apiKeyListSelect,
    });
  }

  private async ensureTenant(tenantId: number) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true },
    });
    if (!tenant) {
      throw new NotFoundException(`Tenant ${tenantId} não encontrado`);
    }
  }
}
