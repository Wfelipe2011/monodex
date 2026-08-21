import {
  CoinDebitOnStatus,
  WhatsappDeliveryStatus,
} from '@prisma/client';
import { CoinDebitOnStatusService } from './coin-debit-on-status.service';

const TENANT_ID = 10;
const USER_ID = 5;
const TENANT_LEAD_ID = 77;
const LEAD_ID = 900;
const LIST_SEND_ID = 9;
const COST = 2.5;
const WAMID = 'wamid.test.1';

describe('CoinDebitOnStatusService', () => {
  function build(options?: {
    trigger?: CoinDebitOnStatus | null;
    costPerLead?: number;
    cityLead?: {
      coinDebitedAt?: Date | null;
      coinRefundedAt?: Date | null;
      messageId?: string | null;
    } | null;
    listSend?: {
      coinDebitedAt?: Date | null;
      coinRefundedAt?: Date | null;
      costPerSend?: number;
    } | null;
  }) {
    const cityState = {
      coinDebitedAt: options?.cityLead?.coinDebitedAt ?? null,
      coinRefundedAt: options?.cityLead?.coinRefundedAt ?? null,
    };
    const listState = {
      coinDebitedAt: options?.listSend?.coinDebitedAt ?? null,
      coinRefundedAt: options?.listSend?.coinRefundedAt ?? null,
    };

    const prisma = {
      tenantOutreachConfig: {
        findUnique: jest.fn().mockResolvedValue(
          options?.trigger === null
            ? {
                // config sem gatilho explícito → serviço usa default delivered
                costPerLead: options?.costPerLead ?? COST,
              }
            : {
                coinDebitOnStatus:
                  options?.trigger ?? CoinDebitOnStatus.delivered,
                costPerLead: options?.costPerLead ?? COST,
              },
        ),
      },
      tenantLead: {
        findUnique: jest.fn().mockImplementation(async () => {
          if (options?.cityLead === null) return null;
          return {
            id: TENANT_LEAD_ID,
            tenantId: TENANT_ID,
            leadId: LEAD_ID,
            messageId: options?.cityLead?.messageId ?? WAMID,
            coinDebitedAt: cityState.coinDebitedAt,
            coinRefundedAt: cityState.coinRefundedAt,
          };
        }),
        update: jest.fn().mockImplementation(async (args: {
          data: { coinDebitedAt?: Date; coinRefundedAt?: Date };
        }) => {
          if (args.data.coinDebitedAt != null) {
            cityState.coinDebitedAt = args.data.coinDebitedAt;
          }
          if (args.data.coinRefundedAt != null) {
            cityState.coinRefundedAt = args.data.coinRefundedAt;
          }
          return {};
        }),
      },
      tenantListSend: {
        findUnique: jest.fn().mockImplementation(async () => {
          if (options?.listSend === null) return null;
          return {
            id: LIST_SEND_ID,
            wamid: WAMID,
            coinDebitedAt: listState.coinDebitedAt,
            coinRefundedAt: listState.coinRefundedAt,
            listLead: {
              id: 42,
              list: {
                tenantId: TENANT_ID,
                costPerSend: options?.listSend?.costPerSend ?? COST,
              },
            },
          };
        }),
        update: jest.fn().mockImplementation(async (args: {
          data: { coinDebitedAt?: Date; coinRefundedAt?: Date };
        }) => {
          if (args.data.coinDebitedAt != null) {
            listState.coinDebitedAt = args.data.coinDebitedAt;
          }
          if (args.data.coinRefundedAt != null) {
            listState.coinRefundedAt = args.data.coinRefundedAt;
          }
          return {};
        }),
      },
      coin: {
        findFirst: jest.fn().mockResolvedValue({ userId: USER_ID }),
        update: jest.fn().mockResolvedValue({}),
      },
      coinTransaction: {
        create: jest.fn().mockResolvedValue({}),
      },
      user: {
        findFirst: jest.fn().mockResolvedValue({ id: USER_ID }),
      },
      $transaction: jest.fn(),
    };

    prisma.$transaction.mockImplementation(
      async (fn: (tx: typeof prisma) => unknown) => fn(prisma),
    );

    const service = new CoinDebitOnStatusService(prisma as never);
    return { service, prisma, cityState, listState };
  }

  it('delivered debita com gatilho default delivered (cidade)', async () => {
    const { service, prisma } = build({ trigger: null });

    await service.applyAfterStatus({
      tenantId: TENANT_ID,
      status: WhatsappDeliveryStatus.delivered,
      tenantLeadId: TENANT_LEAD_ID,
    });

    expect(prisma.coin.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { balance: { decrement: COST } },
      }),
    );
    expect(prisma.coinTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'DEBITO',
          amount: -COST,
          leadId: LEAD_ID,
          description: expect.stringContaining('city wamid='),
        }),
      }),
    );
    expect(prisma.tenantLead.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ coinDebitedAt: expect.any(Date) }),
      }),
    );
  });

  it('read debita se gatilho delivered e ainda não debitado', async () => {
    const { service, prisma } = build({
      trigger: CoinDebitOnStatus.delivered,
    });

    await service.applyAfterStatus({
      tenantId: TENANT_ID,
      status: WhatsappDeliveryStatus.read,
      tenantLeadId: TENANT_LEAD_ID,
    });

    expect(prisma.coin.update).toHaveBeenCalled();
    expect(prisma.coinTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: 'DEBITO' }),
      }),
    );
  });

  it('sent não debita com gatilho delivered', async () => {
    const { service, prisma } = build({
      trigger: CoinDebitOnStatus.delivered,
    });

    await service.applyAfterStatus({
      tenantId: TENANT_ID,
      status: WhatsappDeliveryStatus.sent,
      tenantLeadId: TENANT_LEAD_ID,
    });

    expect(prisma.coin.update).not.toHaveBeenCalled();
    expect(prisma.coinTransaction.create).not.toHaveBeenCalled();
  });

  it('segunda chamada não debita de novo (idempotência)', async () => {
    const { service, prisma } = build({
      cityLead: { coinDebitedAt: new Date('2026-01-01') },
    });

    await service.applyAfterStatus({
      tenantId: TENANT_ID,
      status: WhatsappDeliveryStatus.delivered,
      tenantLeadId: TENANT_LEAD_ID,
    });

    expect(prisma.coin.update).not.toHaveBeenCalled();
    expect(prisma.coinTransaction.create).not.toHaveBeenCalled();
  });

  it('lista delivered debita costPerSend', async () => {
    const { service, prisma } = build({
      trigger: CoinDebitOnStatus.delivered,
      listSend: { costPerSend: 3 },
    });

    await service.applyAfterStatus({
      tenantId: TENANT_ID,
      status: WhatsappDeliveryStatus.delivered,
      listSendId: LIST_SEND_ID,
    });

    expect(prisma.coin.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { balance: { decrement: 3 } },
      }),
    );
    expect(prisma.coinTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'DEBITO',
          amount: -3,
          description: expect.stringContaining('list wamid='),
        }),
      }),
    );
    expect(prisma.tenantListSend.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ coinDebitedAt: expect.any(Date) }),
      }),
    );
  });

  it('failed sem débito prévio: no-op de coin', async () => {
    const { service, prisma } = build({
      cityLead: { coinDebitedAt: null },
    });

    await service.applyAfterStatus({
      tenantId: TENANT_ID,
      status: WhatsappDeliveryStatus.failed,
      tenantLeadId: TENANT_LEAD_ID,
    });

    expect(prisma.coin.update).not.toHaveBeenCalled();
    expect(prisma.coinTransaction.create).not.toHaveBeenCalled();
  });

  it('failed com débito: um CREDITO + coinRefundedAt', async () => {
    const { service, prisma } = build({
      cityLead: { coinDebitedAt: new Date('2026-01-01') },
    });

    await service.applyAfterStatus({
      tenantId: TENANT_ID,
      status: WhatsappDeliveryStatus.failed,
      tenantLeadId: TENANT_LEAD_ID,
    });

    expect(prisma.coin.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { balance: { increment: COST } },
      }),
    );
    expect(prisma.coinTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'CREDITO',
          amount: COST,
          description: expect.stringContaining('city refund'),
        }),
      }),
    );
    expect(prisma.tenantLead.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ coinRefundedAt: expect.any(Date) }),
      }),
    );
  });

  it('failed refund é idempotente', async () => {
    const { service, prisma } = build({
      cityLead: {
        coinDebitedAt: new Date('2026-01-01'),
        coinRefundedAt: new Date('2026-01-02'),
      },
    });

    await service.applyAfterStatus({
      tenantId: TENANT_ID,
      status: WhatsappDeliveryStatus.failed,
      tenantLeadId: TENANT_LEAD_ID,
    });

    expect(prisma.coin.update).not.toHaveBeenCalled();
    expect(prisma.coinTransaction.create).not.toHaveBeenCalled();
  });

  it('sent debita quando gatilho é sent', async () => {
    const { service, prisma } = build({
      trigger: CoinDebitOnStatus.sent,
    });

    await service.applyAfterStatus({
      tenantId: TENANT_ID,
      status: WhatsappDeliveryStatus.sent,
      listSendId: LIST_SEND_ID,
    });

    expect(prisma.coin.update).toHaveBeenCalled();
    expect(prisma.coinTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: 'DEBITO' }),
      }),
    );
  });
});
