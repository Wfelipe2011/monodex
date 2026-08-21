import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  apiKeyPrefix,
  generateApiKey,
  hashApiKey,
} from '@core/shared/api-key';
import { ApiKeysService } from './api-keys.service';

jest.mock('@core/shared/api-key', () => {
  const actual = jest.requireActual('@core/shared/api-key');
  return {
    ...actual,
    generateApiKey: jest.fn(),
  };
});

describe('ApiKeysService', () => {
  const rawKey = 'mdx_live_' + 'a'.repeat(64);
  const now = new Date('2026-08-21T12:00:00.000Z');

  beforeEach(() => {
    jest.mocked(generateApiKey).mockReturnValue(rawKey);
    jest.useFakeTimers().setSystemTime(now);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  function build(opts?: {
    apiAccessEnabled?: boolean;
    keys?: Array<{
      id: number;
      name: string;
      prefix: string;
      keyHash: string;
      lastUsedAt: Date | null;
      revokedAt: Date | null;
      createdAt: Date;
    }>;
  }) {
    const apiAccessEnabled = opts?.apiAccessEnabled ?? true;
    const keys = [...(opts?.keys ?? [])];
    let nextId = keys.reduce((max, k) => Math.max(max, k.id), 0) + 1;

    const prisma = {
      tenant: {
        findUnique: jest.fn(async ({ where: { id } }: { where: { id: number } }) =>
          id === 99
            ? null
            : { id, apiAccessEnabled },
        ),
      },
      tenantApiKey: {
        findMany: jest.fn(async () =>
          keys.map(({ keyHash: _h, ...rest }) => rest),
        ),
        count: jest.fn(
          async ({
            where,
          }: {
            where: { tenantId: number; revokedAt: null };
          }) => keys.filter((k) => k.revokedAt === where.revokedAt).length,
        ),
        create: jest.fn(
          async ({
            data,
            select,
          }: {
            data: {
              tenantId: number;
              name: string;
              prefix: string;
              keyHash: string;
            };
            select: Record<string, boolean>;
          }) => {
            const row = {
              id: nextId++,
              tenantId: data.tenantId,
              name: data.name,
              prefix: data.prefix,
              keyHash: data.keyHash,
              lastUsedAt: null,
              revokedAt: null,
              createdAt: now,
              updatedAt: now,
            };
            keys.push(row);
            return Object.fromEntries(
              Object.keys(select)
                .filter((k) => select[k])
                .map((k) => [k, (row as Record<string, unknown>)[k]]),
            );
          },
        ),
        findFirst: jest.fn(
          async ({
            where: { id, tenantId },
          }: {
            where: { id: number; tenantId: number };
          }) => {
            const row = keys.find((k) => k.id === id);
            if (!row) return null;
            const { keyHash: _h, ...rest } = row as typeof keys[0] & {
              tenantId?: number;
            };
            void tenantId;
            return rest;
          },
        ),
        update: jest.fn(
          async ({
            where: { id },
            data,
          }: {
            where: { id: number };
            data: { revokedAt: Date };
          }) => {
            const idx = keys.findIndex((k) => k.id === id);
            keys[idx] = { ...keys[idx], revokedAt: data.revokedAt };
            const { keyHash: _h, ...rest } = keys[idx];
            return rest;
          },
        ),
      },
    };

    return { service: new ApiKeysService(prisma as never), prisma, keys };
  }

  it('create 201 shape inclui raw key e persiste só hash', async () => {
    const { service, prisma } = build();
    const result = await service.create(4, 'crm-prod');
    expect(result).toEqual(
      expect.objectContaining({
        name: 'crm-prod',
        prefix: apiKeyPrefix(rawKey),
        key: rawKey,
        createdAt: now,
      }),
    );
    expect(result).not.toHaveProperty('keyHash');
    expect(prisma.tenantApiKey.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          keyHash: hashApiKey(rawKey),
          prefix: apiKeyPrefix(rawKey),
        }),
      }),
    );
  });

  it('list nunca devolve key nem keyHash', async () => {
    const { service } = build({
      keys: [
        {
          id: 1,
          name: 'a',
          prefix: 'mdx_live_aaaaaaaa',
          keyHash: 'deadbeef',
          lastUsedAt: null,
          revokedAt: null,
          createdAt: now,
        },
      ],
    });
    const list = await service.list(4);
    expect(list).toHaveLength(1);
    expect(list[0]).not.toHaveProperty('key');
    expect(list[0]).not.toHaveProperty('keyHash');
    expect(list[0]).toEqual(
      expect.objectContaining({
        id: 1,
        name: 'a',
        prefix: 'mdx_live_aaaaaaaa',
        lastUsedAt: null,
        revokedAt: null,
      }),
    );
  });

  it('4ª ativa → 409; após revoke, create ok', async () => {
    const active = [1, 2, 3].map((id) => ({
      id,
      name: `k${id}`,
      prefix: `mdx_live_${id}`,
      keyHash: `hash${id}`,
      lastUsedAt: null,
      revokedAt: null,
      createdAt: now,
    }));
    const { service, prisma } = build({ keys: active });
    await expect(service.create(4, 'k4')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(prisma.tenantApiKey.create).not.toHaveBeenCalled();

    await service.revoke(4, 2);
    const created = await service.create(4, 'k4');
    expect(created.key).toBe(rawKey);
    expect(prisma.tenantApiKey.create).toHaveBeenCalledTimes(1);
  });

  it('grant off → 403 no create', async () => {
    const { service, prisma } = build({ apiAccessEnabled: false });
    await expect(service.create(4, 'crm')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.tenantApiKey.create).not.toHaveBeenCalled();
  });

  it('revoke idempotente se já revogada', async () => {
    const revokedAt = new Date('2026-08-01T00:00:00.000Z');
    const { service, prisma } = build({
      keys: [
        {
          id: 1,
          name: 'old',
          prefix: 'mdx_live_bbbbbbbb',
          keyHash: 'h',
          lastUsedAt: null,
          revokedAt,
          createdAt: now,
        },
      ],
    });
    const result = await service.revoke(4, 1);
    expect(result.revokedAt).toEqual(revokedAt);
    expect(prisma.tenantApiKey.update).not.toHaveBeenCalled();
  });

  it('revoke de chave inexistente → 404', async () => {
    const { service } = build();
    await expect(service.revoke(4, 999)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
