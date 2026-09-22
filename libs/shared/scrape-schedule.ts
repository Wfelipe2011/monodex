import { ScrapeSchedulePhase } from '@prisma/client';

export const SCRAPE_SCHEDULE_COOLDOWN_DAYS = 90;
export const SCRAPE_SCHEDULE_RECURRING_DAYS = 180;

export type ScheduledScrapeCoverage = {
  schedulePhase: ScrapeSchedulePhase;
  nextScheduledRunAt: Date | null;
  scheduledRunCount: number;
};

export type ScheduledScrapeCoverageSnapshot = {
  schedulePhase: ScrapeSchedulePhase;
  nextScheduledRunAt: Date | null;
} | null;

/** UTC calendar-day add (avoids DST; scrape cadence is day-based). */
export function addUtcDays(from: Date, days: number): Date {
  const result = new Date(from.getTime());
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

/**
 * Whether a pair may be picked by the planned scrape cron.
 * Missing coverage is treated as BOOTSTRAP (always eligible).
 */
export function isScheduledScrapeEligible(
  coverage: ScheduledScrapeCoverageSnapshot,
  now: Date,
): boolean {
  if (coverage === null) {
    return true;
  }
  if (coverage.schedulePhase === ScrapeSchedulePhase.BOOTSTRAP) {
    return true;
  }
  if (
    coverage.schedulePhase === ScrapeSchedulePhase.COOLDOWN_90D ||
    coverage.schedulePhase === ScrapeSchedulePhase.RECURRING_180D
  ) {
    return (
      coverage.nextScheduledRunAt !== null &&
      now.getTime() >= coverage.nextScheduledRunAt.getTime()
    );
  }
  return false;
}

export type AdvanceScheduleAfterPlannedRunResult = {
  schedulePhase: ScrapeSchedulePhase;
  nextScheduledRunAt: Date | null;
  scheduledRunCount: number;
};

/** Advances lifecycle after a completed planned run only (not on-demand). */
export function advanceScheduleAfterPlannedRun(
  coverage: ScheduledScrapeCoverage,
  lastLeadCount: number,
  now: Date,
): AdvanceScheduleAfterPlannedRunResult {
  const scheduledRunCount = coverage.scheduledRunCount + 1;

  if (coverage.schedulePhase === ScrapeSchedulePhase.BOOTSTRAP) {
    if (lastLeadCount >= 1) {
      return {
        schedulePhase: ScrapeSchedulePhase.COOLDOWN_90D,
        nextScheduledRunAt: addUtcDays(now, SCRAPE_SCHEDULE_COOLDOWN_DAYS),
        scheduledRunCount,
      };
    }
    return {
      schedulePhase: ScrapeSchedulePhase.BOOTSTRAP,
      nextScheduledRunAt: null,
      scheduledRunCount,
    };
  }

  if (coverage.schedulePhase === ScrapeSchedulePhase.COOLDOWN_90D) {
    return {
      schedulePhase: ScrapeSchedulePhase.RECURRING_180D,
      nextScheduledRunAt: addUtcDays(now, SCRAPE_SCHEDULE_RECURRING_DAYS),
      scheduledRunCount,
    };
  }

  return {
    schedulePhase: ScrapeSchedulePhase.RECURRING_180D,
    nextScheduledRunAt: addUtcDays(now, SCRAPE_SCHEDULE_RECURRING_DAYS),
    scheduledRunCount,
  };
}
