import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { OnDemandScheduleStatus, Roles } from '@prisma/client';
import { parseSaoPauloHourToUtc } from '@core/shared/sao-paulo-time';
import { OnDemandSchedulesService } from './on-demand-schedules.service';

const TENANT_ID = 4;
const TEMPLATE_ID = 10;

describe('OnDemandSchedulesService', () => {
  const approvedTemplate = {
    id: TEMPLATE_ID,
    name: 'hello',
    language: 'pt_BR',
    status: 'APPROVED',
    slots: [{ key: 'body.1', component: 'body', paramType: 'text', index: 1 }],
    components: [],
  };

  function build(opts?: {
    balanceOutreach?: number;
    grant?: { template: typeof approvedTemplate } | null;
  }) {
    const prisma = {
      tenant: {
        findUnique: jest.fn().mockResolvedValue({ id: TENANT_ID }),
      },
      tenantOutreachConfig: {
        findUnique: jest.fn().mockResolvedValue({
          costPerOnDemandSend: opts?.balanceOutreach ?? 5,
        }),
      },
      tenantTemplateGrant: {
        findUnique: jest.fn().mockResolvedValue(
          opts && 'grant' in opts
            ? opts.grant
            : { template: approvedTemplate },
        ),
      },
      lead: { findUnique: jest.fn() },
      tenantOnDemandSchedule: {
        create: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            id: 99,
            tenantId: data.tenantId,
            templateId: data.templateId,
            phone: data.phone,
            scheduledFor: data.scheduledFor,
            status: data.status,
            mediaId: data.mediaId,
            leadId: data.leadId,
            createdAt: new Date('2026-08-20T12:00:00.000Z'),
          }),
        ),
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
        updateMany: jest.fn(),
      },
    };

    const mediaService = {
      findOwnedByPublicId: jest.fn(),
      publicUrl: jest.fn(
        (id: string) => `https://api.example/public/media/${id}`,
      ),
    };

    const service = new OnDemandSchedulesService(
      prisma as never,
      mediaService as never,
    );
    return { service, prisma, mediaService };
  }

  afterEach(() => {
    jest.useRealTimers();
  });

  it('create futuro → PENDING com scheduledFor UTC', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-08-21T12:00:00.000Z')); // 09:00 SP
    const { service, prisma } = build();

    const result = await service.create(
      TENANT_ID,
      {
        templateId: TEMPLATE_ID,
        to: '11999998888',
        scheduledFor: '2026-08-22T14:00:00',
        variables: { 'body.1': 'João' },
      },
      { roles: [Roles.ADMIN] },
    );

    expect(result.status).toBe(OnDemandScheduleStatus.PENDING);
    expect(result.scheduledFor).toBe('2026-08-22T17:00:00.000Z');
    expect(prisma.tenantOnDemandSchedule.create).toHaveBeenCalled();
  });

  it('create no passado → 400 e não persiste', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-08-22T18:00:00.000Z')); // 15:00 SP
    const { service, prisma } = build();

    await expect(
      service.create(
        TENANT_ID,
        {
          templateId: TEMPLATE_ID,
          to: '11999998888',
          scheduledFor: '2026-08-22T14:00:00',
          variables: { 'body.1': 'João' },
        },
        { roles: [Roles.ADMIN] },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.tenantOnDemandSchedule.create).not.toHaveBeenCalled();
  });

  it('Super Admin POST → 403', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-08-21T12:00:00.000Z'));
    const { service, prisma } = build();

    await expect(
      service.create(
        TENANT_ID,
        {
          templateId: TEMPLATE_ID,
          to: '11999998888',
          scheduledFor: '2026-08-22T14:00:00',
          variables: { 'body.1': 'João' },
        },
        { roles: [Roles.SUPER_ADMIN] },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.tenantOnDemandSchedule.create).not.toHaveBeenCalled();
  });

  it('cancel PENDING → CANCELLED', async () => {
    const { service, prisma } = build();
    prisma.tenantOnDemandSchedule.findFirst
      .mockResolvedValueOnce({
        id: 99,
        status: OnDemandScheduleStatus.PENDING,
      })
      .mockResolvedValueOnce({
        id: 99,
        tenantId: TENANT_ID,
        templateId: TEMPLATE_ID,
        phone: '5511999998888',
        scheduledFor: parseSaoPauloHourToUtc('2026-08-22T14:00:00'),
        status: OnDemandScheduleStatus.CANCELLED,
        failedReason: null,
        onDemandSendId: null,
        mediaId: null,
        leadId: null,
        cancelledAt: new Date(),
        createdAt: new Date(),
      });
    prisma.tenantOnDemandSchedule.updateMany.mockResolvedValue({ count: 1 });

    const result = await service.cancel(TENANT_ID, 99, {
      roles: [Roles.ADMIN],
    });
    expect(result.status).toBe(OnDemandScheduleStatus.CANCELLED);
    expect(prisma.tenantOnDemandSchedule.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: OnDemandScheduleStatus.CANCELLED,
        }),
      }),
    );
  });

  it('cancel SENT → 409', async () => {
    const { service, prisma } = build();
    prisma.tenantOnDemandSchedule.findFirst.mockResolvedValue({
      id: 99,
      status: OnDemandScheduleStatus.SENT,
    });

    await expect(
      service.cancel(TENANT_ID, 99, { roles: [Roles.ADMIN] }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.tenantOnDemandSchedule.updateMany).not.toHaveBeenCalled();
  });

  it('Super Admin cancel → 403', async () => {
    const { service } = build();
    await expect(
      service.cancel(TENANT_ID, 99, { roles: [Roles.SUPER_ADMIN] }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('list/get disponíveis para Super Admin (sem write)', async () => {
    const { service, prisma } = build();
    prisma.tenantOnDemandSchedule.findMany.mockResolvedValue([]);
    prisma.tenantOnDemandSchedule.findFirst.mockResolvedValue({
      id: 1,
      tenantId: TENANT_ID,
      templateId: TEMPLATE_ID,
      phone: '5511999998888',
      scheduledFor: parseSaoPauloHourToUtc('2026-08-22T14:00:00'),
      status: OnDemandScheduleStatus.PENDING,
      failedReason: null,
      onDemandSendId: null,
      mediaId: null,
      leadId: null,
      cancelledAt: null,
      createdAt: new Date(),
    });

    await expect(service.list(TENANT_ID)).resolves.toEqual([]);
    await expect(service.getById(TENANT_ID, 1)).resolves.toMatchObject({
      id: 1,
      status: OnDemandScheduleStatus.PENDING,
    });
  });
});
