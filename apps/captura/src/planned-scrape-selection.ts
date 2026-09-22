import { SAO_PAULO_OFFSET_MS } from '@core/shared/sao-paulo-time';

export type ScrapePairSortFields = {
  nextScheduledRunAt: Date | null;
  lastRunAt: Date | null;
};

export function compareEligiblePairs(
  a: ScrapePairSortFields,
  b: ScrapePairSortFields,
): number {
  if (a.nextScheduledRunAt === null && b.nextScheduledRunAt !== null) {
    return -1;
  }
  if (a.nextScheduledRunAt !== null && b.nextScheduledRunAt === null) {
    return 1;
  }
  if (a.nextScheduledRunAt !== null && b.nextScheduledRunAt !== null) {
    const byNext =
      a.nextScheduledRunAt.getTime() - b.nextScheduledRunAt.getTime();
    if (byNext !== 0) {
      return byNext;
    }
  }

  if (a.lastRunAt === null && b.lastRunAt !== null) {
    return -1;
  }
  if (a.lastRunAt !== null && b.lastRunAt === null) {
    return 1;
  }
  if (a.lastRunAt !== null && b.lastRunAt !== null) {
    return a.lastRunAt.getTime() - b.lastRunAt.getTime();
  }
  return 0;
}

export function sortEligiblePairs<T extends ScrapePairSortFields>(pairs: T[]): T[] {
  return [...pairs].sort(compareEligiblePairs);
}

export function getSaoPauloLocalHour(now: Date): number {
  const spWall = new Date(now.getTime() - SAO_PAULO_OFFSET_MS);
  return spWall.getUTCHours();
}

export function isBusinessHoursInSaoPaulo(now: Date): boolean {
  const hour = getSaoPauloLocalHour(now);
  return hour >= 8 && hour <= 18;
}

export function parseBusinessHoursMaxTargets(
  envValue: string | undefined = process.env.SCRAPE_BUSINESS_HOURS_MAX_TARGETS,
): number {
  if (envValue === undefined || envValue === '') {
    return 2;
  }
  const n = Number.parseInt(envValue, 10);
  return Number.isFinite(n) && n > 0 ? n : 2;
}

export function applyBusinessHoursPairCap<T>(
  pairs: T[],
  now: Date,
  maxTargets = parseBusinessHoursMaxTargets(),
): T[] {
  if (!isBusinessHoursInSaoPaulo(now)) {
    return pairs;
  }
  return pairs.slice(0, maxTargets);
}
