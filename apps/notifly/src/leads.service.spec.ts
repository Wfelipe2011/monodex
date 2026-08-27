import { LeadsService } from './leads.service';
import { OutreachSendRunService } from './outreach-send-run.service';
import { OutreachQuotaRefillService } from './outreach-quota-refill.service';

jest.mock('./conversation-thread', () => ({
  isDedicatedBoundToTenant: jest.fn().mockResolvedValue(false),
  upsertConversationThenMessage: jest.fn(),
}));

const TENANT_ID = 42;
const RUN_ID = 7;

describe('LeadsService.contactLeads (city run)', () => {
  function makeLead(partial: {
    id: number;
    phone: string;
    rating?: number | null;
    reviews?: number | null;
  }) {
    return {
      id: partial.id,
      phone: partial.phone,
      name: `Lead ${partial.id}`,
      rating: partial.rating ?? null,
      reviews: partial.reviews ?? null,
      category: 'Construtoras',
      categories: ['Construtoras'],
      deletedAt: null,
      cityId: 1,
      city: { name: 'São José' },
    };
  }

  /** Premium: rating 5 + reviews altos vs média da categoria. */
  function premiumLead(id: number, phone: string) {
    return makeLead({ id, phone, rating: 5, reviews: 200 });
  }

  function regularLead(id: number, phone: string) {
    return makeLead({ id, phone, rating: 3, reviews: 5 });
  }

  function openRun(targetCount = 5) {
    return {
      id: RUN_ID,
      channel: 'CITY',
      tenantId: TENANT_ID,
      campaignId: null,
      targetCount,
      tryCount: 0,
      attemptCount: 0,
      chargedCount: 0,
      status: 'OPEN',
      closedReason: null,
      expiresAt: new Date(Date.now() + 3_600_000),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  function buildTenant(overrides?: {
    leadsPerRun?: number;
    sendIntervalSeconds?: number;
    costPerLead?: number;
    balance?: number;
  }) {
    return {
      id: TENANT_ID,
      name: 'Tenant Test',
      phone: '12999990000',
      active: true,
      sendPolicy: null,
      outreachConfig: {
        enabled: true,
        categories: ['Construtoras'],
        leadsPerRun: overrides?.leadsPerRun ?? 5,
        costPerLead: overrides?.costPerLead ?? 2,
        costPerOnDemandSend: 0,
        sendIntervalSeconds: overrides?.sendIntervalSeconds ?? 1,
        cashbackOnReply: 0,
        schedule: {},
        slotBindings: {},
        outreachTemplate: {
          id: 1,
          name: 'outreach_tpl',
          language: 'pt_BR',
          status: 'APPROVED',
          slots: [],
        },
        notifyTemplate: null,
      },
    };
  }

  function build(opts?: {
    pool?: ReturnType<typeof makeLead>[];
    openRunResult?: ReturnType<typeof openRun> | null;
    balance?: number;
    httpFailOnCall?: number;
    leadsPerRun?: number;
    sendIntervalSeconds?: number;
  }) {
    const pool =
      opts?.pool ??
      Array.from({ length: 12 }, (_, i) =>
        i < 6
          ? premiumLead(i + 1, `1290000${1000 + i}`)
          : regularLead(i + 1, `1290000${1000 + i}`),
      );

    let tenantLeadSeq = 100;
    const createdLeads: Array<{
      id: number;
      runId: number | null;
      wasPremium: boolean | null;
      leadId: number;
    }> = [];

    let httpCalls = 0;
    const httpFailOn = opts?.httpFailOnCall;

    const prisma = {
      coin: {
        findFirst: jest.fn().mockResolvedValue({
          balance: opts?.balance ?? 100,
        }),
      },
      tenantLead: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockImplementation(async (args: {
          data: {
            leadId: number;
            runId?: number | null;
            wasPremium?: boolean | null;
          };
        }) => {
          const row = {
            id: ++tenantLeadSeq,
            runId: args.data.runId ?? null,
            wasPremium: args.data.wasPremium ?? null,
            leadId: args.data.leadId,
          };
          createdLeads.push(row);
          return row;
        }),
      },
      tenantOnDemandSend: {
        count: jest.fn().mockResolvedValue(0),
      },
      tenantLeadList: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      tenantListSend: {
        count: jest.fn().mockResolvedValue(0),
      },
      tenantRespect: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      tenantSendPolicy: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      lead: {
        findMany: jest.fn().mockImplementation(async (args: {
          select?: unknown;
          include?: unknown;
        }) => {
          if (args.select) {
            return pool.map((l) => ({
              categories: l.categories,
              category: l.category,
              reviews: l.reviews,
            }));
          }
          return pool;
        }),
      },
      $transaction: jest.fn().mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          tenantLead: {
            create: prisma.tenantLead.create,
          },
        };
        return fn(tx);
      }),
    };

    const httpService = {
      axiosRef: {
        post: jest.fn().mockImplementation(async () => {
          httpCalls += 1;
          if (httpFailOn != null && httpCalls === httpFailOn) {
            throw new Error('Graph 500');
          }
          return {
            data: {
              messages: [{ id: `wamid.${httpCalls}` }],
            },
          };
        }),
      },
    };

    const platformWhatsapp = {
      resolveCredentials: jest.fn().mockResolvedValue({
        messagesUrl: 'https://graph.example/messages',
        token: 'tok',
        accountId: 1,
      }),
    };

    const runs = {
      openCityRun: jest
        .fn()
        .mockResolvedValue(
          opts && 'openRunResult' in opts
            ? opts.openRunResult
            : openRun(opts?.leadsPerRun ?? 5),
        ),
      beginTry: jest.fn().mockResolvedValue(true),
      recordAccept: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
    };

    const quotaRefill = {
      registerCitySender: jest.fn(),
    };

    const service = new LeadsService(
      prisma as never,
      httpService as never,
      platformWhatsapp as never,
      runs as unknown as OutreachSendRunService,
      quotaRefill as unknown as OutreachQuotaRefillService,
    );

    jest.spyOn(service as never, 'sleep').mockResolvedValue(undefined as never);

    return {
      service,
      prisma,
      httpService,
      runs,
      quotaRefill,
      createdLeads,
      getHttpCalls: () => httpCalls,
      tenant: buildTenant({
        leadsPerRun: opts?.leadsPerRun,
        sendIntervalSeconds: opts?.sendIntervalSeconds ?? 1,
        balance: opts?.balance,
      }),
    };
  }

  it('registra city sender no onModuleInit', () => {
    const { service, quotaRefill } = build();
    service.onModuleInit();
    expect(quotaRefill.registerCitySender).toHaveBeenCalledTimes(1);
  });

  it('abre run, linka runId em todo accept e não abre batch se já há OPEN', async () => {
    const ok = build({ leadsPerRun: 5 });
    await ok.service.contactLeads(ok.tenant as never);

    expect(ok.runs.openCityRun).toHaveBeenCalledWith({
      tenantId: TENANT_ID,
      targetCount: 5,
    });
    expect(ok.runs.recordAccept).toHaveBeenCalledTimes(5);
    expect(ok.createdLeads).toHaveLength(5);
    expect(ok.createdLeads.every((r) => r.runId === RUN_ID)).toBe(true);
    expect(ok.runs.close).not.toHaveBeenCalled();

    const skip = build({ openRunResult: null });
    await skip.service.contactLeads(skip.tenant as never);
    expect(skip.getHttpCalls()).toBe(0);
    expect(skip.runs.beginTry).not.toHaveBeenCalled();
  });

  it('Graph-fail no 2º lead ainda alcança 5 accepts (while refill)', async () => {
    const { service, tenant, runs, createdLeads, getHttpCalls, httpService } =
      build({
        httpFailOnCall: 2,
        leadsPerRun: 5,
        pool: Array.from({ length: 10 }, (_, i) =>
          regularLead(i + 1, `1291111${1000 + i}`),
        ),
      });

    await service.contactLeads(tenant as never);

    expect(getHttpCalls()).toBe(6); // 1 fail + 5 accepts
    expect(runs.recordAccept).toHaveBeenCalledTimes(5);
    expect(createdLeads).toHaveLength(5);
    expect(httpService.axiosRef.post).toHaveBeenCalledTimes(6);
  });

  it('respeita intervalo entre POSTs (sleep entre tentativas)', async () => {
    const { service, tenant } = build({
      leadsPerRun: 3,
      sendIntervalSeconds: 9,
      pool: Array.from({ length: 5 }, (_, i) =>
        regularLead(i + 1, `1292222${1000 + i}`),
      ),
    });
    const sleepSpy = jest
      .spyOn(service as never, 'sleep')
      .mockResolvedValue(undefined as never);

    await service.contactLeads(tenant as never);

    // 3 accepts → 2 sleeps entre posts
    expect(sleepSpy).toHaveBeenCalledTimes(2);
    expect(sleepSpy).toHaveBeenCalledWith(9000);
  });

  it('após fail premium, próximo pick prefere premium', () => {
    const { service } = build();
    const premium = [
      premiumLead(1, '12930000001'),
      premiumLead(2, '12930000002'),
    ] as never[];
    const regular = [regularLead(3, '12930000003')] as never[];

    const picked = service.pickNextCityLead(premium, regular, true);
    expect(picked).not.toBeNull();
    expect([1, 2]).toContain(picked!.id);
  });

  it('premium fail no tick → próximo accept ainda pode ser premium', async () => {
    const pool = [
      premiumLead(1, '12940000001'),
      premiumLead(2, '12940000002'),
      premiumLead(3, '12940000003'),
      premiumLead(4, '12940000004'),
      premiumLead(5, '12940000005'),
      premiumLead(6, '12940000006'),
      regularLead(10, '12940000010'),
    ];
    const { service, tenant, createdLeads } = build({
      pool,
      httpFailOnCall: 1,
      leadsPerRun: 2,
    });

    const preferFlags: boolean[] = [];
    jest.spyOn(service, 'pickNextCityLead').mockImplementation((prem, _reg, prefer) => {
      preferFlags.push(prefer);
      if (preferFlags.length === 1) {
        return pool[0] as never;
      }
      // Após fail premium, preferPremium=true e pool premium restante.
      if (prefer) {
        return (prem[0] ?? pool[1]) as never;
      }
      return (prem[0] ?? null) as never;
    });

    await service.contactLeads(tenant as never);

    expect(preferFlags[0]).toBe(false);
    expect(preferFlags[1]).toBe(true);
    expect(createdLeads.length).toBe(2);
    expect(createdLeads.every((c) => c.wasPremium === true)).toBe(true);
  });

  it('não debita coins no Graph accept', async () => {
    const { service, tenant, prisma } = build({ leadsPerRun: 2 });
    const coinUpdate = jest.fn();
    (prisma.coin as { update?: jest.Mock }).update = coinUpdate;
    await service.contactLeads(tenant as never);
    expect(coinUpdate).not.toHaveBeenCalled();
  });
});

describe('LeadsService.pickNextCityLead', () => {
  const service = new LeadsService(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    { registerCitySender: jest.fn() } as never,
  );

  it('fallback para regular quando preferPremium e premium vazio', () => {
    const regular = [
      {
        id: 9,
        phone: '1',
        rating: 3,
        reviews: 1,
        category: 'C',
        categories: ['C'],
      },
    ] as never[];
    expect(service.pickNextCityLead([], regular, true)?.id).toBe(9);
  });
});
