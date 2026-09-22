import {
  ScrapeLastRunKind,
  ScrapeOnDemandRunStatus,
  ScrapeSchedulePhase,
} from '@prisma/client';
import { ConflictException } from '@nestjs/common';
import { isScheduledScrapeEligible } from '@core/shared/scrape-schedule';
import { CapturaScraperService } from './captura-scraper.service';
import { ScrapePairLockService } from './scrape-pair-lock.service';

describe('CapturaScraperService planned selection', () => {
  const now = new Date('2026-06-15T13:00:00.000Z');

  it('excludes COOLDOWN_90D with future nextScheduledRunAt', () => {
    const future = new Date('2026-12-01T00:00:00.000Z');
    expect(
      isScheduledScrapeEligible(
        {
          schedulePhase: ScrapeSchedulePhase.COOLDOWN_90D,
          nextScheduledRunAt: future,
        },
        now,
      ),
    ).toBe(false);
  });

  it('includes BOOTSTRAP without coverage snapshot', () => {
    expect(isScheduledScrapeEligible(null, now)).toBe(true);
  });
});

describe('CapturaScraperService handleMorningScrape', () => {
  const tickNow = new Date('2026-06-15T13:00:00.000Z');
  let service: CapturaScraperService;
  let runScrapeJob: jest.Mock;
  let prisma: {
    scrapeTarget: { findMany: jest.Mock };
    scrapeCoverage: { findMany: jest.Mock };
  };

  beforeEach(() => {
    runScrapeJob = jest.fn().mockResolvedValue(undefined);
    prisma = {
      scrapeTarget: { findMany: jest.fn() },
      scrapeCoverage: { findMany: jest.fn() },
    };
    const pairLock = new ScrapePairLockService();
    service = new CapturaScraperService(
      {} as never,
      {} as never,
      prisma as never,
      pairLock,
    );
    service.runScrapeJob = runScrapeJob;
  });

  it('passes only eligible pairs and respects business-hours cap', async () => {
    const city = { id: 1, name: 'Sorocaba' };
    prisma.scrapeTarget.findMany.mockResolvedValue([
      { cityId: 1, category: 'a', city, enabled: true },
      { cityId: 1, category: 'b', city, enabled: true },
      { cityId: 1, category: 'c', city, enabled: true },
    ]);
    const future = new Date('2027-01-01T00:00:00.000Z');
    prisma.scrapeCoverage.findMany.mockResolvedValue([
      {
        cityId: 1,
        category: 'b',
        schedulePhase: ScrapeSchedulePhase.COOLDOWN_90D,
        nextScheduledRunAt: future,
        lastRunAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    ]);

    await service.handleMorningScrape(tickNow);

    expect(runScrapeJob).toHaveBeenCalledTimes(1);
    const groups = runScrapeJob.mock.calls[0][0] as Array<{
      categories: string[];
    }>;
    const categories = groups.flatMap((g) => g.categories);
    expect(categories).not.toContain('b');
    expect(categories).toHaveLength(2);
    expect(categories).toEqual(expect.arrayContaining(['a', 'c']));
  });
});

describe('CapturaScraperService runOnDemandScrape', () => {
  let service: CapturaScraperService;
  let scraper: { scrapeSorocabaLeads: jest.Mock };
  let prisma: {
    scrapeTarget: { findUnique: jest.Mock };
    scrapeOnDemandState: {
      findUnique: jest.Mock;
      upsert: jest.Mock;
      update: jest.Mock;
    };
    scrapeOnDemandRun: { create: jest.Mock; update: jest.Mock };
    neighborhood: { findMany: jest.Mock };
    scrapeCoverage: { findUnique: jest.Mock; upsert: jest.Mock };
    lead: { findUnique: jest.Mock; create: jest.Mock; update: jest.Mock };
  };
  const pairLock = new ScrapePairLockService();

  beforeEach(() => {
    scraper = { scrapeSorocabaLeads: jest.fn().mockResolvedValue(undefined) };
    prisma = {
      scrapeTarget: { findUnique: jest.fn() },
      scrapeOnDemandState: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
      scrapeOnDemandRun: {
        create: jest.fn().mockResolvedValue({ id: 99 }),
        update: jest.fn().mockResolvedValue({}),
      },
      neighborhood: { findMany: jest.fn() },
      scrapeCoverage: {
        findUnique: jest.fn().mockResolvedValue({
          schedulePhase: ScrapeSchedulePhase.COOLDOWN_90D,
          nextScheduledRunAt: new Date('2027-01-01T00:00:00.000Z'),
          scheduledRunCount: 2,
        }),
        upsert: jest.fn().mockResolvedValue({}),
      },
      lead: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
        update: jest.fn(),
      },
    };
    service = new CapturaScraperService(
      scraper as never,
      {} as never,
      prisma as never,
      pairLock,
    );
  });

  it('advances cursor on second call and invokes scraper once per run', async () => {
    const city = { id: 1, name: 'Sorocaba' };
    prisma.scrapeTarget.findUnique.mockResolvedValue({
      id: 7,
      cityId: 1,
      category: 'gym',
      enabled: true,
      city,
    });
    prisma.scrapeOnDemandState.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        tenantId: 4,
        scrapeTargetId: 7,
        bairroOrder: ['b1', 'b2', 'b3', 'b4'],
        nextBairroIndex: 2,
        onDemandEnabled: true,
      });
    prisma.scrapeOnDemandState.upsert.mockResolvedValue({
      nextBairroIndex: 0,
      bairroOrder: ['b1', 'b2', 'b3', 'b4'],
    });
    prisma.neighborhood.findMany.mockResolvedValue([
      { name: 'b1' },
      { name: 'b2' },
      { name: 'b3' },
      { name: 'b4' },
    ]);

    process.env.ON_DEMAND_MAX_BAIRROS = '2';

    const first = await service.runOnDemandScrape(4, 7);
    expect(first.bairrosProcessed).toBe(2);
    expect(first.nextBairroIndex).toBe(2);
    expect(scraper.scrapeSorocabaLeads).toHaveBeenCalledTimes(1);
    expect(scraper.scrapeSorocabaLeads.mock.calls[0][2]).toEqual(['b1', 'b2']);

    const second = await service.runOnDemandScrape(4, 7);
    expect(second.nextBairroIndex).toBe(0);
    expect(scraper.scrapeSorocabaLeads).toHaveBeenCalledTimes(2);
    expect(scraper.scrapeSorocabaLeads.mock.calls[1][2]).toEqual(['b3', 'b4']);

    const upsertArgs = prisma.scrapeCoverage.upsert.mock.calls[0][0];
    expect(upsertArgs.update.schedulePhase).toBe(ScrapeSchedulePhase.COOLDOWN_90D);
    expect(upsertArgs.update.nextScheduledRunAt).toEqual(
      new Date('2027-01-01T00:00:00.000Z'),
    );
    expect(upsertArgs.update.lastRunKind).toBe(ScrapeLastRunKind.on_demand);
  });

  it('rejects disabled target with conflict', async () => {
    prisma.scrapeTarget.findUnique.mockResolvedValue({
      id: 7,
      enabled: false,
      cityId: 1,
      category: 'gym',
      city: { id: 1, name: 'X' },
    });
    prisma.scrapeOnDemandState.findUnique.mockResolvedValue(null);

    await expect(service.runOnDemandScrape(4, 7)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(scraper.scrapeSorocabaLeads).not.toHaveBeenCalled();
  });

  it('records running then success on scrapeOnDemandRun', async () => {
    prisma.scrapeTarget.findUnique.mockResolvedValue({
      id: 7,
      cityId: 1,
      category: 'gym',
      enabled: true,
      city: { id: 1, name: 'Sorocaba' },
    });
    prisma.scrapeOnDemandState.findUnique.mockResolvedValue({
      bairroOrder: ['b1'],
      nextBairroIndex: 0,
      onDemandEnabled: true,
    });
    process.env.ON_DEMAND_MAX_BAIRROS = '3';

    await service.runOnDemandScrape(4, 7);

    expect(prisma.scrapeOnDemandRun.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: ScrapeOnDemandRunStatus.running,
        }),
      }),
    );
    expect(prisma.scrapeOnDemandRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: ScrapeOnDemandRunStatus.success,
          bairrosProcessed: 1,
        }),
      }),
    );
  });
});
