import { UnauthorizedException } from '@nestjs/common';
import { PATH_METADATA } from '@nestjs/common/constants';
import { IS_PUBLIC_KEY } from '@core/decorators/public.decorator';
import { ROLES_KEY } from '@core/decorators/roles.decorator';
import * as bcrypt from 'bcrypt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

const USER_ID = 42;
const CURRENT_HASH = 'hash-atual';
const NEW_HASH = 'hash-novo';

function userRow(overrides: Partial<{ id: number; password: string }> = {}) {
  return {
    id: overrides.id ?? USER_ID,
    name: 'Maria',
    username: 'maria',
    email: 'maria@academia.com',
    password: overrides.password ?? CURRENT_HASH,
    roles: ['ADMIN'],
    tenantId: 8,
  };
}

describe('AuthController.changePassword', () => {
  it('POST /auth/change-password é autenticado: sem @Public e sem @RolesAuth', () => {
    expect(Reflect.getMetadata(PATH_METADATA, AuthController)).toBe('auth');
    expect(
      Reflect.getMetadata(PATH_METADATA, AuthController.prototype.changePassword),
    ).toBe('change-password');
    expect(
      Reflect.getMetadata(IS_PUBLIC_KEY, AuthController.prototype.changePassword),
    ).toBeUndefined();
    expect(
      Reflect.getMetadata(ROLES_KEY, AuthController.prototype.changePassword),
    ).toBeUndefined();
    expect(Reflect.getMetadata(ROLES_KEY, AuthController)).toBeUndefined();
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, AuthController.prototype.login)).toBe(
      true,
    );
  });
});

describe('AuthService.changePassword', () => {
  function build(user: ReturnType<typeof userRow> | null) {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(user),
        update: jest.fn().mockResolvedValue(user),
      },
    };
    const service = new AuthService(prisma as never, {} as never);
    return { service, prisma };
  }

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('compare true → update com hash novo (10 rounds)', async () => {
    const { service, prisma } = build(userRow());
    jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);
    jest.spyOn(bcrypt, 'hash').mockResolvedValue(NEW_HASH as never);

    await expect(
      service.changePassword(USER_ID, 'antiga-senha', 'nova-senha'),
    ).resolves.toEqual({ ok: true });

    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: USER_ID } });
    expect(bcrypt.compare).toHaveBeenCalledWith('antiga-senha', CURRENT_HASH);
    expect(bcrypt.hash).toHaveBeenCalledWith('nova-senha', 10);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: USER_ID },
      data: { password: NEW_HASH },
    });
  });

  it('compare false → throw e update não é chamado', async () => {
    const { service, prisma } = build(userRow());
    jest.spyOn(bcrypt, 'compare').mockResolvedValue(false as never);
    const hashSpy = jest.spyOn(bcrypt, 'hash');

    await expect(
      service.changePassword(USER_ID, 'senha-errada', 'nova-senha'),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(hashSpy).not.toHaveBeenCalled();
  });

  it('user id inexistente → throw e update não é chamado', async () => {
    const { service, prisma } = build(null);
    const compareSpy = jest.spyOn(bcrypt, 'compare');
    const hashSpy = jest.spyOn(bcrypt, 'hash');

    await expect(
      service.changePassword(999, 'antiga-senha', 'nova-senha'),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: 999 } });
    expect(compareSpy).not.toHaveBeenCalled();
    expect(hashSpy).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});
