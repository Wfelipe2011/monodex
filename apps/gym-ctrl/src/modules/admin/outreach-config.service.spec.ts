import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Roles, WhatsappProvider } from '@prisma/client';
import { OutreachConfigService } from './outreach-config.service';

describe('OutreachConfigService — WhatsApp assignment (task 04)', () => {
  const defaultAccount = {
    id: 1,
    phoneNumberId: 'default-phone',
    displayPhone: '+550000',
    isDefault: true,
    tenantId: null,
    enabled: true,
    provider: WhatsappProvider.CLOUD_API,
    assignedOutreachConfig: null,
  };
  const dedicatedAccount = {
    id: 2,
    phoneNumberId: 'dedicated-phone',
    displayPhone: '+551111',
    isDefault: false,
    tenantId: null,
    enabled: true,
    provider: WhatsappProvider.CLOUD_API,
    assignedOutreachConfig: null,
  };

  const oldCreatedAt = new Date(Date.now() - 60 * 60 * 1000);

  function configRow(
    tenantId: number,
    overrides?: {
      whatsappAccountId?: number | null;
      coinDebitOnStatus?: 'sent' | 'delivered' | 'read';
    },
  ) {
    return {
      id: tenantId * 10,
      tenantId,
      enabled: false,
      costPerLead: 0.35,
      cashbackOnReply: 0,
      coinDebitOnStatus: overrides?.coinDebitOnStatus ?? 'delivered',
      outreachTemplateId: 1,
      notifyTemplateId: 2,
      whatsappAccountId: overrides?.whatsappAccountId ?? null,
      slotBindings: { outreach: {}, notify: {} },
      schedule: {},
      categories: [],
      leadsPerRun: 5,
      sendIntervalSeconds: 5,
      createdAt: oldCreatedAt,
      updatedAt: oldCreatedAt,
      outreachTemplate: null,
      notifyTemplate: null,
    };
  }

  function build(opts?: {
    accounts?: Record<number, typeof dedicatedAccount>;
    configs?: Record<number, ReturnType<typeof configRow>>;
  }) {
    const accounts: Record<number, typeof dedicatedAccount> = {
      1: defaultAccount,
      2: dedicatedAccount,
      ...(opts?.accounts ?? {}),
    };
    const configs: Record<number, ReturnType<typeof configRow>> = {
      10: configRow(10),
      20: configRow(20),
      ...(opts?.configs ?? {}),
    };

    const prisma = {
      tenant: {
        findUnique: jest.fn(async ({ where: { id } }: { where: { id: number } }) =>
          id === 99 ? null : { id, phone: '+5511', active: true },
        ),
      },
      tenantOutreachConfig: {
        findUnique: jest.fn(
          async ({ where: { tenantId } }: { where: { tenantId: number } }) =>
            configs[tenantId] ?? null,
        ),
        update: jest.fn(
          async ({
            where: { tenantId },
            data,
          }: {
            where: { tenantId: number };
            data: Record<string, unknown>;
          }) => {
            const next = { ...configs[tenantId], ...data };
            configs[tenantId] = next;
            return next;
          },
        ),
        create: jest.fn(
          async ({
            data,
          }: {
            data: { tenantId: number; whatsappAccountId?: number | null };
          }) => {
            const next = {
              ...configRow(data.tenantId, {
                whatsappAccountId: data.whatsappAccountId ?? null,
              }),
              ...data,
            };
            configs[data.tenantId] = next;
            return next;
          },
        ),
      },
      whatsappAccount: {
        findUnique: jest.fn(
          async ({
            where: { id },
            select,
          }: {
            where: { id: number };
            select?: Record<string, boolean>;
          }) => pick(accounts[id], select),
        ),
        findFirst: jest.fn(
          async ({ select }: { select?: Record<string, boolean> } = {}) =>
            pick(accounts[1], select),
        ),
      },
    };

    const service = new OutreachConfigService(prisma as never);
    return { service, prisma, configs, accounts };
  }

  function pick<T extends object>(
    row: T | undefined,
    select?: Record<string, boolean>,
  ) {
    if (!row) return null;
    if (!select) return row;
    return Object.fromEntries(
      Object.keys(select)
        .filter((key) => select[key])
        .map((key) => [key, (row as Record<string, unknown>)[key]]),
    );
  }

  it('PATCH platform { coinDebitOnStatus: "sent" } persiste o gatilho', async () => {
    const { service, prisma } = build();
    const result = await service.patchPlatform(
      10,
      { coinDebitOnStatus: 'sent' },
      [Roles.SUPER_ADMIN],
      { coinDebitOnStatus: 'sent' },
    );
    expect(prisma.tenantOutreachConfig.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ coinDebitOnStatus: 'sent' }),
      }),
    );
    expect(result.coinDebitOnStatus).toBe('sent');
  });

  it('PATCH { costPerLead, coinDebitOnStatus } juntos funciona', async () => {
    const { service, prisma } = build();
    const result = await service.patchPlatform(
      10,
      { costPerLead: 0.5, coinDebitOnStatus: 'read' },
      [Roles.SUPER_ADMIN],
      { costPerLead: 0.5, coinDebitOnStatus: 'read' },
    );
    expect(prisma.tenantOutreachConfig.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          costPerLead: 0.5,
          coinDebitOnStatus: 'read',
        }),
      }),
    );
    expect(result.coinDebitOnStatus).toBe('read');
  });

  it('Admin PATCH { coinDebitOnStatus } → 403, row inalterada', async () => {
    const { service, prisma } = build();
    await expect(
      service.patchTenant(
        10,
        { leadsPerRun: 10 },
        [Roles.ADMIN],
        { coinDebitOnStatus: 'sent' },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.tenantOutreachConfig.update).not.toHaveBeenCalled();
  });

  it('GET inclui coinDebitOnStatus (default delivered)', async () => {
    const { service } = build();
    const result = await service.get(10);
    expect(result.coinDebitOnStatus).toBe('delivered');
  });

  it('PATCH platform { whatsappAccountId: 2 } persiste conta válida não-default', async () => {
    const { service, prisma } = build();
    const result = await service.patchPlatform(
      10,
      { whatsappAccountId: 2 },
      [Roles.SUPER_ADMIN],
      { whatsappAccountId: 2 },
    );
    expect(prisma.tenantOutreachConfig.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ whatsappAccountId: 2 }),
      }),
    );
    expect(result.whatsappAccountId).toBe(2);
  });

  it('PATCH { whatsappAccountId: null } volta ao default', async () => {
    const { service } = build({
      configs: { 10: configRow(10, { whatsappAccountId: 2 }) },
    });
    const result = await service.patchPlatform(
      10,
      { whatsappAccountId: null },
      [Roles.SUPER_ADMIN],
      { whatsappAccountId: null },
    );
    expect(result.whatsappAccountId).toBeNull();
    expect(result.resolvedWhatsappAccount).toEqual(
      expect.objectContaining({ id: 1, isDefault: true }),
    );
  });

  it('PATCH com id da default → 400', async () => {
    const { service, prisma } = build();
    await expect(
      service.patchPlatform(
        10,
        { whatsappAccountId: 1 },
        [Roles.SUPER_ADMIN],
        { whatsappAccountId: 1 },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.tenantOutreachConfig.update).not.toHaveBeenCalled();
  });

  it('PATCH com id já usado por outro tenant → 400', async () => {
    const { service, prisma } = build({
      accounts: {
        2: {
          ...dedicatedAccount,
          assignedOutreachConfig: { tenantId: 10 } as never,
        },
      },
    });
    await expect(
      service.patchPlatform(
        20,
        { whatsappAccountId: 2 },
        [Roles.SUPER_ADMIN],
        { whatsappAccountId: 2 },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.tenantOutreachConfig.update).not.toHaveBeenCalled();
  });

  it('PATCH { costPerLead, whatsappAccountId } juntos funciona depois da janela de 30 min', async () => {
    const { service, prisma } = build();
    const result = await service.patchPlatform(
      10,
      { costPerLead: 0.5, whatsappAccountId: 2 },
      [Roles.SUPER_ADMIN],
      { costPerLead: 0.5, whatsappAccountId: 2 },
    );
    expect(prisma.tenantOutreachConfig.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          costPerLead: 0.5,
          whatsappAccountId: 2,
        }),
      }),
    );
    expect(result.costPerLead).toBe(0.5);
    expect(result.whatsappAccountId).toBe(2);
  });

  it('GET inclui resolvedWhatsappAccount', async () => {
    const { service } = build({
      configs: { 10: configRow(10, { whatsappAccountId: 2 }) },
    });
    const result = await service.get(10);
    expect(result.whatsappAccountId).toBe(2);
    expect(result.resolvedWhatsappAccount).toEqual({
      id: 2,
      phoneNumberId: 'dedicated-phone',
      displayPhone: '+551111',
      isDefault: false,
    });
  });

  it('Admin PATCH { whatsappAccountId: 2 } → 403, row inalterada', async () => {
    const { service, prisma } = build();
    await expect(
      service.patchTenant(
        10,
        { leadsPerRun: 10 },
        [Roles.ADMIN],
        { whatsappAccountId: 2 },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.tenantOutreachConfig.update).not.toHaveBeenCalled();
  });

  it('Admin PUT create sem o campo → whatsappAccountId null', async () => {
    const { service, prisma } = build();
    const result = await service.createTenant(
      30,
      {
        enabled: false,
        schedule: {},
        categories: [],
      },
      [Roles.ADMIN],
      { enabled: false, schedule: {}, categories: [] },
    );
    expect(prisma.tenantOutreachConfig.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({
          whatsappAccountId: expect.anything(),
        }),
      }),
    );
    const createData = prisma.tenantOutreachConfig.create.mock.calls[0][0]
      .data as Record<string, unknown>;
    expect(createData).not.toHaveProperty('whatsappAccountId');
    expect(result.whatsappAccountId).toBeNull();
  });

  it('Admin GET vê whatsappAccountId e resolved default se null', async () => {
    const { service } = build();
    const result = await service.get(10);
    expect(result.whatsappAccountId).toBeNull();
    expect(result.resolvedWhatsappAccount).toEqual({
      id: 1,
      phoneNumberId: 'default-phone',
      displayPhone: '+550000',
      isDefault: true,
    });
  });

  it('dois tenants: dedicado vs null resolvem números diferentes', async () => {
    const { service } = build({
      configs: {
        10: configRow(10, { whatsappAccountId: 2 }),
        20: configRow(20, { whatsappAccountId: null }),
      },
    });
    const dedicated = await service.get(10);
    const shared = await service.get(20);
    expect(dedicated.resolvedWhatsappAccount?.phoneNumberId).toBe(
      'dedicated-phone',
    );
    expect(shared.resolvedWhatsappAccount?.phoneNumberId).toBe('default-phone');
    expect(dedicated.resolvedWhatsappAccount?.id).not.toBe(
      shared.resolvedWhatsappAccount?.id,
    );
  });

  it('mesmo id já neste tenant é no-op ok', async () => {
    const { service } = build({
      configs: { 10: configRow(10, { whatsappAccountId: 2 }) },
      accounts: {
        2: {
          ...dedicatedAccount,
          assignedOutreachConfig: { tenantId: 10 } as never,
        },
      },
    });
    const result = await service.patchPlatform(
      10,
      { whatsappAccountId: 2 },
      [Roles.SUPER_ADMIN],
      { whatsappAccountId: 2 },
    );
    expect(result.whatsappAccountId).toBe(2);
  });
});
