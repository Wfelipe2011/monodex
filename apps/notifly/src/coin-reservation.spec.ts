import { WhatsappDeliveryStatus } from '@prisma/client';
import {
  cityUsedPhonesWhere,
  computeAffordableSends,
  isCityPhoneExcludedByStatus,
  pendingUnchargedCityWhere,
  pendingUnchargedListSendsWhere,
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
});
