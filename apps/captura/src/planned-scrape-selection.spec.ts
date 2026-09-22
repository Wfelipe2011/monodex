import {
  applyBusinessHoursPairCap,
  compareEligiblePairs,
  getSaoPauloLocalHour,
  sortEligiblePairs,
} from './planned-scrape-selection';

describe('planned-scrape-selection', () => {
  const t0 = new Date('2026-01-15T12:00:00.000Z');

  describe('compareEligiblePairs / sortEligiblePairs', () => {
    it('orders NULL nextScheduledRunAt before dated values', () => {
      const later = new Date('2026-02-01T00:00:00.000Z');
      expect(
        compareEligiblePairs(
          { nextScheduledRunAt: null, lastRunAt: null },
          { nextScheduledRunAt: later, lastRunAt: null },
        ),
      ).toBeLessThan(0);
    });

    it('orders by nextScheduledRunAt ASC then oldest lastRunAt', () => {
      const sorted = sortEligiblePairs([
        {
          nextScheduledRunAt: new Date('2026-03-01T00:00:00.000Z'),
          lastRunAt: new Date('2026-01-01T00:00:00.000Z'),
        },
        {
          nextScheduledRunAt: new Date('2026-02-01T00:00:00.000Z'),
          lastRunAt: new Date('2026-01-10T00:00:00.000Z'),
        },
        {
          nextScheduledRunAt: null,
          lastRunAt: new Date('2026-01-05T00:00:00.000Z'),
        },
      ]);
      expect(sorted[0].nextScheduledRunAt).toBeNull();
      expect(sorted[1].nextScheduledRunAt?.toISOString()).toBe(
        '2026-02-01T00:00:00.000Z',
      );
      expect(sorted[2].nextScheduledRunAt?.toISOString()).toBe(
        '2026-03-01T00:00:00.000Z',
      );
    });
  });

  describe('applyBusinessHoursPairCap', () => {
    const pairs = [{ id: 1 }, { id: 2 }, { id: 3 }];

    it('caps to K at 10:00 America/Sao_Paulo', () => {
      const at10Sp = new Date('2026-06-15T13:00:00.000Z');
      expect(getSaoPauloLocalHour(at10Sp)).toBe(10);
      expect(applyBusinessHoursPairCap(pairs, at10Sp, 2)).toEqual([
        { id: 1 },
        { id: 2 },
      ]);
    });

    it('does not cap outside business hours (22:00 SP)', () => {
      const at22Sp = new Date('2026-06-16T01:00:00.000Z');
      expect(getSaoPauloLocalHour(at22Sp)).toBe(22);
      expect(applyBusinessHoursPairCap(pairs, at22Sp, 2)).toEqual(pairs);
    });
  });
});
