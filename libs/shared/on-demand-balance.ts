import { Prisma, WhatsappDeliveryStatus } from '@prisma/client';

/**
 * Saldo disponível unificado (design D4):
 * balance − pendingCity×costPerLead − listReserved − pendingOnDemand×costPerOnDemandSend
 *
 * `pendingListAmount` já deve ser Σ(pending da lista × costPerSend da lista).
 */
export function computeAvailableBalance(input: {
  balance: number;
  pendingCity: number;
  costPerLead: number;
  pendingListAmount: number;
  pendingOnDemand: number;
  costPerOnDemandSend: number;
}): number {
  const reserved =
    Math.max(0, input.pendingCity) * Math.max(0, input.costPerLead) +
    Math.max(0, input.pendingListAmount) +
    Math.max(0, input.pendingOnDemand) *
      Math.max(0, input.costPerOnDemandSend);
  return input.balance - reserved;
}

/** lastStatus IS DISTINCT FROM failed (NULL incluído). */
export const lastStatusNotFailed: {
  OR: Array<
    | { lastStatus: null }
    | { lastStatus: { not: typeof WhatsappDeliveryStatus.failed } }
  >;
} = {
  OR: [
    { lastStatus: null },
    { lastStatus: { not: WhatsappDeliveryStatus.failed } },
  ],
};

export function pendingUnchargedCityWhere(
  tenantId: number,
): Prisma.TenantLeadWhereInput {
  return {
    tenantId,
    coinDebitedAt: null,
    ...lastStatusNotFailed,
  };
}

export function pendingUnchargedListSendsWhere(
  listId: number,
): Prisma.TenantListSendWhereInput {
  return {
    coinDebitedAt: null,
    campaign: { listId },
    ...lastStatusNotFailed,
  };
}

export function pendingUnchargedOnDemandWhere(
  tenantId: number,
): Prisma.TenantOnDemandSendWhereInput {
  return {
    tenantId,
    coinDebitedAt: null,
    ...lastStatusNotFailed,
  };
}
