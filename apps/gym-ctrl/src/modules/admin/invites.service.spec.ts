import {
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { GUARDS_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { InvitePurpose, Prisma, Roles } from '@prisma/client';
import { IS_PUBLIC_KEY } from '@core/decorators/public.decorator';
import { ROLES_KEY } from '@core/decorators/roles.decorator';
import { TenantActiveGuard } from '@core/guard/tenant-active.guard';
import { TenantScopeGuard } from '@core/guard/tenant-scope.guard';
import { hashInviteToken, INVITE_TOKEN_LENGTH } from '@core/shared/invite-token';
import * as bcrypt from 'bcrypt';
import { DECORATORS } from '@nestjs/swagger/dist/constants';
import {
  InvitesController,
  TenantInvitesController,
} from './invites.controller';
import { PublicInvitesController } from './public-invites.controller';
import { deriveInviteStatus, InvitesService } from './invites.service';
import { UsersService } from './users.service';

const TENANT_ID = 4;
const OPERATOR_ID = 1;
const NOW = new Date('2026-08-19T14:00:00.000Z');
const EXPIRES = new Date('2026-08-19T22:00:00.000Z');

describe('InvitesController metadata', () => {
  it('platform: path, SUPER_ADMIN e tag Swagger', () => {
    expect(Reflect.getMetadata(PATH_METADATA, InvitesController)).toBe(
      'platform/tenants/:tenantId/invites',
    );
    expect(Reflect.getMetadata(ROLES_KEY, InvitesController)).toEqual([
      Roles.SUPER_ADMIN,
    ]);
    expect(Reflect.getMetadata(DECORATORS.API_TAGS, InvitesController)).toEqual([
      'Platform — Tenant Invites',
    ]);
  });

  it('tenant: path, ADMIN+SUPER_ADMIN, guards de escopo/ativo e tag Swagger', () => {
    expect(Reflect.getMetadata(PATH_METADATA, TenantInvitesController)).toBe(
      'tenant/:tenantId/invites',
    );
    expect(Reflect.getMetadata(ROLES_KEY, TenantInvitesController)).toEqual([
      Roles.ADMIN,
      Roles.SUPER_ADMIN,
    ]);
    expect(
      Reflect.getMetadata(GUARDS_METADATA, TenantInvitesController),
    ).toEqual([TenantScopeGuard, TenantActiveGuard]);
    expect(
      Reflect.getMetadata(DECORATORS.API_TAGS, TenantInvitesController),
    ).toEqual(['Tenant — Invites']);
  });
});

describe('PublicInvitesController metadata', () => {
  it('path público, @Public nos handlers, sem RolesAuth e tag Swagger', () => {
    expect(Reflect.getMetadata(PATH_METADATA, PublicInvitesController)).toBe(
      'public/invites',
    );
    expect(
      Reflect.getMetadata(PATH_METADATA, PublicInvitesController.prototype.preview),
    ).toBe(':token');
    expect(
      Reflect.getMetadata(PATH_METADATA, PublicInvitesController.prototype.accept),
    ).toBe(':token/accept');
    expect(
      Reflect.getMetadata(IS_PUBLIC_KEY, PublicInvitesController.prototype.preview),
    ).toBe(true);
    expect(
      Reflect.getMetadata(IS_PUBLIC_KEY, PublicInvitesController.prototype.accept),
    ).toBe(true);
    expect(Reflect.getMetadata(ROLES_KEY, PublicInvitesController)).toBeUndefined();
    expect(
      Reflect.getMetadata(ROLES_KEY, PublicInvitesController.prototype.preview),
    ).toBeUndefined();
    expect(
      Reflect.getMetadata(ROLES_KEY, PublicInvitesController.prototype.accept),
    ).toBeUndefined();
    expect(
      Reflect.getMetadata(DECORATORS.API_TAGS, PublicInvitesController),
    ).toEqual(['Public — Invites']);
  });
});

describe('deriveInviteStatus', () => {
  it('prioridade consumed > revoked > expired > pending', () => {
    expect(
      deriveInviteStatus(
        { consumedAt: NOW, revokedAt: NOW, expiresAt: EXPIRES },
        NOW,
      ),
    ).toBe('CONSUMED');
    expect(
      deriveInviteStatus(
        { consumedAt: null, revokedAt: NOW, expiresAt: EXPIRES },
        NOW,
      ),
    ).toBe('REVOKED');
    expect(
      deriveInviteStatus(
        { consumedAt: null, revokedAt: null, expiresAt: NOW },
        NOW,
      ),
    ).toBe('EXPIRED');
    expect(
      deriveInviteStatus(
        { consumedAt: null, revokedAt: null, expiresAt: EXPIRES },
        NOW,
      ),
    ).toBe('PENDING');
  });
});

describe('InvitesService', () => {
  function build(opts?: {
    userCount?: number;
    config?: Record<string, unknown>;
    invites?: Array<Record<string, unknown>>;
    liveInvite?: Record<string, unknown> | null;
    createUserError?: Error;
  }) {
    const created: Array<Record<string, unknown>> = [];
    const createdUsers: Array<Record<string, unknown>> = [];
    const prisma = {
      tenant: {
        findUnique: jest.fn(async ({ where: { id } }: { where: { id: number } }) =>
          id === TENANT_ID ? { id } : null,
        ),
      },
      user: {
        count: jest.fn().mockResolvedValue(opts?.userCount ?? 0),
        create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
          if (opts?.createUserError) throw opts.createUserError;
          const row = {
            id: 10,
            name: data.name,
            username: data.username,
            email: data.email,
            roles: data.roles,
            uuid: 'uuid',
            tenantId: data.tenantId,
            createdAt: NOW,
            updatedAt: NOW,
          };
          createdUsers.push(row);
          return row;
        }),
      },
      invite: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        create: jest.fn(
          async ({ data }: { data: Record<string, unknown> }) => {
            const row = {
              id: created.length + 1,
              tenantId: data.tenantId,
              purpose: data.purpose,
              expiresAt: data.expiresAt,
              consumedAt: null,
              revokedAt: null,
              createdByUserId: data.createdByUserId,
              createdAt: NOW,
              updatedAt: NOW,
            };
            created.push({ ...row, tokenHash: data.tokenHash });
            return row;
          },
        ),
        findMany: jest.fn().mockResolvedValue(opts?.invites ?? []),
        findFirst: jest.fn(),
        findUnique: jest.fn().mockResolvedValue(opts?.liveInvite ?? null),
        update: jest.fn(),
      },
      $transaction: jest.fn(async (fn: (tx: unknown) => unknown) => fn(prisma)),
    };
    const config = {
      get: jest.fn((key: string) => opts?.config?.[key]),
    };
    const auth = {
      issueJwt: jest.fn((user: { id: number }) => ({ token: `jwt-${user.id}` })),
    };
    const service = new InvitesService(
      prisma as never,
      config as never,
      auth as never,
    );
    return { service, prisma, created, createdUsers, auth };
  }

  it('issue FIRST_ADMIN com count 0 devolve token curto e purpose FIRST_ADMIN', async () => {
    const { service, prisma, created } = build({ userCount: 0 });

    const issued = await service.issueFirstAdmin(TENANT_ID, OPERATOR_ID);

    expect(issued.purpose).toBe(InvitePurpose.FIRST_ADMIN);
    expect(issued.token).toHaveLength(INVITE_TOKEN_LENGTH);
    expect(issued.url).toBe(`/convite/${issued.token}`);
    expect(issued.expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(prisma.invite.create).toHaveBeenCalledTimes(1);
    expect(created[0].tokenHash).toBe(hashInviteToken(issued.token));
    expect(created[0].tokenHash).not.toBe(issued.token);
  });

  it('issue FIRST_ADMIN com users existentes → 409 e não persiste', async () => {
    const { service, prisma } = build({ userCount: 2 });

    const err = await service
      .issueFirstAdmin(TENANT_ID, OPERATOR_ID)
      .catch((e) => e);

    expect(err).toBeInstanceOf(ConflictException);
    expect(err.getStatus()).toBe(HttpStatus.CONFLICT);
    expect(prisma.invite.create).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('reissue FIRST_ADMIN marca o pendente anterior com revokedAt', async () => {
    const { service, prisma } = build({ userCount: 0 });

    await service.issueFirstAdmin(TENANT_ID, OPERATOR_ID);

    expect(prisma.invite.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: TENANT_ID,
          purpose: InvitePurpose.FIRST_ADMIN,
          consumedAt: null,
          revokedAt: null,
        }),
        data: expect.objectContaining({
          revokedAt: expect.any(Date),
        }),
      }),
    );
    expect(prisma.invite.create).toHaveBeenCalledTimes(1);
  });

  it('list não devolve token nem tokenHash no mapper', async () => {
    const { service } = build({
      invites: [
        {
          id: 9,
          tenantId: TENANT_ID,
          purpose: InvitePurpose.FIRST_ADMIN,
          tokenHash: 'abc123should-not-leak',
          expiresAt: EXPIRES,
          consumedAt: null,
          revokedAt: null,
          createdByUserId: OPERATOR_ID,
          createdAt: NOW,
          updatedAt: NOW,
        },
      ],
    });

    const items = await service.listByTenant(
      TENANT_ID,
      InvitePurpose.FIRST_ADMIN,
    );

    expect(items).toHaveLength(1);
    expect(items[0].id).toBe(9);
    expect(items[0].purpose).toBe(InvitePurpose.FIRST_ADMIN);
    expect(items[0].status).toBe('PENDING');
    expect(items[0]).not.toHaveProperty('token');
    expect(items[0]).not.toHaveProperty('tokenHash');
    expect(JSON.stringify(items[0])).not.toContain('abc123should-not-leak');
  });

  it('issue TENANT_USER com SUPER_ADMIN → 403 e não persiste', async () => {
    const { service, prisma } = build();

    const err = await service
      .issueTenantUser(TENANT_ID, OPERATOR_ID, [Roles.SUPER_ADMIN])
      .catch((e) => e);

    expect(err).toBeInstanceOf(ForbiddenException);
    expect(err.getStatus()).toBe(HttpStatus.FORBIDDEN);
    expect(err.message).toBe('Acesso não permitido');
    expect(prisma.invite.create).not.toHaveBeenCalled();
    expect(prisma.tenant.findUnique).not.toHaveBeenCalled();
  });

  it('revoke TENANT_USER com SUPER_ADMIN → 403 e não persiste', async () => {
    const { service, prisma } = build();

    const err = await service
      .revoke(TENANT_ID, 3, InvitePurpose.TENANT_USER, [Roles.SUPER_ADMIN])
      .catch((e) => e);

    expect(err).toBeInstanceOf(ForbiddenException);
    expect(err.getStatus()).toBe(HttpStatus.FORBIDDEN);
    expect(prisma.invite.findFirst).not.toHaveBeenCalled();
    expect(prisma.invite.update).not.toHaveBeenCalled();
  });

  it('dois issue TENANT_USER seguidos deixam dois PENDING (não revoga o anterior)', async () => {
    const { service, prisma, created } = build();

    const first = await service.issueTenantUser(TENANT_ID, OPERATOR_ID, [
      Roles.ADMIN,
    ]);
    const second = await service.issueTenantUser(TENANT_ID, OPERATOR_ID, [
      Roles.ADMIN,
    ]);

    expect(first.purpose).toBe(InvitePurpose.TENANT_USER);
    expect(second.purpose).toBe(InvitePurpose.TENANT_USER);
    expect(first.token).not.toBe(second.token);
    expect(prisma.invite.create).toHaveBeenCalledTimes(2);
    expect(prisma.invite.updateMany).not.toHaveBeenCalled();
    expect(created).toHaveLength(2);
    expect(created.every((row) => row.revokedAt == null)).toBe(true);
  });

  it('INVITE_PUBLIC_BASE_URL com barra final vira url absoluta sem duplicar /', async () => {
    const { service } = build({
      config: { INVITE_PUBLIC_BASE_URL: 'https://app.exemplo.com/' },
    });

    const issued = await service.issueFirstAdmin(TENANT_ID, OPERATOR_ID);

    expect(issued.url).toBe(`https://app.exemplo.com/convite/${issued.token}`);
  });
});

describe('InvitesService preview/accept', () => {
  const RAW_TOKEN = 'A3K7N2PQ';
  const IP = '203.0.113.10';
  const acceptDto = {
    name: 'Maria Silva',
    username: 'maria.admin',
    email: 'maria@academia.com',
    password: 'senha-segura',
  };

  function liveInvite(
    purpose: InvitePurpose,
    overrides: Record<string, unknown> = {},
  ) {
    return {
      id: 12,
      tenantId: TENANT_ID,
      purpose,
      expiresAt: EXPIRES,
      consumedAt: null,
      revokedAt: null,
      createdByUserId: OPERATOR_ID,
      createdAt: NOW,
      updatedAt: NOW,
      tenant: { id: TENANT_ID, name: 'Academia Centro', active: true },
      ...overrides,
    };
  }

  function buildPublic(opts?: {
    userCount?: number;
    liveInvite?: Record<string, unknown> | null;
    createUserError?: Error;
  }) {
    const prisma = {
      tenant: {
        findUnique: jest.fn(async ({ where: { id } }: { where: { id: number } }) =>
          id === TENANT_ID ? { id } : null,
        ),
      },
      user: {
        count: jest.fn().mockResolvedValue(opts?.userCount ?? 0),
        create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
          if (opts?.createUserError) throw opts.createUserError;
          return {
            id: 10,
            name: data.name,
            username: data.username,
            email: data.email,
            roles: data.roles,
            uuid: 'uuid',
            tenantId: data.tenantId,
            createdAt: NOW,
            updatedAt: NOW,
          };
        }),
      },
      invite: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn().mockResolvedValue(
          opts?.liveInvite === undefined ? null : opts.liveInvite,
        ),
        update: jest.fn(),
      },
      $transaction: jest.fn(async (fn: (tx: unknown) => unknown) => fn(prisma)),
    };
    const config = { get: jest.fn() };
    const auth = {
      issueJwt: jest.fn((user: { id: number }) => ({ token: `jwt-${user.id}` })),
    };
    const service = new InvitesService(
      prisma as never,
      config as never,
      auth as never,
    );
    return { service, prisma, auth };
  }

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('preview PENDING devolve purpose, tenantName, tenantId e expiresAt', async () => {
    const invite = liveInvite(InvitePurpose.FIRST_ADMIN);
    const { service, prisma } = buildPublic({ liveInvite: invite });

    await expect(service.preview(RAW_TOKEN, IP)).resolves.toEqual({
      purpose: InvitePurpose.FIRST_ADMIN,
      tenantName: 'Academia Centro',
      tenantId: TENANT_ID,
      expiresAt: EXPIRES,
    });
    expect(prisma.invite.findUnique).toHaveBeenCalledWith({
      where: { tokenHash: hashInviteToken(RAW_TOKEN) },
      select: expect.objectContaining({ tenant: expect.any(Object) }),
    });
  });

  it('preview/accept hash lookup miss → NotFoundException genérico', async () => {
    const { service, prisma } = buildPublic({ liveInvite: null });

    const previewErr = await service.preview(RAW_TOKEN, IP).catch((e) => e);
    expect(previewErr).toBeInstanceOf(NotFoundException);
    expect(previewErr.getStatus()).toBe(HttpStatus.NOT_FOUND);
    expect(previewErr.message).toBe('Convite não encontrado');

    const { service: acceptService, prisma: acceptPrisma } = buildPublic({
      liveInvite: null,
    });
    const acceptErr = await acceptService
      .accept(RAW_TOKEN, acceptDto, '203.0.113.11')
      .catch((e) => e);
    expect(acceptErr).toBeInstanceOf(NotFoundException);
    expect(acceptErr.message).toBe('Convite não encontrado');
    expect(acceptPrisma.user.create).not.toHaveBeenCalled();
    expect(prisma.invite.update).not.toHaveBeenCalled();
  });

  it('token expirado → 404 (não 410)', async () => {
    const { service, prisma } = buildPublic({
      liveInvite: liveInvite(InvitePurpose.FIRST_ADMIN, {
        expiresAt: new Date('2020-01-01T00:00:00.000Z'),
      }),
    });

    const err = await service.preview(RAW_TOKEN, IP).catch((e) => e);
    expect(err).toBeInstanceOf(NotFoundException);
    expect(err.getStatus()).toBe(HttpStatus.NOT_FOUND);
    expect(err.message).toBe('Convite não encontrado');
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('accept FIRST_ADMIN cria ADMIN, consome o invite e emite JWT', async () => {
    const { service, prisma, auth } = buildPublic({
      userCount: 0,
      liveInvite: liveInvite(InvitePurpose.FIRST_ADMIN),
    });
    jest.spyOn(bcrypt, 'hash').mockResolvedValue('hashed' as never);

    await expect(service.accept(RAW_TOKEN, acceptDto, IP)).resolves.toEqual({
      token: 'jwt-10',
    });

    expect(bcrypt.hash).toHaveBeenCalledWith(acceptDto.password, 10);
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: 'maria@academia.com',
          roles: [Roles.ADMIN],
          tenantId: TENANT_ID,
          password: 'hashed',
        }),
      }),
    );
    expect(prisma.invite.update).toHaveBeenCalledWith({
      where: { id: 12 },
      data: { consumedAt: expect.any(Date) },
    });
    expect(auth.issueJwt).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 10,
        roles: [Roles.ADMIN],
        tenantId: TENANT_ID,
      }),
    );
  });

  it('accept TENANT_USER cria USER (sem ADMIN/SUPER_ADMIN) e emite JWT', async () => {
    const { service, prisma, auth } = buildPublic({
      liveInvite: liveInvite(InvitePurpose.TENANT_USER),
    });
    jest.spyOn(bcrypt, 'hash').mockResolvedValue('hashed' as never);

    await expect(service.accept(RAW_TOKEN, acceptDto, IP)).resolves.toEqual({
      token: 'jwt-10',
    });

    const createdRoles = (prisma.user.create as jest.Mock).mock.calls[0][0]
      .data.roles as Roles[];
    expect(createdRoles).toEqual([Roles.USER]);
    expect(createdRoles).not.toContain(Roles.ADMIN);
    expect(createdRoles).not.toContain(Roles.SUPER_ADMIN);
    expect(auth.issueJwt).toHaveBeenCalledTimes(1);
  });

  it('accept FIRST_ADMIN com count>0 → 409, sem create', async () => {
    const { service, prisma, auth } = buildPublic({
      userCount: 1,
      liveInvite: liveInvite(InvitePurpose.FIRST_ADMIN),
    });

    const err = await service.accept(RAW_TOKEN, acceptDto, IP).catch((e) => e);

    expect(err).toBeInstanceOf(ConflictException);
    expect(err.getStatus()).toBe(HttpStatus.CONFLICT);
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(auth.issueJwt).not.toHaveBeenCalled();
  });

  it('unique P2002 → ConflictException e sem update de consumedAt', async () => {
    const { service, prisma, auth } = buildPublic({
      liveInvite: liveInvite(InvitePurpose.TENANT_USER),
      createUserError: new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed',
        { code: 'P2002', clientVersion: '6.0.0', meta: { target: ['email'] } },
      ),
    });
    jest.spyOn(bcrypt, 'hash').mockResolvedValue('hashed' as never);

    const err = await service.accept(RAW_TOKEN, acceptDto, IP).catch((e) => e);

    expect(err).toBeInstanceOf(ConflictException);
    expect(err.getStatus()).toBe(HttpStatus.CONFLICT);
    expect(prisma.user.create).toHaveBeenCalled();
    expect(prisma.invite.update).not.toHaveBeenCalled();
    expect(auth.issueJwt).not.toHaveBeenCalled();
  });

  it('rate limit excessivo → 429', async () => {
    const { service } = buildPublic({ liveInvite: null });

    for (let i = 0; i < 20; i++) {
      await expect(service.preview(RAW_TOKEN, IP)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    }

    const err = await service.preview(RAW_TOKEN, IP).catch((e) => e);
    expect(err).toBeInstanceOf(HttpException);
    expect(err.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
  });
});

describe('UsersService.create revoga FIRST_ADMIN pendentes', () => {
  const dto = {
    name: 'Maria',
    username: 'maria',
    email: 'maria@academia.com',
    password: 'senha-segura',
  };

  function build(userCount: number) {
    const createdUser = {
      id: 10,
      name: dto.name,
      username: dto.username,
      email: dto.email,
      roles: [Roles.ADMIN],
      uuid: 'uuid',
      tenantId: TENANT_ID,
      createdAt: NOW,
      updatedAt: NOW,
    };
    const prisma = {
      tenant: {
        findUnique: jest.fn().mockResolvedValue({ id: TENANT_ID }),
      },
      user: {
        count: jest.fn().mockResolvedValue(userCount),
        create: jest.fn().mockResolvedValue(createdUser),
      },
      invite: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const service = new UsersService(prisma as never);
    return { service, prisma, createdUser };
  }

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('após create-com-senha, updateMany revoga FIRST_ADMIN pendentes daquele tenant', async () => {
    const { service, prisma, createdUser } = build(0);
    jest.spyOn(bcrypt, 'hash').mockResolvedValue('hashed' as never);

    await expect(service.create(TENANT_ID, dto)).resolves.toEqual(createdUser);

    expect(prisma.invite.updateMany).toHaveBeenCalledWith({
      where: {
        tenantId: TENANT_ID,
        purpose: InvitePurpose.FIRST_ADMIN,
        consumedAt: null,
        revokedAt: null,
      },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('create-com-senha continua 403 se já existe user e não revoga', async () => {
    const { service, prisma } = build(1);

    const err = await service.create(TENANT_ID, dto).catch((e) => e);

    expect(err).toBeInstanceOf(ForbiddenException);
    expect(err.getStatus()).toBe(HttpStatus.FORBIDDEN);
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(prisma.invite.updateMany).not.toHaveBeenCalled();
  });
});
