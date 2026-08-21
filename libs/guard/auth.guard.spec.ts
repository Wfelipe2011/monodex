import {
  BadRequestException,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Roles } from '@prisma/client';
import * as jwt from 'jsonwebtoken';
import { AuthGuard } from './auth.guard';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { API_KEY_ALLOWLIST_KEY } from '../decorators/api-key-allowlist.decorator';
import { hashApiKey } from '../shared/api-key';
import { PrismaService } from '../infra/prisma/prisma.service';

type MockPrisma = {
  tenantApiKey: {
    findUnique: jest.Mock;
    update: jest.Mock;
  };
};

type MockRequest = {
  user?: unknown;
  url: string;
  method: string;
  headers: Record<string, string | string[] | undefined>;
};

function mockContext(opts: {
  url?: string;
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
}): { context: ExecutionContext; request: MockRequest } {
  const request: MockRequest = {
    url: opts.url ?? '/tenant/4/conversations',
    method: opts.method ?? 'GET',
    headers: opts.headers ?? {},
    user: undefined,
  };
  const context = {
    getHandler: () => 'handler',
    getClass: () => 'class',
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
  return { context, request };
}

describe('AuthGuard', () => {
  const originalSecret = process.env.JWT_SECRET;
  let reflector: Reflector;
  let prisma: MockPrisma;
  let guard: AuthGuard;
  let metaStore: { handler: Record<string, unknown>; class: Record<string, unknown> };

  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret';
    metaStore = { handler: {}, class: {} };
    reflector = {
      getAllAndOverride: jest.fn((key: string) => {
        if (Object.prototype.hasOwnProperty.call(metaStore.handler, key)) {
          return metaStore.handler[key];
        }
        if (Object.prototype.hasOwnProperty.call(metaStore.class, key)) {
          return metaStore.class[key];
        }
        return undefined;
      }),
    } as unknown as Reflector;
    prisma = {
      tenantApiKey: {
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    guard = new AuthGuard(reflector, prisma as unknown as PrismaService);
  });

  afterEach(() => {
    process.env.JWT_SECRET = originalSecret;
  });

  function setupMeta(
    handler: Record<string, unknown>,
    classMeta: Record<string, unknown> = {},
  ) {
    metaStore.handler = handler;
    metaStore.class = classMeta;
  }

  it('rota @Public() passa sem credencial', async () => {
    setupMeta({ [IS_PUBLIC_KEY]: true });
    const { context } = mockContext({ headers: {} });
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('JWT válido autentica sem X-API-KEY', async () => {
    setupMeta({});
    const token = jwt.sign(
      { id: 1, userId: 1, userName: 'admin', tenantId: 4, roles: [Roles.ADMIN] },
      process.env.JWT_SECRET!,
    );
    const { context, request } = mockContext({
      headers: { authorization: `Bearer ${token}` },
    });
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toMatchObject({
      userId: 1,
      tenantId: 4,
      roles: [Roles.ADMIN],
    });
    expect(prisma.tenantApiKey.findUnique).not.toHaveBeenCalled();
  });

  it('chave válida com allowlist monta authKind=api_key e role ADMIN', async () => {
    setupMeta({ [API_KEY_ALLOWLIST_KEY]: true });
    const raw =
      'mdx_live_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    prisma.tenantApiKey.findUnique.mockResolvedValue({
      id: 9,
      tenantId: 4,
      revokedAt: null,
      tenant: { id: 4, apiAccessEnabled: true },
    });
    const { context, request } = mockContext({
      headers: { 'x-api-key': raw },
    });
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(prisma.tenantApiKey.findUnique).toHaveBeenCalledWith({
      where: { keyHash: hashApiKey(raw) },
      include: { tenant: { select: { id: true, apiAccessEnabled: true } } },
    });
    expect(request.user).toMatchObject({
      authKind: 'api_key',
      apiKeyId: 9,
      tenantId: 4,
      roles: [Roles.ADMIN],
      userId: 0,
      id: 0,
    });
    expect(prisma.tenantApiKey.update).toHaveBeenCalled();
  });

  it('chave válida sem metadata de allowlist → 401', async () => {
    setupMeta({});
    const raw =
      'mdx_live_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
    prisma.tenantApiKey.findUnique.mockResolvedValue({
      id: 9,
      tenantId: 4,
      revokedAt: null,
      tenant: { id: 4, apiAccessEnabled: true },
    });
    const { context } = mockContext({
      url: '/platform/tenants',
      headers: { 'x-api-key': raw },
    });
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('/platform simulado sem allowlist → 401 mesmo com chave válida', async () => {
    setupMeta({});
    prisma.tenantApiKey.findUnique.mockResolvedValue({
      id: 1,
      tenantId: 4,
      revokedAt: null,
      tenant: { id: 4, apiAccessEnabled: true },
    });
    const { context } = mockContext({
      url: '/platform/tenants/4',
      headers: {
        'x-api-key':
          'mdx_live_cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
      },
    });
    await expect(guard.canActivate(context)).rejects.toMatchObject({
      response: expect.anything(),
      status: 401,
    });
  });

  it('chave revogada → 401', async () => {
    setupMeta({ [API_KEY_ALLOWLIST_KEY]: true });
    prisma.tenantApiKey.findUnique.mockResolvedValue({
      id: 9,
      tenantId: 4,
      revokedAt: new Date(),
      tenant: { id: 4, apiAccessEnabled: true },
    });
    const { context } = mockContext({
      headers: {
        'x-api-key':
          'mdx_live_dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
      },
    });
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('apiAccessEnabled=false → 401', async () => {
    setupMeta({ [API_KEY_ALLOWLIST_KEY]: true });
    prisma.tenantApiKey.findUnique.mockResolvedValue({
      id: 9,
      tenantId: 4,
      revokedAt: null,
      tenant: { id: 4, apiAccessEnabled: false },
    });
    const { context } = mockContext({
      headers: {
        'x-api-key':
          'mdx_live_eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
      },
    });
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('JWT + X-API-KEY juntos → 400', async () => {
    setupMeta({ [API_KEY_ALLOWLIST_KEY]: true });
    const token = jwt.sign(
      { id: 1, userId: 1, tenantId: 4, roles: [Roles.ADMIN] },
      process.env.JWT_SECRET!,
    );
    const { context } = mockContext({
      headers: {
        authorization: `Bearer ${token}`,
        'x-api-key':
          'mdx_live_ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
      },
    });
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    try {
      await guard.canActivate(context);
    } catch (error) {
      expect((error as BadRequestException).getStatus()).toBe(400);
    }
    expect(prisma.tenantApiKey.findUnique).not.toHaveBeenCalled();
  });
});
