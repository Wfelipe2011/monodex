import { NotFoundException } from '@nestjs/common';
import { GUARDS_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { Roles, WhatsappDeliveryStatus } from '@prisma/client';
import { ROLES_KEY } from '@core/decorators/roles.decorator';
import { TenantActiveGuard } from '@core/guard/tenant-active.guard';
import { TenantScopeGuard } from '@core/guard/tenant-scope.guard';
import { TenantLeadsStatsController } from './ops.controller';
import { HOME_SENDS_TIMEZONE, OpsService, saoPauloDayRange } from './ops.service';

const TENANT_ID = 4;
const NOW = new Date('2026-08-19T14:00:00.000Z');

describe('TenantLeadsStatsController', () => {
  it('GET ops/home usa o mesmo path prefix, roles e guards de leads/stats', () => {
    expect(Reflect.getMetadata(PATH_METADATA, TenantLeadsStatsController)).toBe(
      'tenant/:tenantId',
    );
    expect(
      Reflect.getMetadata(PATH_METADATA, TenantLeadsStatsController.prototype.home),
    ).toBe('ops/home');
    expect(
      Reflect.getMetadata(
        PATH_METADATA,
        TenantLeadsStatsController.prototype.leadsStats,
      ),
    ).toBe('leads/stats');
    expect(Reflect.getMetadata(ROLES_KEY, TenantLeadsStatsController)).toEqual([
      Roles.ADMIN,
      Roles.SUPER_ADMIN,
    ]);
    expect(Reflect.getMetadata(GUARDS_METADATA, TenantLeadsStatsController)).toEqual(
      [TenantScopeGuard, TenantActiveGuard],
    );
  });
});

describe('OpsService.home', () => {
  const { yesterdayStart, todayStart, tomorrowStart } = saoPauloDayRange(NOW);

  const listDeliveredToday = {
    lastStatus: WhatsappDeliveryStatus.delivered,
    sentAt: new Date('2026-08-19T12:00:00.000Z'),
    tenantId: TENANT_ID,
  };
  const cityPendingToday = {
    lastStatus: null as WhatsappDeliveryStatus | null,
    createdAt: new Date('2026-08-19T10:00:00.000Z'),
    tenantId: TENANT_ID,
    messageId: 'wamid.city-pending',
  };
  const capturaToday = {
    lastStatus: null as WhatsappDeliveryStatus | null,
    createdAt: new Date('2026-08-19T12:00:00.000Z'),
    tenantId: TENANT_ID,
    messageId: null as string | null,
  };
  const cityFailedYesterday = {
    lastStatus: WhatsappDeliveryStatus.failed,
    createdAt: new Date('2026-08-18T12:00:00.000Z'),
    tenantId: TENANT_ID,
    messageId: 'wamid.city-yesterday',
  };
  const listUtcTodayStillYesterdaySp = {
    lastStatus: WhatsappDeliveryStatus.sent,
    sentAt: new Date('2026-08-19T02:00:00.000Z'),
    tenantId: TENANT_ID,
  };

  function inRange(value: Date, gte?: Date, lt?: Date) {
    if (gte && value < gte) {
      return false;
    }
    if (lt && value >= lt) {
      return false;
    }
    return true;
  }

  function build(opts?: {
    outreach?: {
      enabled: boolean;
      whatsappAccount: { isDefault: boolean } | null;
    } | null;
  }) {
    const listSends = [listDeliveredToday, listUtcTodayStillYesterdaySp];
    const cityLeads = [cityPendingToday, capturaToday, cityFailedYesterday];

    const prisma = {
      tenant: {
        findUnique: jest.fn(async ({ where: { id } }: { where: { id: number } }) =>
          id === TENANT_ID ? { id } : null,
        ),
      },
      tenantLead: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn(
          async ({
            where,
          }: {
            where: {
              tenantId: number;
              messageId?: { not: null };
              createdAt?: { gte: Date; lt: Date };
            };
          }) =>
            cityLeads.filter((row) => {
              if (row.tenantId !== where.tenantId) {
                return false;
              }
              if (where.messageId?.not === null && row.messageId == null) {
                return false;
              }
              return inRange(
                row.createdAt,
                where.createdAt?.gte,
                where.createdAt?.lt,
              );
            }),
        ),
      },
      tenantListSend: {
        findMany: jest.fn(
          async ({
            where,
          }: {
            where: {
              campaign?: { list?: { tenantId: number } };
              sentAt?: { gte: Date; lt: Date };
            };
          }) =>
            listSends.filter((row) => {
              if (row.tenantId !== where.campaign?.list?.tenantId) {
                return false;
              }
              return inRange(row.sentAt, where.sentAt?.gte, where.sentAt?.lt);
            }),
        ),
      },
      coin: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { balance: 12.5 } }),
      },
      tenantOutreachConfig: {
        findUnique: jest.fn().mockResolvedValue(
          opts?.outreach === undefined
            ? {
                enabled: true,
                whatsappAccount: { isDefault: false },
              }
            : opts.outreach,
        ),
      },
      whatsappConversation: {
        count: jest.fn().mockResolvedValue(10),
        aggregate: jest
          .fn()
          .mockResolvedValue({
            _max: { lastInboundAt: new Date('2026-08-19T11:00:00.000Z') },
          }),
      },
    };

    prisma.whatsappConversation.count
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(3);

    const service = new OpsService(prisma as never);
    return { service, prisma };
  }

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('agrega lista+cidade hoje, exclui captura e isola ontem em America/Sao_Paulo', async () => {
    const { service, prisma } = build();
    const home = await service.home(TENANT_ID, NOW);

    expect(home.sends.timezone).toBe(HOME_SENDS_TIMEZONE);
    expect(home.sends.timezone).toBe('America/Sao_Paulo');
    expect(home.sends.today).toEqual({
      sent: 0,
      delivered: 1,
      read: 0,
      failed: 0,
      pending: 1,
      total: 2,
    });
    expect(home.sends.yesterday.failed).toBe(1);
    expect(home.sends.yesterday.sent).toBe(1);
    expect(home.sends.yesterday.total).toBe(2);
    expect(home.sends.today.total).toBe(2);

    expect(prisma.tenantLead.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: TENANT_ID,
          messageId: { not: null },
          createdAt: { gte: yesterdayStart, lt: tomorrowStart },
        }),
      }),
    );
    expect(prisma.tenantListSend.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          campaign: { list: { tenantId: TENANT_ID } },
          sentAt: { gte: yesterdayStart, lt: tomorrowStart },
        }),
      }),
    );

    const cityRows = await prisma.tenantLead.findMany.mock.results[0].value;
    expect(cityRows).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ messageId: null })]),
    );
    expect(todayStart.toISOString()).toBe('2026-08-19T03:00:00.000Z');
  });

  it('hasDedicatedNumber é false quando whatsappAccountId é null', async () => {
    const { service } = build({
      outreach: { enabled: true, whatsappAccount: null },
    });
    const home = await service.home(TENANT_ID, NOW);
    expect(home.outreach.hasDedicatedNumber).toBe(false);
    expect(home.outreach.enabled).toBe(true);
  });

  it('reutiliza leadsStats no cityFunnel e 404 se o tenant não existe', async () => {
    const { service, prisma } = build();
    const home = await service.home(TENANT_ID, NOW);
    expect(home.outreach.cityFunnel).toEqual({
      contacted: 0,
      replied: 0,
      quoted: 0,
      closed: 0,
      deleted: 0,
    });
    expect(prisma.tenantLead.count).toHaveBeenCalled();

    await expect(service.home(99, NOW)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.leadsStats(TENANT_ID)).resolves.toEqual(
      home.outreach.cityFunnel,
    );
  });

  it('soma coins, inbox e flag de dedicado', async () => {
    const { service } = build();
    const home = await service.home(TENANT_ID, NOW);
    expect(home.coins.balance).toBe(12.5);
    expect(home.outreach.hasDedicatedNumber).toBe(true);
    expect(home.inbox).toEqual({
      threadCount: 10,
      openWindows: 3,
      lastInboundAt: '2026-08-19T11:00:00.000Z',
    });
  });
});
