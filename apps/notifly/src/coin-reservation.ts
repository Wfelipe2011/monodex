import { Prisma, WhatsappDeliveryStatus } from '@prisma/client';

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
  return {
    tenantId,
    coinDebitedAt: null,
    ...lastStatusNotFailed,
  };
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
  return {
    coinDebitedAt: null,
    campaign: { listId },
    OR: [
      { lastStatus: null },
      { lastStatus: { not: WhatsappDeliveryStatus.failed } },
    ],
  };
}
