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
