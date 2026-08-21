import {
  OnDemandScheduleStatus,
  OnDemandSendSource,
  PlatformJobKey,
} from '@prisma/client';
import { OnDemandScheduleCronService } from './on-demand-schedule-cron.service';

const TENANT_ID = 4;
const TEMPLATE_ID = 10;

describe('OnDemandScheduleCronService', () => {
  const approvedTemplate = {
    id: TEMPLATE_ID,
    name: 'hello',
    language: 'pt_BR',
    status: 'APPROVED',
    slots: [{ key: 'body.1', component: 'body', paramType: 'text', index: 1 }],
    components: [],
  };

  function dueSchedule(overrides?: Partial<{
    id: number;
    scheduledFor: Date;
    mediaId: number | null;
    variables: Record<string, string>;
  }>) {
    return {
      id: overrides?.id ?? 1,
      tenantId: TENANT_ID,
      templateId: TEMPLATE_ID,
      phone: '5511999998888',
      scheduledFor: overrides?.scheduledFor ?? new Date('2026-08-22T17:00:00.000Z'),
      variables: overrides?.variables ?? { 'body.1': 'João' },
      mediaId: overrides?.mediaId ?? null,
      leadId: null,
    };
  }

  function build(opts?: {
    scheduleRow?: {
      cronExpression: string;
      timeZone: string;
      enabled: boolean;
    } | null;
    balance?: number;
    grant?: { template: typeof approvedTemplate } | null;
    media?: { id: number; publicId: string } | null;
    claimCount?: number;
    preflightFailUpdateCount?: number;
  }) {
    const coinUpdate = jest.fn();
    const prisma = {
      platformJobSchedule: {
        findUnique: jest.fn().mockResolvedValue(
          opts && 'scheduleRow' in opts
            ? opts.scheduleRow
            : {
                cronExpression: '0 * * * *',
                timeZone: 'America/Sao_Paulo',
                enabled: true,
                jobKey: PlatformJobKey.ON_DEMAND_SCHEDULE_RUN,
              },
        ),
      },
      tenantOnDemandSchedule: {
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({
          count: opts?.claimCount ?? 1,
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      tenant: {
        findUnique: jest.fn().mockResolvedValue({ id: TENANT_ID, active: true }),
      },
      tenantOutreachConfig: {
        findUnique: jest.fn().mockResolvedValue({
          costPerOnDemandSend: 5,
          costPerLead: 10,
          whatsappAccountId: 2,
          whatsappAccount: { isDefault: false },
        }),
      },
      tenantTemplateGrant: {
        findUnique: jest.fn().mockResolvedValue(
          opts && 'grant' in opts
            ? opts.grant
            : { template: approvedTemplate },
        ),
      },
      tenantMedia: {
        findFirst: jest.fn().mockResolvedValue(
          opts && 'media' in opts ? opts.media : null,
        ),
      },
      coin: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ balance: opts?.balance ?? 100 }),
        update: coinUpdate,
      },
      tenantLead: { count: jest.fn().mockResolvedValue(0) },
      tenantOnDemandSend: {
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue({ id: 55, wamid: 'wamid.sched.1' }),
      },
      tenantLeadList: { findMany: jest.fn().mockResolvedValue([]) },
      tenantListSend: { count: jest.fn().mockResolvedValue(0) },
      lead: { findUnique: jest.fn().mockResolvedValue(null) },
      whatsappConversation: {
        upsert: jest.fn().mockResolvedValue({ id: 77 }),
      },
      whatsappConversationMessage: {
        create: jest.fn().mockResolvedValue({ id: 1 }),
      },
    };

    const httpService = {
      axiosRef: {
        post: jest.fn().mockResolvedValue({
          data: { messages: [{ id: 'wamid.sched.1' }] },
        }),
      },
    };

    const jobs = new Map<string, unknown>();
    const schedulerRegistry = {
      addCronJob: jest.fn((name: string, job: unknown) => {
        jobs.set(name, job);
      }),
      deleteCronJob: jest.fn((name: string) => {
        jobs.delete(name);
      }),
      doesExist: jest.fn((type: string, name: string) =>
        type === 'cron' ? jobs.has(name) : false,
      ),
    };

    const platformWhatsapp = {
      resolveCredentials: jest.fn().mockResolvedValue({
        messagesUrl: 'https://graph.facebook.com/v23.0/phone/messages',
        token: 'token-dedicated',
      }),
    };

    const service = new OnDemandScheduleCronService(
      prisma as never,
      httpService as never,
      schedulerRegistry as never,
      platformWhatsapp as never,
    );

    return {
      service,
      prisma,
      httpService,
      schedulerRegistry,
      platformWhatsapp,
      coinUpdate,
      jobs,
    };
  }

  const prevBase = process.env.PUBLIC_API_BASE_URL;

  beforeEach(() => {
    process.env.PUBLIC_API_BASE_URL = 'https://api.example';
  });

  afterEach(() => {
    process.env.PUBLIC_API_BASE_URL = prevBase;
    jest.useRealTimers();
  });

  it('enabled=false não registra cron', async () => {
    const { service, schedulerRegistry, jobs } = build({
      scheduleRow: {
        cronExpression: '0 * * * *',
        timeZone: 'America/Sao_Paulo',
        enabled: false,
      },
    });
    await service.reconcileSchedule();
    expect(schedulerRegistry.addCronJob).not.toHaveBeenCalled();
    expect(jobs.size).toBe(0);
    service.onModuleDestroy();
  });

  it('due + preflight ok → Graph uma vez e SENT com source=SCHEDULE', async () => {
    const { service, prisma, httpService } = build();
    const schedule = dueSchedule();

    const result = await service.processOne(schedule);

    expect(result).toBe('sent');
    expect(httpService.axiosRef.post).toHaveBeenCalledTimes(1);
    expect(prisma.tenantOnDemandSend.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          source: OnDemandSendSource.SCHEDULE,
          wamid: 'wamid.sched.1',
          coinDebitedAt: null,
          scheduleId: schedule.id,
        }),
      }),
    );
    expect(prisma.coin.update).not.toHaveBeenCalled();
  });

  it('futuro não é selecionado em runDueSchedules', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-08-22T16:00:00.000Z'));
    const { service, prisma, httpService } = build();
    prisma.tenantOnDemandSchedule.findMany.mockResolvedValue([]);

    await service.runDueSchedules(new Date('2026-08-22T16:00:00.000Z'));

    expect(prisma.tenantOnDemandSchedule.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: OnDemandScheduleStatus.PENDING,
          scheduledFor: { lte: new Date('2026-08-22T16:00:00.000Z') },
        }),
      }),
    );
    expect(httpService.axiosRef.post).not.toHaveBeenCalled();
  });

  it('saldo insuficiente → FAILED sem Graph e sem débito', async () => {
    const { service, prisma, httpService, coinUpdate } = build({
      balance: 0,
    });
    // First updateMany = mark FAILED; claim not reached
    prisma.tenantOnDemandSchedule.updateMany.mockResolvedValue({ count: 1 });

    const result = await service.processOne(dueSchedule());

    expect(result).toBe('failed');
    expect(httpService.axiosRef.post).not.toHaveBeenCalled();
    expect(prisma.tenantOnDemandSend.create).not.toHaveBeenCalled();
    expect(coinUpdate).not.toHaveBeenCalled();
    expect(prisma.tenantOnDemandSchedule.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: OnDemandScheduleStatus.FAILED,
          failedReason: 'insufficient_balance',
        }),
      }),
    );
  });

  it('grant revogado → FAILED sem Graph', async () => {
    const { service, prisma, httpService } = build({ grant: null });
    prisma.tenantOnDemandSchedule.updateMany.mockResolvedValue({ count: 1 });

    const result = await service.processOne(dueSchedule());

    expect(result).toBe('failed');
    expect(httpService.axiosRef.post).not.toHaveBeenCalled();
    expect(prisma.tenantOnDemandSchedule.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          failedReason: 'template_grant_revoked',
        }),
      }),
    );
  });

  it('imagem apagada → FAILED sem Graph', async () => {
    const { service, prisma, httpService } = build({ media: null });
    prisma.tenantOnDemandSchedule.updateMany.mockResolvedValue({ count: 1 });

    const result = await service.processOne(
      dueSchedule({ mediaId: 42, variables: { 'header.image': 'old' } }),
    );

    expect(result).toBe('failed');
    expect(httpService.axiosRef.post).not.toHaveBeenCalled();
    expect(prisma.tenantOnDemandSchedule.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          failedReason: 'media_missing',
        }),
      }),
    );
  });

  it('claim concorrente (updateMany count 0) → skip sem segundo Graph', async () => {
    const { service, httpService, prisma } = build({ claimCount: 0 });
    // preflight passes; claim returns 0
    prisma.tenantOnDemandSchedule.updateMany.mockResolvedValue({ count: 0 });

    const result = await service.processOne(dueSchedule());

    expect(result).toBe('skipped');
    expect(httpService.axiosRef.post).not.toHaveBeenCalled();
    expect(prisma.tenantOnDemandSend.create).not.toHaveBeenCalled();
  });

  it('dois processOne: segundo claim perde', async () => {
    const { service, httpService, prisma } = build();
    let claimCalls = 0;
    prisma.tenantOnDemandSchedule.updateMany.mockImplementation(async () => {
      claimCalls += 1;
      // first call in success path is the claim (after preflight)
      return { count: claimCalls === 1 ? 1 : 0 };
    });

    const a = await service.processOne(dueSchedule({ id: 1 }));
    // reset claim counter semantics for second worker on same id
    claimCalls = 0;
    prisma.tenantOnDemandSchedule.updateMany.mockResolvedValue({ count: 0 });
    const b = await service.processOne(dueSchedule({ id: 1 }));

    expect(a).toBe('sent');
    expect(b).toBe('skipped');
    expect(httpService.axiosRef.post).toHaveBeenCalledTimes(1);
  });
});
