import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Roles } from '@prisma/client';
import { UserToken } from '../contracts/user-token';
import { TenantScopeGuard } from './tenant-scope.guard';

function mockContext(user: UserToken | undefined, tenantId: string): ExecutionContext {
  const request = {
    user,
    params: { tenantId },
  };
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as ExecutionContext;
}

describe('TenantScopeGuard', () => {
  const guard = new TenantScopeGuard();

  it('ADMIN tenant 4 em :tenantId=9 → 403', () => {
    const admin = new UserToken(1, 1, 'admin', 4, [Roles.ADMIN]);
    expect(() => guard.canActivate(mockContext(admin, '9'))).toThrow(
      ForbiddenException,
    );
    try {
      guard.canActivate(mockContext(admin, '9'));
      fail('expected ForbiddenException');
    } catch (error) {
      expect((error as ForbiddenException).getStatus()).toBe(403);
    }
  });

  it('SUPER_ADMIN qualquer tenantId → passa', () => {
    const superAdmin = new UserToken(2, 2, 'sa', 1, [Roles.SUPER_ADMIN]);
    expect(guard.canActivate(mockContext(superAdmin, '9'))).toBe(true);
    expect(guard.canActivate(mockContext(superAdmin, '4'))).toBe(true);
  });

  it('ADMIN no próprio tenant → passa', () => {
    const admin = new UserToken(1, 1, 'admin', 4, [Roles.ADMIN]);
    expect(guard.canActivate(mockContext(admin, '4'))).toBe(true);
  });
});
