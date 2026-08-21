import { WhatsappDeliveryStatus } from '@prisma/client';
import {
  affordableFromAvailable,
  cityUsedPhonesWhere,
  computeAffordableSends,
  computeAvailableBalance,
  isCityPhoneExcludedByStatus,
  loadCrossChannelPending,
  pendingUnchargedCityWhere,
  pendingUnchargedListSendsWhere,
  pendingUnchargedOnDemandWhere,
} from './coin-reservation';

describe('computeAffordableSends', () => {
  it('reserva pending e reduz affordable', () => {
    // balance cobre 3, 2 pending → affordable 1
    expect(computeAffordableSends(30, 2, 10)).toBe(1);
  });

  it('com 1 pending e saldo de 1 unidade, affordable é 0', () => {
    expect(computeAffordableSends(10, 1, 10)).toBe(0);
  });

  it('sem pending usa balance bruto', () => {
    expect(computeAffordableSends(25, 0, 10)).toBe(2);
  });

  it('unitCost inválido retorna 0', () => {
    expect(computeAffordableSends(100, 0, 0)).toBe(0);
    expect(computeAffordableSends(100, 0, -5)).toBe(0);
  });
});

describe('reserva unificada (computeAvailableBalance + affordable)', () => {
  it('1 on-demand pending reduz affordable de cidade (cenário do spec)', () => {
    // balance 2, costPerLead 1, 1 on-demand pending × 1 → available 1 → affordable 1
    const available = computeAvailableBalance({
      balance: 2,
      pendingCity: 0,
      costPerLead: 1,
      pendingListAmount: 0,
      pendingOnDemand: 1,
      costPerOnDemandSend: 1,
    });
    expect(available).toBe(1);
    expect(affordableFromAvailable(available, 1)).toBe(1);
  });

  it('failed on-demand não entra no pending (count 0)', () => {
    const available = computeAvailableBalance({
      balance: 2,
      pendingCity: 0,
      costPerLead: 1,
      pendingListAmount: 0,
      pendingOnDemand: 0,
      costPerOnDemandSend: 1,
    });
    expect(affordableFromAvailable(available, 1)).toBe(2);
  });

  it('pending de lista também reduz affordable de cidade', () => {
    // 30 − 0 − 20 − 0 = 10 → floor(10/10)=1
    const available = computeAvailableBalance({
      balance: 30,
      pendingCity: 0,
      costPerLead: 10,
      pendingListAmount: 20,
      pendingOnDemand: 0,
      costPerOnDemandSend: 5,
    });
    expect(affordableFromAvailable(available, 10)).toBe(1);
  });
});

describe('isCityPhoneExcludedByStatus', () => {
  it('failed não exclui o phone', () => {
    expect(isCityPhoneExcludedByStatus(WhatsappDeliveryStatus.failed)).toBe(
      false,
    );
  });

  it('null (pendente) continua excluído', () => {
    expect(isCityPhoneExcludedByStatus(null)).toBe(true);
    expect(isCityPhoneExcludedByStatus(undefined)).toBe(true);
  });

  it('sent/delivered/read continuam excluídos', () => {
    expect(isCityPhoneExcludedByStatus(WhatsappDeliveryStatus.sent)).toBe(true);
    expect(isCityPhoneExcludedByStatus(WhatsappDeliveryStatus.delivered)).toBe(
      true,
    );
    expect(isCityPhoneExcludedByStatus(WhatsappDeliveryStatus.read)).toBe(true);
  });
});

describe('pending / used-phone where clauses', () => {
  it('pending cidade exige coinDebitedAt null e status ≠ failed', () => {
    const where = pendingUnchargedCityWhere(7);
    expect(where).toMatchObject({
      tenantId: 7,
      coinDebitedAt: null,
    });
    expect(where.OR).toEqual([
      { lastStatus: null },
      { lastStatus: { not: WhatsappDeliveryStatus.failed } },
    ]);
  });

  it('used phones cidade não filtra só por tenant — exclui failed via OR', () => {
    const where = cityUsedPhonesWhere(3);
    expect(where.tenantId).toBe(3);
    expect(where.OR).toEqual([
      { lastStatus: null },
      { lastStatus: { not: WhatsappDeliveryStatus.failed } },
    ]);
    expect(where).not.toHaveProperty('coinDebitedAt');
  });

  it('pending lista escopa por listId via campaign', () => {
    const where = pendingUnchargedListSendsWhere(42);
    expect(where).toMatchObject({
      coinDebitedAt: null,
      campaign: { listId: 42 },
    });
    expect(where.OR).toEqual([
      { lastStatus: null },
      { lastStatus: { not: WhatsappDeliveryStatus.failed } },
    ]);
  });

  it('pending on-demand escopa por tenant', () => {
    const where = pendingUnchargedOnDemandWhere(4);
    expect(where).toMatchObject({
      tenantId: 4,
      coinDebitedAt: null,
    });
  });
});

describe('loadCrossChannelPending', () => {
  it('soma pendingListAmount × costPerSend e conta on-demand', async () => {
    const prisma = {
      tenantLead: {
        count: jest.fn().mockResolvedValue(2),
      },
      tenantOnDemandSend: {
        count: jest.fn().mockResolvedValue(1),
      },
      tenantLeadList: {
        findMany: jest.fn().mockResolvedValue([
          { id: 1, costPerSend: 3 },
          { id: 2, costPerSend: 5 },
        ]),
      },
      tenantListSend: {
        count: jest
          .fn()
          .mockResolvedValueOnce(2) // list 1 → 2*3=6
          .mockResolvedValueOnce(1), // list 2 → 1*5=5
      },
    };

    const result = await loadCrossChannelPending(prisma as never, 9);
    expect(result).toEqual({
      pendingCity: 2,
      pendingListAmount: 11,
      pendingOnDemand: 1,
    });
    expect(prisma.tenantOnDemandSend.count).toHaveBeenCalledWith({
      where: pendingUnchargedOnDemandWhere(9),
    });
  });
});
