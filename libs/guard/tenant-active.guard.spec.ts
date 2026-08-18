import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { TenantActiveGuard } from './tenant-active.guard';

function mockContext(method: string, tenantId = '4'): ExecutionContext {
  const request = {
    method,
    params: { tenantId },
  };
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as ExecutionContext;
}

describe('TenantActiveGuard', () => {
  const prisma = {
    tenant: {
      findUnique: jest.fn(),
    },
  };
  const guard = new TenantActiveGuard(prisma as never);

  beforeEach(() => {
    prisma.tenant.findUnique.mockReset();
  });

  it('active=false + POST → 403', async () => {
    prisma.tenant.findUnique.mockResolvedValue({ active: false });
    await expect(guard.canActivate(mockContext('POST'))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    try {
      await guard.canActivate(mockContext('POST'));
      fail('expected ForbiddenException');
    } catch (error) {
      expect((error as ForbiddenException).getStatus()).toBe(403);
    }
  });

  it('active=false + GET → passa o guard', async () => {
    prisma.tenant.findUnique.mockResolvedValue({ active: false });
    await expect(guard.canActivate(mockContext('GET'))).resolves.toBe(true);
    expect(prisma.tenant.findUnique).not.toHaveBeenCalled();
  });

  it('active=true + POST → passa', async () => {
    prisma.tenant.findUnique.mockResolvedValue({ active: true });
    await expect(guard.canActivate(mockContext('POST'))).resolves.toBe(true);
  });
});
