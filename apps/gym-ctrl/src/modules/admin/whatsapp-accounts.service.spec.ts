import { BadRequestException } from '@nestjs/common';
import { Prisma, WhatsappProvider } from '@prisma/client';
import { WhatsappAccountsService } from './whatsapp-accounts.service';

const FLEET_WABA = 'waba-fleet';

function accountRow(
  overrides: Partial<{
    id: number;
    phoneNumberId: string;
    wabaId: string;
    isDefault: boolean;
    enabled: boolean;
    tenantId: number | null;
  }> = {},
) {
  return {
    id: overrides.id ?? 1,
    provider: WhatsappProvider.CLOUD_API,
    phoneNumberId: overrides.phoneNumberId ?? '111',
    wabaId: overrides.wabaId ?? FLEET_WABA,
    displayPhone: '+5511999998888',
    tokenEnvKey: 'WHATSAPP_TOKEN',
    tenantId: overrides.tenantId ?? null,
    enabled: overrides.enabled ?? true,
    isDefault: overrides.isDefault ?? true,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };
}

describe('WhatsappAccountsService', () => {
  function build(options?: {
    defaultAccount?: ReturnType<typeof accountRow> | null;
    getById?: ReturnType<typeof accountRow> | null;
    assignedTenantId?: number | null;
    createResult?: ReturnType<typeof accountRow>;
    updateResult?: ReturnType<typeof accountRow>;
    createError?: unknown;
  }) {
    const defaultAccount =
      options?.defaultAccount === undefined
        ? accountRow({ id: 1, isDefault: true })
        : options.defaultAccount;
    const created =
      options?.createResult ??
      accountRow({ id: 2, phoneNumberId: '222', isDefault: false });

    const prisma = {
      whatsappAccount: {
        findMany: jest.fn().mockResolvedValue([
          accountRow({ id: 1, isDefault: true }),
          accountRow({ id: 2, phoneNumberId: '222', isDefault: false }),
        ]),
        findFirst: jest.fn().mockResolvedValue(defaultAccount),
        findUnique: jest.fn().mockResolvedValue(
          options?.getById === undefined
            ? accountRow({ id: 2, phoneNumberId: '222', isDefault: false })
            : options.getById,
        ),
        create: jest.fn().mockImplementation(async () => {
          if (options?.createError) throw options.createError;
          return created;
        }),
        update: jest
          .fn()
          .mockResolvedValue(options?.updateResult ?? created),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      tenantOutreachConfig: {
        findUnique: jest.fn().mockResolvedValue(
          options?.assignedTenantId
            ? { tenantId: options.assignedTenantId }
            : null,
        ),
      },
      $transaction: jest.fn(async (fn: (tx: unknown) => unknown) => fn(prisma)),
    };

    const service = new WhatsappAccountsService(prisma as never);
    return { service, prisma };
  }

  it('lista todas as contas plataforma com isDefault e sem access token', async () => {
    const { service, prisma } = build();
    const rows = await service.list();
    expect(prisma.whatsappAccount.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: null },
        select: expect.objectContaining({ isDefault: true }),
      }),
    );
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row).toHaveProperty('isDefault');
      expect(row).not.toHaveProperty('accessToken');
      expect(row).not.toHaveProperty('token');
    }
  });

  it('POST primeiro número nasce default mesmo se o body mandar false', async () => {
    const { service, prisma } = build({ defaultAccount: null });
    await service.create({
      phoneNumberId: '111',
      wabaId: FLEET_WABA,
      isDefault: false,
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.whatsappAccount.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: null,
          isDefault: true,
          wabaId: FLEET_WABA,
        }),
      }),
    );
  });

  it('POST segundo número no mesmo wabaId nasce isDefault false e não desmarca a default', async () => {
    const { service, prisma } = build();
    const created = await service.create({
      phoneNumberId: '222',
      wabaId: FLEET_WABA,
    });
    expect(created.isDefault).toBe(false);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.whatsappAccount.updateMany).not.toHaveBeenCalled();
    expect(prisma.whatsappAccount.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: null,
          isDefault: false,
          wabaId: FLEET_WABA,
          phoneNumberId: '222',
        }),
      }),
    );
  });

  it('POST wabaId diferente da default → 400', async () => {
    const { service, prisma } = build();
    await expect(
      service.create({ phoneNumberId: '333', wabaId: 'outro-waba' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.whatsappAccount.create).not.toHaveBeenCalled();
  });

  it('POST tenantId: 4 → 400', async () => {
    const { service, prisma } = build({ defaultAccount: null });
    await expect(
      service.create({
        phoneNumberId: '111',
        wabaId: FLEET_WABA,
        tenantId: 4,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.whatsappAccount.create).not.toHaveBeenCalled();
  });

  it('POST phoneNumberId duplicado (P2002) → 400', async () => {
    const { service } = build({
      createError: new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed',
        { code: 'P2002', clientVersion: '6.0.0', meta: { target: ['phoneNumberId'] } },
      ),
    });
    await expect(
      service.create({ phoneNumberId: '111', wabaId: FLEET_WABA }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ statusCode: 400 }),
    });
  });

  it('promove B na mesma transação: demote A depois update B', async () => {
    const promoted = accountRow({
      id: 2,
      phoneNumberId: '222',
      isDefault: true,
    });
    const { service, prisma } = build({
      getById: accountRow({ id: 2, phoneNumberId: '222', isDefault: false }),
      updateResult: promoted,
    });

    const result = await service.patch(2, { isDefault: true });
    expect(result.isDefault).toBe(true);
    expect(prisma.$transaction).toHaveBeenCalled();
    const txOrder = [
      prisma.whatsappAccount.updateMany.mock.invocationCallOrder[0],
      prisma.whatsappAccount.update.mock.invocationCallOrder[0],
    ];
    expect(txOrder[0]).toBeLessThan(txOrder[1]);
    expect(prisma.whatsappAccount.updateMany).toHaveBeenCalledWith({
      where: { isDefault: true, tenantId: null, id: { not: 2 } },
      data: { isDefault: false },
    });
    expect(prisma.whatsappAccount.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 2 },
        data: expect.objectContaining({ isDefault: true, tenantId: null }),
      }),
    );
  });

  it('disable da default → 400 e não atualiza a row', async () => {
    const { service, prisma } = build({
      getById: accountRow({ id: 1, isDefault: true, enabled: true }),
    });
    await expect(
      service.patch(1, { enabled: false }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.whatsappAccount.update).not.toHaveBeenCalled();
  });

  it('isDefault true e enabled false juntos → 400', async () => {
    const { service, prisma } = build({
      getById: accountRow({ id: 2, phoneNumberId: '222', isDefault: false }),
    });
    await expect(
      service.patch(2, { isDefault: true, enabled: false }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('promover conta amarrada a um tenant → 400', async () => {
    const { service, prisma } = build({
      getById: accountRow({ id: 2, phoneNumberId: '222', isDefault: false }),
      assignedTenantId: 4,
    });
    await expect(
      service.patch(2, { isDefault: true }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.whatsappAccount.update).not.toHaveBeenCalled();
  });
});
