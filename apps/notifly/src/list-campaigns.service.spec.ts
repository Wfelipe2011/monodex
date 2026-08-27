import {
  OutreachSendRunClosedReason,
  OutreachSendRunStatus,
} from '@prisma/client';
import { ListCampaignsService } from './list-campaigns.service';

jest.mock('./conversation-thread', () => ({
  isDedicatedBoundToTenant: jest.fn().mockResolvedValue(false),
  upsertConversationThenMessage: jest.fn(),
}));

const TENANT_ID = 7;
const CAMPAIGN_ID = 3;
const LIST_ID = 11;
const RUN_ID = 99;

describe('ListCampaignsService run/refill', () => {
  function tenant(overrides?: Partial<{ active: boolean; phone: string }>) {
    return {
      id: TENANT_ID,
      active: overrides?.active ?? true,
      phone: overrides?.phone ?? '5511999990000',
      name: 'Tenant',
    };
  }

  function campaign(overrides?: Partial<{
    sendsPerRun: number;
    sendIntervalSeconds: number;
    costPerSend: number;
  }>) {
    const costPerSend = overrides?.costPerSend ?? 2;
    return {
      id: CAMPAIGN_ID,
      listId: LIST_ID,
      enabled: true,
      sendsPerRun: overrides?.sendsPerRun ?? 5,
      sendIntervalSeconds: overrides?.sendIntervalSeconds ?? 0,
      schedule: {},
      slotBindings: {
        send: {
          'body.1': { type: 'literal', value: 'Oi' },
        },
      },
      list: {
        id: LIST_ID,
        tenantId: TENANT_ID,
        costPerSend,
        tenant: tenant(),
      },
      template: {
        id: 1,
        name: 'hello_list',
        language: 'pt_BR',
        status: 'APPROVED',
        slots: [
          {
            key: 'body.1',
            component: 'body',
            paramType: 'text',
            index: 1,
          },
        ],
      },
    };
  }

  function listLead(id: number, phone: string) {
    return {
      id,
      listId: LIST_ID,
      phone,
      name: `Lead ${id}`,
      category: null,
      website: null,
      reviews: null,
      sendLockCampaignId: null,
      sends: [],
    };
  }

  function openRun(overrides?: Partial<{
    id: number;
    targetCount: number;
    tryCount: number;
    status: OutreachSendRunStatus;
  }>) {
    return {
      id: overrides?.id ?? RUN_ID,
      channel: 'LIST',
      tenantId: TENANT_ID,
      campaignId: CAMPAIGN_ID,
      targetCount: overrides?.targetCount ?? 5,
      tryCount: overrides?.tryCount ?? 0,
      attemptCount: 0,
      chargedCount: 0,
      status: overrides?.status ?? OutreachSendRunStatus.OPEN,
      closedReason: null,
      expiresAt: new Date(Date.now() + 3_600_000),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  function build(opts?: {
    openListRunResult?: ReturnType<typeof openRun> | null;
    balance?: number;
    leads?: ReturnType<typeof listLead>[];
    graphFailLeadIds?: number[];
    beginTryResults?: boolean[];
  }) {
    const leads = opts?.leads ?? [
      listLead(1, '11911110001'),
      listLead(2, '11911110002'),
      listLead(3, '11911110003'),
      listLead(4, '11911110004'),
      listLead(5, '11911110005'),
      listLead(6, '11911110006'),
    ];
    const failIds = new Set(opts?.graphFailLeadIds ?? []);
    let beginTryIdx = 0;
    let tryCount = 0;
    const createdSends: Array<{
      listLeadId: number;
      runId: number | null;
      wamid: string;
    }> = [];
    let sendSeq = 0;

    const prisma = {
      coin: {
        findFirst: jest.fn().mockResolvedValue({
          balance: opts?.balance ?? 100,
        }),
      },
      tenantOutreachConfig: {
        findUnique: jest.fn().mockResolvedValue({
          costPerLead: 10,
          costPerOnDemandSend: 5,
        }),
      },
      tenantLead: {
        count: jest.fn().mockResolvedValue(0),
      },
      tenantOnDemandSend: {
        count: jest.fn().mockResolvedValue(0),
      },
      tenantLeadList: {
        findMany: jest.fn().mockResolvedValue([
          { id: LIST_ID, costPerSend: 2 },
        ]),
      },
      tenantListSend: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockImplementation(async (args: {
          where?: { runId?: number };
        }) => {
          if (args.where?.runId != null) {
            return createdSends
              .filter((s) => s.runId === args.where!.runId)
              .map((s) => ({ listLeadId: s.listLeadId }));
          }
          return [];
        }),
        create: jest.fn().mockImplementation(async ({ data }: {
          data: {
            campaignId: number;
            listLeadId: number;
            wamid: string;
            runId?: number | null;
          };
        }) => {
          sendSeq += 1;
          const row = {
            id: sendSeq,
            ...data,
            runId: data.runId ?? null,
          };
          createdSends.push({
            listLeadId: data.listLeadId,
            runId: data.runId ?? null,
            wamid: data.wamid,
          });
          return row;
        }),
      },
      tenantListLead: {
        findMany: jest.fn().mockResolvedValue(leads),
        update: jest.fn().mockResolvedValue({}),
      },
      tenantListCampaign: {
        findUnique: jest.fn(),
      },
      $transaction: jest.fn().mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          tenantListSend: {
            create: prisma.tenantListSend.create,
          },
          tenantListLead: {
            update: prisma.tenantListLead.update,
          },
        }),
      ),
    };

    const httpService = {
      axiosRef: {
        post: jest.fn().mockImplementation(async (_url: string, body: { to?: string }) => {
          const phoneDigits = String(body.to ?? '').replace(/\D/g, '');
          const matched = leads.find((l) => {
            const d = l.phone.replace(/\D/g, '');
            const normalized = d.startsWith('55') ? d : `55${d}`;
            return normalized === phoneDigits;
          });

          if (matched && failIds.has(matched.id)) {
            const err = new Error(`Graph fail lead ${matched.id}`) as Error & {
              response?: { data?: unknown };
            };
            err.response = { data: { error: 'fail' } };
            throw err;
          }

          return {
            data: {
              messages: [{ id: `wamid.${matched?.id ?? 'x'}` }],
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

    const beginTryResults = opts?.beginTryResults;
    const sendRuns = {
      openListRun: jest.fn().mockResolvedValue(
        opts && 'openListRunResult' in opts
          ? opts.openListRunResult
          : openRun(),
      ),
      beginTry: jest.fn().mockImplementation(async () => {
        if (beginTryResults) {
          const v = beginTryResults[beginTryIdx] ?? false;
          beginTryIdx += 1;
          return v;
        }
        const target = (opts?.openListRunResult ?? openRun()).targetCount;
        if (tryCount >= target * 3) {
          return false;
        }
        tryCount += 1;
        return true;
      }),
      recordAccept: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
    };

    const quotaRefill = {
      registerListSender: jest.fn(),
    };

    const service = new ListCampaignsService(
      prisma as never,
      httpService as never,
      platformWhatsapp as never,
      sendRuns as never,
      quotaRefill as never,
    );

    jest.spyOn(service as unknown as { sleep: (ms: number) => Promise<void> }, 'sleep')
      .mockResolvedValue(undefined);

    return {
      service,
      prisma,
      httpService,
      sendRuns,
      quotaRefill,
      createdSends,
      getTryCount: () => tryCount,
    };
  }

  it('registra list sender no onModuleInit', () => {
    const { service, quotaRefill } = build();
    service.onModuleInit();
    expect(quotaRefill.registerListSender).toHaveBeenCalledWith(
      expect.any(Function),
    );
  });

  it('skip batch quando openListRun retorna null (OPEN existente)', async () => {
    const { service, sendRuns, httpService } = build({
      openListRunResult: null,
    });

    await (service as unknown as {
      runCampaign: (c: unknown) => Promise<void>;
    }).runCampaign(campaign());

    expect(sendRuns.openListRun).toHaveBeenCalledWith({
      tenantId: TENANT_ID,
      campaignId: CAMPAIGN_ID,
      targetCount: 5,
    });
    expect(httpService.axiosRef.post).not.toHaveBeenCalled();
    expect(sendRuns.beginTry).not.toHaveBeenCalled();
  });

  it('list sends do tick têm runId e recordAccept', async () => {
    const { service, sendRuns, createdSends, httpService } = build({
      leads: [
        listLead(1, '11911110001'),
        listLead(2, '11911110002'),
        listLead(3, '11911110003'),
      ],
    });

    await (service as unknown as {
      runCampaign: (c: unknown) => Promise<void>;
    }).runCampaign(campaign({ sendsPerRun: 3 }));

    expect(httpService.axiosRef.post).toHaveBeenCalledTimes(3);
    expect(createdSends).toHaveLength(3);
    expect(createdSends.every((s) => s.runId === RUN_ID)).toBe(true);
    expect(sendRuns.recordAccept).toHaveBeenCalledTimes(3);
    expect(sendRuns.close).not.toHaveBeenCalled();
  });

  it('Graph fail mid-batch ainda alcança target accepts com outro list lead', async () => {
    const { service, sendRuns, createdSends, httpService } = build({
      graphFailLeadIds: [2],
      leads: [
        listLead(1, '11911110001'),
        listLead(2, '11911110002'),
        listLead(3, '11911110003'),
        listLead(4, '11911110004'),
        listLead(5, '11911110005'),
        listLead(6, '11911110006'),
      ],
    });

    await (service as unknown as {
      runCampaign: (c: unknown) => Promise<void>;
    }).runCampaign(campaign({ sendsPerRun: 5 }));

    // 1 fail + 5 accepts = 6 POSTs
    expect(httpService.axiosRef.post).toHaveBeenCalledTimes(6);
    expect(createdSends).toHaveLength(5);
    expect(createdSends.map((s) => s.listLeadId)).not.toContain(2);
    expect(createdSends.every((s) => s.runId === RUN_ID)).toBe(true);
    expect(sendRuns.recordAccept).toHaveBeenCalledTimes(5);
    // Failed lead 2 must not be reused as accept
    expect(new Set(createdSends.map((s) => s.listLeadId)).size).toBe(5);
  });

  it('respeita try cap sendsPerRun * 3', async () => {
    const manyLeads = Array.from({ length: 20 }, (_, i) =>
      listLead(i + 1, `1191111${String(i + 1).padStart(4, '0')}`),
    );
    const { service, sendRuns, httpService, getTryCount } = build({
      graphFailLeadIds: manyLeads.map((l) => l.id),
      leads: manyLeads,
      openListRunResult: openRun({ targetCount: 5 }),
    });

    await (service as unknown as {
      runCampaign: (c: unknown) => Promise<void>;
    }).runCampaign(campaign({ sendsPerRun: 5 }));

    expect(getTryCount()).toBeLessThanOrEqual(15);
    expect(httpService.axiosRef.post.mock.calls.length).toBeLessThanOrEqual(15);
    expect(sendRuns.recordAccept).not.toHaveBeenCalled();
  });

  it('fecha EXHAUSTED quando pool acaba antes do target', async () => {
    const { service, sendRuns, createdSends } = build({
      leads: [listLead(1, '11911110001'), listLead(2, '11911110002')],
    });

    await (service as unknown as {
      runCampaign: (c: unknown) => Promise<void>;
    }).runCampaign(campaign({ sendsPerRun: 5 }));

    expect(createdSends).toHaveLength(2);
    expect(sendRuns.close).toHaveBeenCalledWith(
      RUN_ID,
      OutreachSendRunClosedReason.EXHAUSTED,
    );
  });
});
