import { ScrapeSchedulePhase } from '@prisma/client';
import {
  addUtcDays,
  advanceScheduleAfterPlannedRun,
  isScheduledScrapeEligible,
  SCRAPE_SCHEDULE_COOLDOWN_DAYS,
  SCRAPE_SCHEDULE_RECURRING_DAYS,
} from './scrape-schedule';

const t0 = new Date('2026-01-15T12:00:00.000Z');
const beforeNext = new Date('2026-04-01T00:00:00.000Z');
const atNext = new Date('2026-04-15T12:00:00.000Z');

describe('addUtcDays', () => {
  it('soma dias no calendário UTC', () => {
    expect(addUtcDays(t0, 90).toISOString()).toBe('2026-04-15T12:00:00.000Z');
  });
});

describe('isScheduledScrapeEligible', () => {
  it.each([
    { coverage: null, now: t0, eligible: true, label: 'coverage ausente' },
    {
      coverage: {
        schedulePhase: ScrapeSchedulePhase.BOOTSTRAP,
        nextScheduledRunAt: null,
      },
      now: t0,
      eligible: true,
      label: 'BOOTSTRAP',
    },
    {
      coverage: {
        schedulePhase: ScrapeSchedulePhase.COOLDOWN_90D,
        nextScheduledRunAt: atNext,
      },
      now: beforeNext,
      eligible: false,
      label: 'COOLDOWN antes de next',
    },
    {
      coverage: {
        schedulePhase: ScrapeSchedulePhase.COOLDOWN_90D,
        nextScheduledRunAt: atNext,
      },
      now: atNext,
      eligible: true,
      label: 'COOLDOWN no instante next',
    },
    {
      coverage: {
        schedulePhase: ScrapeSchedulePhase.RECURRING_180D,
        nextScheduledRunAt: atNext,
      },
      now: beforeNext,
      eligible: false,
      label: 'RECURRING antes de next',
    },
    {
      coverage: {
        schedulePhase: ScrapeSchedulePhase.RECURRING_180D,
        nextScheduledRunAt: atNext,
      },
      now: atNext,
      eligible: true,
      label: 'RECURRING no instante next',
    },
    {
      coverage: {
        schedulePhase: ScrapeSchedulePhase.COOLDOWN_90D,
        nextScheduledRunAt: null,
      },
      now: t0,
      eligible: false,
      label: 'COOLDOWN sem nextScheduledRunAt',
    },
  ])('$label → $eligible', ({ coverage, now, eligible }) => {
    expect(isScheduledScrapeEligible(coverage, now)).toBe(eligible);
  });
});

describe('advanceScheduleAfterPlannedRun', () => {
  const base = {
    schedulePhase: ScrapeSchedulePhase.BOOTSTRAP,
    nextScheduledRunAt: null,
    scheduledRunCount: 0,
  };

  it('BOOTSTRAP + lastLeadCount 0 permanece BOOTSTRAP', () => {
    expect(advanceScheduleAfterPlannedRun(base, 0, t0)).toEqual({
      schedulePhase: ScrapeSchedulePhase.BOOTSTRAP,
      nextScheduledRunAt: null,
      scheduledRunCount: 1,
    });
  });

  it('BOOTSTRAP + lastLeadCount >= 1 entra COOLDOWN_90D', () => {
    const result = advanceScheduleAfterPlannedRun(base, 3, t0);
    expect(result.schedulePhase).toBe(ScrapeSchedulePhase.COOLDOWN_90D);
    expect(result.scheduledRunCount).toBe(1);
    expect(result.nextScheduledRunAt).toEqual(
      addUtcDays(t0, SCRAPE_SCHEDULE_COOLDOWN_DAYS),
    );
  });

  it('COOLDOWN_90D após planned run → RECURRING_180D', () => {
    const coverage = {
      schedulePhase: ScrapeSchedulePhase.COOLDOWN_90D,
      nextScheduledRunAt: atNext,
      scheduledRunCount: 2,
    };
    const result = advanceScheduleAfterPlannedRun(coverage, 0, t0);
    expect(result).toEqual({
      schedulePhase: ScrapeSchedulePhase.RECURRING_180D,
      nextScheduledRunAt: addUtcDays(t0, SCRAPE_SCHEDULE_RECURRING_DAYS),
      scheduledRunCount: 3,
    });
  });

  it('RECURRING_180D avança next +180d', () => {
    const coverage = {
      schedulePhase: ScrapeSchedulePhase.RECURRING_180D,
      nextScheduledRunAt: atNext,
      scheduledRunCount: 5,
    };
    const result = advanceScheduleAfterPlannedRun(coverage, 10, t0);
    expect(result).toEqual({
      schedulePhase: ScrapeSchedulePhase.RECURRING_180D,
      nextScheduledRunAt: addUtcDays(t0, SCRAPE_SCHEDULE_RECURRING_DAYS),
      scheduledRunCount: 6,
    });
  });
});
