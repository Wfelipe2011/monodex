import { WhatsappDeliveryStatus } from '@prisma/client';
import {
  computeAvailableBalance,
  pendingUnchargedCityWhere,
  pendingUnchargedListSendsWhere,
  pendingUnchargedOnDemandWhere,
} from './on-demand-balance';

describe('computeAvailableBalance', () => {
  it('subtrai os três canais', () => {
    // 100 − 2×10 − 30 − 1×5 = 45
    expect(
      computeAvailableBalance({
        balance: 100,
        pendingCity: 2,
        costPerLead: 10,
        pendingListAmount: 30,
        pendingOnDemand: 1,
        costPerOnDemandSend: 5,
      }),
    ).toBe(45);
  });

  it('sem pending devolve o balance', () => {
    expect(
      computeAvailableBalance({
        balance: 50,
        pendingCity: 0,
        costPerLead: 10,
        pendingListAmount: 0,
        pendingOnDemand: 0,
        costPerOnDemandSend: 5,
      }),
    ).toBe(50);
  });

  it('custo ≤ 0 não reserva no respectivo canal', () => {
    expect(
      computeAvailableBalance({
        balance: 40,
        pendingCity: 3,
        costPerLead: 0,
        pendingListAmount: 0,
        pendingOnDemand: 2,
        costPerOnDemandSend: -1,
      }),
    ).toBe(40);
  });
});

describe('pending where clauses', () => {
  it('cidade', () => {
    expect(pendingUnchargedCityWhere(4)).toMatchObject({
      tenantId: 4,
      coinDebitedAt: null,
    });
  });

  it('lista', () => {
    expect(pendingUnchargedListSendsWhere(9)).toMatchObject({
      coinDebitedAt: null,
      campaign: { listId: 9 },
    });
  });

  it('on-demand inclui lastStatus null e exclui failed', () => {
    const where = pendingUnchargedOnDemandWhere(4);
    expect(where).toMatchObject({
      tenantId: 4,
      coinDebitedAt: null,
    });
    expect(where.OR).toEqual([
      { lastStatus: null },
      { lastStatus: { not: WhatsappDeliveryStatus.failed } },
    ]);
  });
});
