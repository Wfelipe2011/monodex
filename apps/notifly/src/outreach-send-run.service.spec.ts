import {
  OutreachSendRunChannel,
  OutreachSendRunClosedReason,
  OutreachSendRunStatus,
} from '@prisma/client';
import { OutreachSendRunService } from './outreach-send-run.service';

const TENANT_ID = 10;
const CAMPAIGN_ID = 20;

describe('OutreachSendRunService', () => {
  function openRun(overrides?: Partial<{
    id: number;
    channel: OutreachSendRunChannel;
    tenantId: number;
    campaignId: number | null;
    targetCount: number;
    tryCount: number;
    attemptCount: number;
    chargedCount: number;
    status: OutreachSendRunStatus;
    closedReason: OutreachSendRunClosedReason | null;
    expiresAt: Date;
  }>) {
    return {
      id: overrides?.id ?? 1,
      channel: overrides?.channel ?? OutreachSendRunChannel.CITY,
      tenantId: overrides?.tenantId ?? TENANT_ID,
      campaignId: overrides?.campaignId ?? null,
      targetCount: overrides?.targetCount ?? 5,
      tryCount: overrides?.tryCount ?? 0,
      attemptCount: overrides?.attemptCount ?? 0,
      chargedCount: overrides?.chargedCount ?? 0,
      status: overrides?.status ?? OutreachSendRunStatus.OPEN,
      closedReason: overrides?.closedReason ?? null,
      expiresAt: overrides?.expiresAt ?? new Date(Date.now() + 3_600_000),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  function build(opts?: {
    findFirst?: unknown;
    findUnique?: unknown;
    create?: unknown;
  }) {
    const state = {
      run: openRun(),
    };

    const prisma = {
      outreachSendRun: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findFirst: jest.fn().mockResolvedValue(
          opts && 'findFirst' in opts ? opts.findFirst : null,
        ),
        findUnique: jest.fn().mockImplementation(async () => {
          if (opts && 'findUnique' in opts) {
            return opts.findUnique;
          }
          return state.run;
        }),
        create: jest.fn().mockImplementation(async (args: { data: object }) => {
          const created = openRun({
            id: 99,
            ...(args.data as object),
          } as Parameters<typeof openRun>[0]);
          state.run = created;
          return created;
        }),
        update: jest.fn().mockImplementation(async (args: {
          where: { id: number };
          data: Record<string, unknown>;
        }) => {
          state.run = { ...state.run, ...args.data } as typeof state.run;
          return state.run;
        }),
      },
      $transaction: jest.fn(),
    };

    prisma.$transaction.mockImplementation(
      async (fn: (tx: typeof prisma) => unknown) => fn(prisma),
    );

    if (opts?.create != null) {
      prisma.outreachSendRun.create.mockResolvedValue(opts.create);
    }

    const service = new OutreachSendRunService(prisma as never);
    return { service, prisma, state };
  }

  it('openCityRun skip quando já existe OPEN não-expirado', async () => {
    const existing = openRun({ id: 7 });
    const { service, prisma } = build({ findFirst: existing });

    const result = await service.openCityRun({
      tenantId: TENANT_ID,
      targetCount: 5,
    });

    expect(result).toBeNull();
    expect(prisma.outreachSendRun.create).not.toHaveBeenCalled();
  });

  it('openListRun skip quando já existe OPEN para a campanha', async () => {
    const existing = openRun({
      id: 8,
      channel: OutreachSendRunChannel.LIST,
      campaignId: CAMPAIGN_ID,
    });
    const { service, prisma } = build({ findFirst: existing });

    const result = await service.openListRun({
      tenantId: TENANT_ID,
      campaignId: CAMPAIGN_ID,
      targetCount: 5,
    });

    expect(result).toBeNull();
    expect(prisma.outreachSendRun.create).not.toHaveBeenCalled();
  });

  it('openCityRun cria run com expiresAt ~1h quando não há OPEN', async () => {
    const before = Date.now();
    const { service, prisma } = build({ findFirst: null });

    const result = await service.openCityRun({
      tenantId: TENANT_ID,
      targetCount: 5,
    });

    expect(result).not.toBeNull();
    expect(prisma.outreachSendRun.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          channel: OutreachSendRunChannel.CITY,
          tenantId: TENANT_ID,
          targetCount: 5,
        }),
      }),
    );
    const createdAt = (
      prisma.outreachSendRun.create.mock.calls[0][0] as {
        data: { expiresAt: Date };
      }
    ).data.expiresAt.getTime();
    expect(createdAt).toBeGreaterThanOrEqual(before + 3_600_000 - 1000);
    expect(createdAt).toBeLessThanOrEqual(Date.now() + 3_600_000 + 1000);
  });

  it('beginTry recusa e fecha ATTEMPT_CAP quando tryCount >= target*3', async () => {
    const { service, prisma, state } = build();
    state.run = openRun({ tryCount: 15, targetCount: 5 });

    const ok = await service.beginTry(1);

    expect(ok).toBe(false);
    expect(prisma.outreachSendRun.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: OutreachSendRunStatus.CLOSED,
          closedReason: OutreachSendRunClosedReason.ATTEMPT_CAP,
        }),
      }),
    );
  });

  it('beginTry incrementa tryCount quando elegível', async () => {
    const { service, prisma, state } = build();
    state.run = openRun({ tryCount: 2, targetCount: 5 });

    const ok = await service.beginTry(1);

    expect(ok).toBe(true);
    expect(prisma.outreachSendRun.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 1,
          tryCount: 2,
        }),
        data: { tryCount: { increment: 1 } },
      }),
    );
  });

  it('recordCharge fecha TARGET_MET ao atingir target', async () => {
    const { service, prisma, state } = build();
    state.run = openRun({ chargedCount: 4, targetCount: 5 });

    await service.recordCharge(1);

    expect(prisma.outreachSendRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          chargedCount: 5,
          status: OutreachSendRunStatus.CLOSED,
          closedReason: OutreachSendRunClosedReason.TARGET_MET,
        }),
      }),
    );
  });

  it('ensureOpen fecha TTL quando expiresAt no passado', async () => {
    const { service, prisma } = build();
    const expired = openRun({
      expiresAt: new Date(Date.now() - 1000),
    });

    const result = await service.ensureOpen(expired);

    expect(result).toBeNull();
    expect(prisma.outreachSendRun.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          closedReason: OutreachSendRunClosedReason.TTL,
        }),
      }),
    );
  });

  it('recordChargeReversal não desce abaixo de zero', async () => {
    const { service, prisma, state } = build();
    state.run = openRun({ chargedCount: 0 });

    await service.recordChargeReversal(1);

    expect(prisma.outreachSendRun.update).not.toHaveBeenCalled();
  });
});
