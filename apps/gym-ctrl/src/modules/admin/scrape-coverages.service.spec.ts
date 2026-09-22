import { ScrapeLastRunKind, ScrapeSchedulePhase } from '@prisma/client';
import { ScrapeCoveragesService } from './scrape-coverages.service';

describe('ScrapeCoveragesService', () => {
  it('list retorna campos de lifecycle do Prisma', async () => {
    const row = {
      id: 1,
      cityId: 2,
      category: 'Academia',
      firstRunAt: new Date('2026-01-01'),
      lastRunAt: new Date('2026-06-01'),
      lastStatus: 'success',
      lastLeadCount: 10,
      schedulePhase: ScrapeSchedulePhase.COOLDOWN_90D,
      nextScheduledRunAt: new Date('2026-09-01'),
      scheduledRunCount: 3,
      lastRunKind: ScrapeLastRunKind.planned,
      city: { id: 2, name: 'Sorocaba', state: 'SP' },
    };
    const prisma = {
      scrapeCoverage: {
        findMany: jest.fn().mockResolvedValue([row]),
      },
    };
    const service = new ScrapeCoveragesService(prisma as never);
    const list = await service.list();
    expect(list[0]).toMatchObject({
      schedulePhase: ScrapeSchedulePhase.COOLDOWN_90D,
      nextScheduledRunAt: row.nextScheduledRunAt,
      scheduledRunCount: 3,
      lastRunKind: ScrapeLastRunKind.planned,
    });
  });
});
