import {
  OutreachSendRunChannel,
  OutreachSendRunClosedReason,
  OutreachSendRunStatus,
} from '@prisma/client';
import { OutreachQuotaRefillService } from './outreach-quota-refill.service';
import { OutreachSendRunService } from './outreach-send-run.service';
import * as premiumMix from './premium-mix';

const TENANT_ID = 10;
const RUN_ID = 1;
const SOURCE_LEAD_ID = 50;

describe('OutreachQuotaRefillService', () => {
  function openRun(overrides?: Partial<{
    id: number;
    channel: OutreachSendRunChannel;
    tenantId: number;
    campaignId: number | null;
    targetCount: number;
    tryCount: number;
    chargedCount: number;
    status: OutreachSendRunStatus;
    expiresAt: Date;
  }>) {
    return {
      id: overrides?.id ?? RUN_ID,
      channel: overrides?.channel ?? OutreachSendRunChannel.CITY,
      tenantId: overrides?.tenantId ?? TENANT_ID,
      campaignId: overrides?.campaignId ?? null,
      targetCount: overrides?.targetCount ?? 5,
      tryCount: overrides?.tryCount ?? 0,
      attemptCount: 0,
      chargedCount: overrides?.chargedCount ?? 0,
      status: overrides?.status ?? OutreachSendRunStatus.OPEN,
      closedReason: null,
      expiresAt: overrides?.expiresAt ?? new Date(Date.now() + 3_600_000),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  function leadRow(partial: {
    id: number;
    phone: string;
    rating?: number | null;
    reviews?: number | null;
    category?: string;
    categories?: string[];
  }) {
    return {
      id: partial.id,
      phone: partial.phone,
      rating: partial.rating ?? 5,
      reviews: partial.reviews ?? 100,
      category: partial.category ?? 'Construtoras',
      categories: partial.categories ?? ['Construtoras'],
      name: 'Lead',
      deletedAt: null,
      cityId: 1,
    };
  }

  function build(opts?: {
    run?: ReturnType<typeof openRun> | null;
    sourceClaimCount?: number;
    balance?: number;
    costPerLead?: number;
    sendIntervalSeconds?: number;
    cityLeadsInRun?: Array<{ phone: string }>;
    usedPhones?: string[];
    poolLeads?: ReturnType<typeof leadRow>[];
    avgLeads?: Array<{
      categories: string[];
      category: string;
      reviews: number | null;
    }>;
  }) {
    const run = opts && 'run' in opts ? opts.run : openRun();
    let currentRun = run;

    const prisma = {
      tenantLead: {
        updateMany: jest.fn().mockResolvedValue({
          count: opts?.sourceClaimCount ?? 1,
        }),
        findMany: jest.fn().mockImplementation(async (args: {
          where?: { runId?: number; tenantId?: number };
          select?: unknown;
        }) => {
          if (args.where?.runId != null) {
            return (opts?.cityLeadsInRun ?? []).map((p) => ({
              lead: { phone: p.phone },
            }));
          }
          return (opts?.usedPhones ?? []).map((phone) => ({
            lead: { phone },
          }));
        }),
        count: jest.fn().mockResolvedValue(0),
      },
      tenantListSend: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      tenantOnDemandSend: {
        count: jest.fn().mockResolvedValue(0),
      },
      tenantLeadList: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      outreachSendRun: {
        findUnique: jest.fn().mockImplementation(async () => currentRun),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      tenantOutreachConfig: {
        findUnique: jest.fn().mockResolvedValue({
          categories: ['Construtoras'],
          costPerLead: opts?.costPerLead ?? 2,
          costPerOnDemandSend: 0,
          sendIntervalSeconds: opts?.sendIntervalSeconds ?? 5,
        }),
      },
      coin: {
        findFirst: jest.fn().mockResolvedValue({
          balance: opts?.balance ?? 100,
        }),
      },
      lead: {
        findMany: jest.fn().mockImplementation(async (args: {
          select?: unknown;
        }) => {
          if (args.select) {
            return (
              opts?.avgLeads ??
              (opts?.poolLeads ?? []).map((l) => ({
                categories: l.categories,
                category: l.category,
                reviews: l.reviews,
              }))
            );
          }
          return opts?.poolLeads ?? [];
        }),
      },
      tenantListCampaign: {
        findUnique: jest.fn(),
      },
      tenantListLead: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      $transaction: jest.fn(),
    };

    prisma.$transaction.mockImplementation(
      async (fn: (tx: typeof prisma) => unknown) => fn(prisma),
    );

    const runs = new OutreachSendRunService(prisma as never);
    const ensureOpenSpy = jest.spyOn(runs, 'ensureOpen');
    const beginTrySpy = jest.spyOn(runs, 'beginTry');
    const recordAcceptSpy = jest.spyOn(runs, 'recordAccept');
    const closeSpy = jest.spyOn(runs, 'close');

    // Wire beginTry against mutable currentRun for realistic caps.
    beginTrySpy.mockImplementation(async (runId: number) => {
      if (!currentRun || currentRun.id !== runId) return false;
      if (currentRun.status !== OutreachSendRunStatus.OPEN) return false;
      if (new Date() >= currentRun.expiresAt) return false;
      if (currentRun.tryCount >= currentRun.targetCount * 3) return false;
      if (currentRun.chargedCount >= currentRun.targetCount) return false;
      currentRun = {
        ...currentRun,
        tryCount: currentRun.tryCount + 1,
      };
      return true;
    });

    ensureOpenSpy.mockImplementation(async (r) => {
      if (r.status !== OutreachSendRunStatus.OPEN) return null;
      if (new Date() >= r.expiresAt) {
        await runs.close(r.id, OutreachSendRunClosedReason.TTL);
        return null;
      }
      return r;
    });

    const service = new OutreachQuotaRefillService(prisma as never, runs);
    const sleepSpy = jest
      .spyOn(service, 'sleep')
      .mockResolvedValue(undefined);

    return {
      service,
      prisma,
      runs,
      sleepSpy,
      beginTrySpy,
      recordAcceptSpy,
      closeSpy,
      setRun: (next: typeof currentRun) => {
        currentRun = next;
      },
    };
  }

  it('refill idempotente quando refillTriggeredAt já setado', async () => {
    const { service, prisma, sleepSpy, beginTrySpy } = build({
      sourceClaimCount: 0,
    });
    const sendCityLead = jest.fn();

    await service.refillOne({
      runId: RUN_ID,
      sourceTenantLeadId: SOURCE_LEAD_ID,
      failedPhone: '12999990000',
      sendCityLead,
    });

    expect(prisma.tenantLead.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: SOURCE_LEAD_ID,
          refillTriggeredAt: null,
        },
      }),
    );
    expect(sleepSpy).not.toHaveBeenCalled();
    expect(beginTrySpy).not.toHaveBeenCalled();
    expect(sendCityLead).not.toHaveBeenCalled();
  });

  it('TTL close bloqueia refill', async () => {
    const expired = openRun({
      expiresAt: new Date(Date.now() - 1000),
    });
    const { service, sleepSpy, beginTrySpy, closeSpy } = build({
      run: expired,
    });
    const sendCityLead = jest.fn();

    await service.refillOne({
      runId: RUN_ID,
      failedPhone: '12999990000',
      sendCityLead,
    });

    expect(closeSpy).toHaveBeenCalledWith(
      RUN_ID,
      OutreachSendRunClosedReason.TTL,
    );
    expect(sleepSpy).not.toHaveBeenCalled();
    expect(beginTrySpy).not.toHaveBeenCalled();
    expect(sendCityLead).not.toHaveBeenCalled();
  });

  it('respeita intervalo e balance antes do send', async () => {
    const pool = [
      leadRow({ id: 1, phone: '12988880000', rating: 3, reviews: 1 }),
    ];
    const { service, sleepSpy, beginTrySpy } = build({
      sendIntervalSeconds: 7,
      balance: 100,
      costPerLead: 2,
      poolLeads: pool,
    });
    const sendCityLead = jest.fn().mockResolvedValue({
      accepted: true,
      tenantLeadId: 99,
    });

    await service.refillOne({
      runId: RUN_ID,
      failedPhone: '12999990000',
      sendCityLead,
    });

    expect(sleepSpy).toHaveBeenCalledWith(7000);
    expect(beginTrySpy).toHaveBeenCalledWith(RUN_ID);
    expect(sendCityLead).toHaveBeenCalled();
  });

  it('saldo insuficiente não faz POST', async () => {
    const { service, beginTrySpy } = build({
      balance: 0,
      costPerLead: 2,
      poolLeads: [leadRow({ id: 1, phone: '12988880000' })],
    });
    const sendCityLead = jest.fn();

    await service.refillOne({
      runId: RUN_ID,
      failedPhone: '12999990000',
      sendCityLead,
    });

    expect(beginTrySpy).not.toHaveBeenCalled();
    expect(sendCityLead).not.toHaveBeenCalled();
  });

  it('city exclui failed phone da seleção', async () => {
    const pool = [
      leadRow({ id: 1, phone: '12999990000', rating: 3, reviews: 1 }),
      leadRow({ id: 2, phone: '12988880000', rating: 3, reviews: 1 }),
    ];
    const { service } = build({
      poolLeads: pool,
      cityLeadsInRun: [],
      usedPhones: [],
    });
    const sendCityLead = jest.fn().mockResolvedValue({ accepted: true });

    await service.refillOne({
      runId: RUN_ID,
      failedPhone: '12999990000',
      wasPremium: false,
      sendCityLead,
    });

    expect(sendCityLead).toHaveBeenCalledWith(
      expect.objectContaining({
        lead: expect.objectContaining({ phone: '12988880000' }),
      }),
    );
  });

  it('premium→premium quando pool premium disponível', async () => {
    const isPremiumSpy = jest
      .spyOn(premiumMix, 'isPremium')
      .mockImplementation((lead) => lead.phone === '12977770000');

    const pool = [
      leadRow({
        id: 1,
        phone: '12977770000',
        rating: 5,
        reviews: 200,
      }),
      leadRow({
        id: 2,
        phone: '12966660000',
        rating: 3,
        reviews: 1,
      }),
    ];
    const { service } = build({
      poolLeads: pool,
      usedPhones: [],
      cityLeadsInRun: [],
    });
    const sendCityLead = jest.fn().mockResolvedValue({ accepted: true });

    await service.refillOne({
      runId: RUN_ID,
      failedPhone: '12999990000',
      wasPremium: true,
      sendCityLead,
    });

    expect(sendCityLead).toHaveBeenCalledWith(
      expect.objectContaining({
        lead: expect.objectContaining({ phone: '12977770000' }),
      }),
    );

    isPremiumSpy.mockRestore();
  });

  it('try cap impede beginTry / send no refill', async () => {
    const { service, beginTrySpy } = build({
      run: openRun({ tryCount: 15, targetCount: 5 }),
      poolLeads: [leadRow({ id: 1, phone: '12988880000' })],
    });
    const sendCityLead = jest.fn();

    await service.refillOne({
      runId: RUN_ID,
      failedPhone: '12999990000',
      sendCityLead,
    });

    expect(beginTrySpy).not.toHaveBeenCalled();
    expect(sendCityLead).not.toHaveBeenCalled();
  });
});
