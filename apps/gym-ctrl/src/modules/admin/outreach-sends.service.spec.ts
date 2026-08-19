import { NotFoundException } from '@nestjs/common';
import { WhatsappDeliveryStatus } from '@prisma/client';
import { OutreachSendsService } from './outreach-sends.service';

describe('OutreachSendsService', () => {
  const sentAtNew = new Date('2026-08-18T20:05:00.000Z');
  const sentAtOld = new Date('2026-08-18T19:00:00.000Z');

  const citySend = {
    id: 12,
    tenantId: 4,
    messageId: 'wamid.city',
    createdAt: sentAtNew,
    lastStatus: WhatsappDeliveryStatus.delivered,
    templateName: 'hello_city',
    lead: { id: 90, name: 'Academia X', phone: '11999999999' },
  };

  const capturaContact = {
    id: 13,
    tenantId: 4,
    messageId: null,
    createdAt: sentAtOld,
    lastStatus: null,
    templateName: null,
    lead: { id: 91, name: 'Captura Y', phone: '11888888888' },
  };

  const failedSend = {
    id: 14,
    tenantId: 4,
    messageId: 'wamid.fail',
    createdAt: sentAtOld,
    lastStatus: WhatsappDeliveryStatus.failed,
    templateName: 'hello_city',
    lead: { id: 92, name: 'Studio Z', phone: '11777777777' },
  };

  function build(opts?: {
    tenants?: Record<number, { id: number } | null>;
    leads?: Array<typeof citySend | typeof capturaContact | typeof failedSend>;
    statusRows?: Array<{
      wamid: string;
      errors: unknown;
      metaTimestamp: Date;
    }>;
  }) {
    const tenants: Record<number, { id: number } | null> = {
      4: { id: 4 },
      ...(opts?.tenants ?? {}),
    };
    const leads = opts?.leads ?? [citySend, capturaContact, failedSend];
    const statusRows = opts?.statusRows ?? [];

    const prisma = {
      tenant: {
        findUnique: jest.fn(
          async ({ where: { id } }: { where: { id: number } }) =>
            Object.prototype.hasOwnProperty.call(tenants, id)
              ? tenants[id]
              : { id },
        ),
      },
      tenantLead: {
        findMany: jest.fn(
          async ({
            where,
            take,
          }: {
            where: {
              tenantId: number;
              messageId?: { not: null };
              lastStatus?: WhatsappDeliveryStatus;
            };
            take?: number;
          }) => {
            let rows = leads.filter((row) => row.tenantId === where.tenantId);
            if (where.messageId?.not === null) {
              rows = rows.filter((row) => row.messageId != null);
            }
            if (where.lastStatus !== undefined) {
              rows = rows.filter((row) => row.lastStatus === where.lastStatus);
            }
            rows = [...rows].sort(
              (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
            );
            return rows.slice(0, take ?? rows.length);
          },
        ),
      },
      whatsappSendStatus: {
        findMany: jest.fn(
          async ({
            where,
          }: {
            where: {
              wamid: { in: string[] };
              status: WhatsappDeliveryStatus;
            };
          }) => {
            const wamids = new Set(where.wamid.in);
            return statusRows
              .filter(
                (row) =>
                  wamids.has(row.wamid) && row.wamid && where.status === 'failed',
              )
              .sort(
                (a, b) => b.metaTimestamp.getTime() - a.metaTimestamp.getTime(),
              );
          },
        ),
      },
      tenantListSend: {
        findMany: jest.fn(),
      },
    };

    const service = new OutreachSendsService(prisma as never);
    return { service, prisma };
  }

  it('tenant inexistente → NotFoundException', async () => {
    const { service, prisma } = build({ tenants: { 99: null } });

    await expect(service.listSends(99, {})).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.tenantLead.findMany).not.toHaveBeenCalled();
    expect(prisma.tenantListSend.findMany).not.toHaveBeenCalled();
  });

  it('exclui TenantLead sem messageId (captura) e não consulta TenantListSend', async () => {
    const { service, prisma } = build();

    const result = await service.listSends(4, {});

    expect(prisma.tenantLead.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 4,
          messageId: { not: null },
        }),
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
    );
    expect(result).toHaveLength(2);
    expect(result.map((row) => row.wamid)).toEqual([
      'wamid.city',
      'wamid.fail',
    ]);
    expect(result.some((row) => row.wamid == null)).toBe(false);
    expect(result.every((row) => 'lead' in row)).toBe(true);
    expect(result[0]).toMatchObject({
      id: 12,
      wamid: 'wamid.city',
      lastStatus: WhatsappDeliveryStatus.delivered,
      templateName: 'hello_city',
      lead: { id: 90, name: 'Academia X', phone: '11999999999' },
    });
    expect(result[0]).not.toHaveProperty('listLead');
    expect(result[0]).not.toHaveProperty('campaign');
    expect(prisma.tenantListSend.findMany).not.toHaveBeenCalled();
  });

  it('status=failed filtra lastStatus e usa o latestError mais recente', async () => {
    const olderError = {
      wamid: 'wamid.fail',
      errors: { code: 1, title: 'old' },
      metaTimestamp: new Date('2026-08-18T18:00:00.000Z'),
    };
    const newerError = {
      wamid: 'wamid.fail',
      errors: { code: 131026, title: 'Message undeliverable' },
      metaTimestamp: new Date('2026-08-18T19:30:00.000Z'),
    };
    const { service, prisma } = build({
      statusRows: [olderError, newerError],
    });

    const result = await service.listSends(4, { status: 'failed' });

    expect(prisma.tenantLead.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 4,
          messageId: { not: null },
          lastStatus: WhatsappDeliveryStatus.failed,
        }),
      }),
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 14,
      wamid: 'wamid.fail',
      lastStatus: WhatsappDeliveryStatus.failed,
      templateName: 'hello_city',
      lead: { id: 92, name: 'Studio Z', phone: '11777777777' },
      latestError: { code: 131026, title: 'Message undeliverable' },
    });
    expect(prisma.whatsappSendStatus.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          wamid: { in: ['wamid.fail'] },
          status: WhatsappDeliveryStatus.failed,
        },
        orderBy: { metaTimestamp: 'desc' },
      }),
    );
    expect(prisma.tenantListSend.findMany).not.toHaveBeenCalled();
  });

  it('outro valor de status não aplica filtro de lastStatus', async () => {
    const { service, prisma } = build();

    const result = await service.listSends(4, { status: 'delivered' });

    expect(prisma.tenantLead.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: 4, messageId: { not: null } },
      }),
    );
    expect(result).toHaveLength(2);
    expect(prisma.tenantListSend.findMany).not.toHaveBeenCalled();
  });
});
