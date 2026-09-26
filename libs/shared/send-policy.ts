import { BadRequestException } from '@nestjs/common';

export type CityIdFilter = { in: number[] } | { notIn: number[] };

export function assertCityPolicyXor(allowed: number[], denied: number[]): void {
  if (allowed.length > 0 && denied.length > 0) {
    throw new BadRequestException(
      'allowedCityIds e deniedCityIds são mutuamente exclusivos',
    );
  }
}

export function asIntArray(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => Number(item))
    .filter((n) => Number.isInteger(n) && n >= 1);
}

export type TenantSendPolicyCityIds = {
  allowedCityIds: unknown;
  deniedCityIds: unknown;
};

/**
 * Validates optional campaign `cityId` against tenant send policy (HTTP layer uses thrown error).
 * Null/undefined `cityId` is always allowed (no extra city filter on the campaign).
 */
export function assertCampaignCityAllowed(
  cityId: number | null | undefined,
  policy: TenantSendPolicyCityIds,
): void {
  const allowed = asIntArray(policy.allowedCityIds);
  const denied = asIntArray(policy.deniedCityIds);
  assertCityPolicyXor(allowed, denied);

  if (cityId == null) {
    return;
  }

  if (!Number.isInteger(cityId) || cityId < 1) {
    throw new BadRequestException('cityId inválido para a política de envio');
  }

  if (allowed.length === 1 && cityId !== allowed[0]) {
    throw new BadRequestException(
      'cityId da campanha não permitido pela política de envio do tenant',
    );
  }

  if (allowed.length > 0 && !allowed.includes(cityId)) {
    throw new BadRequestException(
      'cityId da campanha não permitido pela política de envio do tenant',
    );
  }

  if (denied.includes(cityId)) {
    throw new BadRequestException(
      'cityId da campanha não permitido pela política de envio do tenant',
    );
  }
}

export function cityAllowed(
  cityId: number,
  allowed: number[],
  denied: number[],
): boolean {
  if (allowed.length === 0 && denied.length === 0) {
    return true;
  }
  if (allowed.length > 0) {
    return allowed.includes(cityId);
  }
  return !denied.includes(cityId);
}

/** Prisma `cityId` clause: allow → `in`, deny → `notIn`, empty → omit. */
export function cityIdFilter(
  allowed: number[],
  denied: number[],
): CityIdFilter | undefined {
  if (allowed.length > 0) {
    return { in: allowed };
  }
  if (denied.length > 0) {
    return { notIn: denied };
  }
  return undefined;
}

export function mergeExcludedPhones(args: {
  own: Iterable<string>;
  pairwise: Iterable<string>;
  allOthersIfRespectAll: Iterable<string>;
  exclusiveTenants: Iterable<string>;
}): Set<string> {
  return new Set([
    ...args.own,
    ...args.pairwise,
    ...args.allOthersIfRespectAll,
    ...args.exclusiveTenants,
  ]);
}
