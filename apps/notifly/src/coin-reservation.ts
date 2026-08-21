import { Prisma, WhatsappDeliveryStatus } from '@prisma/client';
import {
  computeAvailableBalance,
  pendingUnchargedCityWhere as sharedPendingCityWhere,
  pendingUnchargedListSendsWhere as sharedPendingListWhere,
  pendingUnchargedOnDemandWhere,
} from '@core/shared/on-demand-balance';

/**
 * Status that still reserve balance / block phone reuse:
 * null (pending) and any delivery status except failed.
 */
export function isUnchargedPendingStatus(
  lastStatus: WhatsappDeliveryStatus | null | undefined,
): boolean {
  return lastStatus !== WhatsappDeliveryStatus.failed;
}

/** Phone exclusion for city outreach: failed does NOT exclude. */
export function isCityPhoneExcludedByStatus(
  lastStatus: WhatsappDeliveryStatus | null | undefined,
): boolean {
  return isUnchargedPendingStatus(lastStatus);
}

/**
 * Legacy single-channel helper (city-or-list only).
 * Prefer `computeAvailableBalance` + `affordableFromAvailable` for cross-channel.
 */
export function computeAffordableSends(
  balance: number,
  pendingCount: number,
  unitCost: number,
): number {
  if (unitCost <= 0) {
    return 0;
  }
  const available = balance - pendingCount * unitCost;
  return Math.max(0, Math.floor(available / unitCost));
}

export function affordableFromAvailable(
  available: number,
  unitCost: number,
): number {
  if (unitCost <= 0) {
    return 0;
  }
  return Math.max(0, Math.floor(available / unitCost));
}

export { computeAvailableBalance, pendingUnchargedOnDemandWhere };

/** Prisma filter: lastStatus IS DISTINCT FROM failed (NULL included). */
export const lastStatusNotFailed: Prisma.TenantLeadWhereInput = {
  OR: [
    { lastStatus: null },
    { lastStatus: { not: WhatsappDeliveryStatus.failed } },
  ],
};

export function pendingUnchargedCityWhere(
  tenantId: number,
): Prisma.TenantLeadWhereInput {
  return sharedPendingCityWhere(tenantId);
}

export function cityUsedPhonesWhere(
  tenantId: number,
): Prisma.TenantLeadWhereInput {
  return {
    tenantId,
    ...lastStatusNotFailed,
  };
}

export function pendingUnchargedListSendsWhere(
  listId: number,
): Prisma.TenantListSendWhereInput {
  return sharedPendingListWhere(listId);
}

type PendingCountsClient = {
  tenantLead: {
    count: (args: {
      where: Prisma.TenantLeadWhereInput;
    }) => Promise<number>;
  };
  tenantOnDemandSend: {
    count: (args: {
      where: Prisma.TenantOnDemandSendWhereInput;
    }) => Promise<number>;
  };
  tenantLeadList: {
    findMany: (args: {
      where: { tenantId: number };
      select: { id: true; costPerSend: true };
    }) => Promise<Array<{ id: number; costPerSend: number }>>;
  };
  tenantListSend: {
    count: (args: {
      where: Prisma.TenantListSendWhereInput;
    }) => Promise<number>;
  };
};

/** Soma pending × custo dos três canais para um tenant. */
export async function loadCrossChannelPending(
  prisma: PendingCountsClient,
  tenantId: number,
): Promise<{
  pendingCity: number;
  pendingListAmount: number;
  pendingOnDemand: number;
}> {
  const [pendingCity, pendingOnDemand, lists] = await Promise.all([
    prisma.tenantLead.count({
      where: pendingUnchargedCityWhere(tenantId),
    }),
    prisma.tenantOnDemandSend.count({
      where: pendingUnchargedOnDemandWhere(tenantId),
    }),
    prisma.tenantLeadList.findMany({
      where: { tenantId },
      select: { id: true, costPerSend: true },
    }),
  ]);

  let pendingListAmount = 0;
  for (const list of lists) {
    const pending = await prisma.tenantListSend.count({
      where: pendingUnchargedListSendsWhere(list.id),
    });
    pendingListAmount += pending * list.costPerSend;
  }

  return { pendingCity, pendingListAmount, pendingOnDemand };
}
