import { ForbiddenException } from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { TenantSelfController } from './tenants.controller';

describe('TenantsService — apiAccessEnabled', () => {
  function build(opts?: { apiAccessEnabled?: boolean }) {
    const row = {
      id: 4,
      name: 'Acme',
      phone: '+5511999',
      uuid: 'uuid-4',
      active: true,
      apiAccessEnabled: opts?.apiAccessEnabled ?? false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const prisma = {
      tenant: {
        findUnique: jest.fn().mockResolvedValue(row),
        findMany: jest.fn().mockResolvedValue([row]),
        update: jest.fn(
          async ({
            data,
          }: {
            data: Record<string, unknown>;
          }) => ({ ...row, ...data }),
        ),
      },
    };

    return { service: new TenantsService(prisma as never), prisma, row };
  }

  it('Super Admin PATCH { apiAccessEnabled: true } persiste', async () => {
    const { service, prisma } = build();
    const result = await service.update(4, { apiAccessEnabled: true });
    expect(prisma.tenant.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ apiAccessEnabled: true }),
      }),
    );
    expect(result.apiAccessEnabled).toBe(true);
  });

  it('GET e list incluem apiAccessEnabled', async () => {
    const { service } = build({ apiAccessEnabled: true });
    const one = await service.getById(4);
    const list = await service.list();
    expect(one.apiAccessEnabled).toBe(true);
    expect(list[0].apiAccessEnabled).toBe(true);
  });

  it('create sem o campo não força true', async () => {
    const prisma = {
      tenant: {
        create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({
          id: 1,
          uuid: 'u',
          active: true,
          apiAccessEnabled: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...data,
        })),
      },
    };
    const service = new TenantsService(prisma as never);
    await service.create({ name: 'Novo', phone: '+5511' });
    const createData = prisma.tenant.create.mock.calls[0][0]
      .data as Record<string, unknown>;
    expect(createData).not.toHaveProperty('apiAccessEnabled');
  });
});

describe('TenantSelfController — apiAccessEnabled forbidden', () => {
  it('Admin body com apiAccessEnabled → 403 sem chamar updatePhone', () => {
    const tenantsService = { updatePhone: jest.fn() };
    const controller = new TenantSelfController(tenantsService as never);

    expect(() =>
      controller.patchPhone(
        4,
        { phone: '+5511888' },
        {
          body: { phone: '+5511888', apiAccessEnabled: true },
        } as never,
      ),
    ).toThrow(ForbiddenException);
    expect(tenantsService.updatePhone).not.toHaveBeenCalled();
  });
});
