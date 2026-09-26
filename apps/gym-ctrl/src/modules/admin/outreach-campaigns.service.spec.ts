import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Roles } from '@prisma/client';
import { OutreachCampaignsService } from './outreach-campaigns.service';

describe('OutreachCampaignsService', () => {
  const oldCreatedAt = new Date(Date.now() - 60 * 60 * 1000);

  const catalogTargets = [
    { cityId: 1, category: 'Construtoras', enabled: true },
    { cityId: 2, category: 'Clínicas médicas', enabled: true },
  ];

  function campaignRow(
    id: number,
    tenantId: number,
    overrides?: Partial<{
      enabled: boolean;
      cityId: number | null;
      outreachTemplateId: number | null;
      notifyTemplateId: number | null;
    }>,
  ) {
    return {
      id,
      tenantId,
      name: 'Padrão',
      enabled: overrides?.enabled ?? false,
      schedule: { '2': [18] },
      categories: ['Construtoras'],
      leadsPerRun: 5,
      sendIntervalSeconds: 5,
      outreachTemplateId: overrides?.outreachTemplateId ?? 10,
      notifyTemplateId: overrides?.notifyTemplateId ?? 11,
      slotBindings: { outreach: {}, notify: {} },
      cityId: overrides?.cityId ?? null,
      createdAt: oldCreatedAt,
      updatedAt: oldCreatedAt,
      outreachTemplate: {
        id: 10,
        name: 'outreach_v1',
        language: 'pt_BR',
        status: 'APPROVED',
      },
      notifyTemplate: {
        id: 11,
        name: 'notify_v1',
        language: 'pt_BR',
        status: 'APPROVED',
      },
    };
  }

  function build(opts?: {
    policy?: { allowedCityIds: number[]; deniedCityIds: number[] } | null;
    campaigns?: Record<number, ReturnType<typeof campaignRow>>;
  }) {
    const campaigns: Record<number, ReturnType<typeof campaignRow>> = {
      1: campaignRow(1, 10),
      ...(opts?.campaigns ?? {}),
    };
    let nextId = Math.max(0, ...Object.keys(campaigns).map(Number)) + 1;

    const prisma = {
      tenant: {
        findUnique: jest.fn(async ({ where: { id } }: { where: { id: number } }) =>
          id === 99 ? null : { id },
        ),
      },
      tenantSendPolicy: {
        findUnique: jest.fn(async () =>
          opts?.policy === null
            ? null
            : (opts?.policy ?? { allowedCityIds: [1, 2], deniedCityIds: [] }),
        ),
      },
      scrapeTarget: {
        findMany: jest.fn(async () => catalogTargets),
      },
      tenantTemplateGrant: {
        findUnique: jest.fn(async () => ({ tenantId: 10 })),
      },
      whatsappMessageTemplate: {
        findUnique: jest.fn(
          async ({ where: { id } }: { where: { id: number } }) => ({
            id,
            status: 'APPROVED',
            slots: [],
          }),
        ),
      },
      tenantOutreachCampaign: {
        findMany: jest.fn(async ({ where }: { where: { tenantId: number } }) =>
          Object.values(campaigns).filter((c) => c.tenantId === where.tenantId),
        ),
        findFirst: jest.fn(
          async ({
            where,
          }: {
            where: { id: number; tenantId: number };
          }) => {
            const row = campaigns[where.id];
            if (!row || row.tenantId !== where.tenantId) return null;
            return row;
          },
        ),
        create: jest.fn(
          async ({
            data,
          }: {
            data: {
              tenantId: number;
              name: string;
              cityId?: number | null;
            };
          }) => {
            const row = {
              ...campaignRow(nextId, data.tenantId, {
                cityId: data.cityId ?? null,
              }),
              ...data,
              id: nextId,
            };
            campaigns[nextId] = row;
            nextId += 1;
            return row;
          },
        ),
        update: jest.fn(
          async ({
            where: { id },
            data,
          }: {
            where: { id: number };
            data: Record<string, unknown>;
          }) => {
            const next = { ...campaigns[id], ...data };
            campaigns[id] = next;
            return next;
          },
        ),
        delete: jest.fn(async ({ where: { id } }: { where: { id: number } }) => {
          delete campaigns[id];
        }),
      },
    };

    const service = new OutreachCampaignsService(prisma as never);
    return { service, prisma, campaigns };
  }

  it('CRUD round-trip', async () => {
    const { service, campaigns } = build({
      policy: { allowedCityIds: [1, 2], deniedCityIds: [] },
    });

    const created = await service.createCampaign(
      10,
      {
        name: 'Nova',
        enabled: false,
        schedule: { '3': [10] },
        categories: ['Construtoras'],
        outreachTemplateId: 10,
        notifyTemplateId: 11,
        slotBindings: { outreach: {}, notify: {} },
        cityId: 1,
      },
      [Roles.ADMIN],
    );
    expect(created.name).toBe('Nova');
    expect(created.cityId).toBe(1);

    const listed = await service.listCampaigns(10);
    expect(listed.length).toBeGreaterThanOrEqual(2);

    const fetched = await service.getCampaign(10, created.id);
    expect(fetched.id).toBe(created.id);

    const patched = await service.patchCampaign(
      10,
      created.id,
      { name: 'Renomeada' },
      [Roles.ADMIN],
    );
    expect(patched.name).toBe('Renomeada');

    await service.deleteCampaign(10, created.id, [Roles.ADMIN]);
    await expect(service.getCampaign(10, created.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(campaigns[created.id]).toBeUndefined();
  });

  it('cityId fora da allowlist → 400', async () => {
    const { service } = build({
      policy: { allowedCityIds: [1], deniedCityIds: [] },
    });
    await expect(
      service.createCampaign(
        10,
        {
          name: 'X',
          schedule: {},
          categories: ['Construtoras'],
          cityId: 2,
        },
        [Roles.ADMIN],
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('leadsPerRun 0 → 400', async () => {
    const { service } = build();
    await expect(
      service.createCampaign(
        10,
        {
          name: 'X',
          schedule: {},
          categories: ['Construtoras'],
          leadsPerRun: 0,
        },
        [Roles.ADMIN],
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
