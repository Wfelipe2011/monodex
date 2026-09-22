import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  City,
  ScrapeLastRunKind,
  ScrapeOnDemandRunStatus,
  ScrapeSchedulePhase,
} from '@prisma/client';
import { GoogleMapsScraper } from './scraper/google-maps.scraper';
import { PrismaService } from '@core/infra/prisma/prisma.service';
import { GoogleMapsNeighborhoodScraper } from './scraper/google-maps-neighborhood.scraper';
import {
  advanceScheduleAfterPlannedRun,
  isScheduledScrapeEligible,
  ScheduledScrapeCoverage,
} from '@core/shared/scrape-schedule';
import { ScrapePairLockService } from './scrape-pair-lock.service';
import {
  applyBusinessHoursPairCap,
  sortEligiblePairs,
} from './planned-scrape-selection';
import {
  advanceBairroCursor,
  sliceBairrosForRun,
} from './on-demand-cursor';

type CoverageStatus = 'success' | 'failed' | 'partial';

type CityScrapeGroup = {
  city: City;
  categories: string[];
  lockKeys: string[];
};

type UpsertCoverageOptions = {
  planned: boolean;
  onDemand?: boolean;
};

export type OnDemandScrapeResult = {
  status: 'success' | 'failed' | 'partial';
  leadsTouched: number;
  bairrosProcessed: number;
  nextBairroIndex: number;
};

function onDemandMaxBairros(): number {
  const parsed = parseInt(process.env.ON_DEMAND_MAX_BAIRROS ?? '3', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 3;
}

function parseBairroOrder(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.filter((v): v is string => typeof v === 'string' && v.length > 0);
}

@Injectable()
export class CapturaScraperService {
  private readonly logger = new Logger(CapturaScraperService.name);
  private running = false;

  constructor(
    private scraper: GoogleMapsScraper,
    private googleMapsNeighborhoodScraper: GoogleMapsNeighborhoodScraper,
    private prisma: PrismaService,
    private pairLock: ScrapePairLockService,
  ) {}

  /** Disparado pelo cron dinâmico (`PlatformJobSchedule` SCRAPE). */
  async handleMorningScrape(now: Date = new Date()) {
    this.logger.log('[cron] Scrape disparado');

    const targets = await this.prisma.scrapeTarget.findMany({
      where: { enabled: true },
      include: { city: true },
    });

    if (targets.length === 0) {
      this.logger.log('[cron] Nenhum ScrapeTarget enabled; nada a fazer');
      return;
    }

    const cityIds = [...new Set(targets.map((t) => t.cityId))];
    const coverageRows = await this.prisma.scrapeCoverage.findMany({
      where: { cityId: { in: cityIds } },
    });
    const coverageByKey = new Map(
      coverageRows.map((c) => [`${c.cityId}:${c.category}`, c] as const),
    );

    type EligiblePair = {
      cityId: number;
      category: string;
      city: City;
      nextScheduledRunAt: Date | null;
      lastRunAt: Date | null;
    };

    const eligible: EligiblePair[] = [];
    for (const target of targets) {
      const coverage = coverageByKey.get(`${target.cityId}:${target.category}`);
      const snapshot =
        coverage === undefined
          ? null
          : {
              schedulePhase: coverage.schedulePhase,
              nextScheduledRunAt: coverage.nextScheduledRunAt,
            };

      if (!isScheduledScrapeEligible(snapshot, now)) {
        this.logger.log(
          `[cron] Skip target cityId=${target.cityId} category=${target.category} (cooldown / not due)`,
        );
        continue;
      }

      eligible.push({
        cityId: target.cityId,
        category: target.category,
        city: target.city,
        nextScheduledRunAt: coverage?.nextScheduledRunAt ?? null,
        lastRunAt: coverage?.lastRunAt ?? null,
      });
    }

    if (eligible.length === 0) {
      this.logger.log('[cron] Nenhum par elegível neste tick');
      return;
    }

    const sorted = sortEligiblePairs(eligible);
    const capped = applyBusinessHoursPairCap(sorted, now);
    if (capped.length < sorted.length) {
      this.logger.log(
        `[cron] Cap horário comercial: ${capped.length}/${sorted.length} pares`,
      );
    }

    const byCity = new Map<number, CityScrapeGroup>();
    for (const pair of capped) {
      const lockKey = this.pairLock.pairKey(pair.cityId, pair.category);
      if (!this.pairLock.tryAcquire(pair.cityId, pair.category)) {
        this.logger.warn(
          `[cron] Pair lock held cityId=${pair.cityId} category=${pair.category}; skipping`,
        );
        continue;
      }

      const group = byCity.get(pair.cityId);
      if (group) {
        group.categories.push(pair.category);
        group.lockKeys.push(lockKey);
      } else {
        byCity.set(pair.cityId, {
          city: pair.city,
          categories: [pair.category],
          lockKeys: [lockKey],
        });
      }
    }

    const groups = [...byCity.values()];
    if (groups.length === 0) {
      this.logger.log('[cron] Nenhum par disponível após locks');
      return;
    }

    await this.runScrapeJob(groups);
  }

  async runOnDemandScrape(
    tenantId: number,
    scrapeTargetId: number,
  ): Promise<OnDemandScrapeResult> {
    const target = await this.prisma.scrapeTarget.findUnique({
      where: { id: scrapeTargetId },
      include: { city: true },
    });

    if (!target) {
      throw new NotFoundException(`ScrapeTarget ${scrapeTargetId} not found`);
    }

    if (!target.enabled) {
      throw new ConflictException('ScrapeTarget is disabled');
    }

    const existingState = await this.prisma.scrapeOnDemandState.findUnique({
      where: {
        tenantId_scrapeTargetId: { tenantId, scrapeTargetId },
      },
    });
    if (existingState && !existingState.onDemandEnabled) {
      throw new ConflictException('On-demand disabled for this tenant target');
    }

    if (!this.pairLock.tryAcquire(target.cityId, target.category)) {
      throw new ConflictException(
        `Scrape already running for cityId=${target.cityId} category=${target.category}`,
      );
    }

    const maxBairros = onDemandMaxBairros();
    let runId: number | null = null;

    try {
      const startedAt = new Date();
      const run = await this.prisma.scrapeOnDemandRun.create({
        data: {
          tenantId,
          scrapeTargetId,
          startedAt,
          status: ScrapeOnDemandRunStatus.running,
        },
      });
      runId = run.id;

      let state = existingState;

      let orderedBairros = parseBairroOrder(state?.bairroOrder);
      if (orderedBairros.length === 0) {
        orderedBairros = await this.loadStableBairroOrder(target.cityId);
        state = await this.prisma.scrapeOnDemandState.upsert({
          where: {
            tenantId_scrapeTargetId: { tenantId, scrapeTargetId },
          },
          create: {
            tenantId,
            scrapeTargetId,
            bairroOrder: orderedBairros,
            nextBairroIndex: 0,
          },
          update: {
            bairroOrder: orderedBairros,
          },
        });
      }

      const startIndex = state?.nextBairroIndex ?? 0;
      const { slice, bairrosProcessed } = sliceBairrosForRun(
        orderedBairros,
        startIndex,
        maxBairros,
      );

      if (bairrosProcessed === 0) {
        const nextBairroIndex = 0;
        await this.prisma.scrapeOnDemandState.update({
          where: {
            tenantId_scrapeTargetId: { tenantId, scrapeTargetId },
          },
          data: { nextBairroIndex },
        });
        await this.finalizeOnDemandRun(runId, {
          status: ScrapeOnDemandRunStatus.failed,
          leadsTouched: 0,
          bairrosProcessed: 0,
        });
        await this.upsertCoverage(target.cityId, target.category, 'failed', 0, {
          planned: false,
          onDemand: true,
        });
        return {
          status: 'failed',
          leadsTouched: 0,
          bairrosProcessed: 0,
          nextBairroIndex,
        };
      }

      const leadCounts = new Map<string, number>();
      let scrapeFailed = false;
      try {
        await this.scraper.scrapeSorocabaLeads(
          target.city.name,
          [target.category],
          slice,
          async (params) => {
            await this.persistLeads(params, target.cityId, leadCounts);
          },
          { shortScroll: true },
        );
      } catch (e) {
        scrapeFailed = true;
        this.logger.error(
          `[onDemand] scrape failed target=${scrapeTargetId}`,
          e instanceof Error ? e.stack : e,
        );
      }

      const leadsTouched = leadCounts.get(target.category) ?? 0;
      let status: CoverageStatus = 'success';
      if (scrapeFailed) {
        status = leadsTouched > 0 ? 'partial' : 'failed';
      }

      const nextBairroIndex = advanceBairroCursor(
        startIndex,
        orderedBairros.length,
        bairrosProcessed,
      );

      await this.prisma.scrapeOnDemandState.update({
        where: {
          tenantId_scrapeTargetId: { tenantId, scrapeTargetId },
        },
        data: { nextBairroIndex },
      });

      const runStatus =
        status === 'failed'
          ? ScrapeOnDemandRunStatus.failed
          : ScrapeOnDemandRunStatus.success;

      await this.finalizeOnDemandRun(runId, {
        status: runStatus,
        leadsTouched,
        bairrosProcessed,
      });

      await this.upsertCoverage(
        target.cityId,
        target.category,
        status,
        leadsTouched,
        { planned: false, onDemand: true },
      );

      return {
        status,
        leadsTouched,
        bairrosProcessed,
        nextBairroIndex,
      };
    } catch (e) {
      if (runId != null) {
        await this.finalizeOnDemandRun(runId, {
          status: ScrapeOnDemandRunStatus.failed,
          leadsTouched: 0,
          bairrosProcessed: 0,
        }).catch(() => undefined);
      }
      throw e;
    } finally {
      this.pairLock.release(target.cityId, target.category);
    }
  }

  private async loadStableBairroOrder(cityId: number): Promise<string[]> {
    const rows = await this.prisma.neighborhood.findMany({
      where: { cityId },
      select: { name: true },
      orderBy: { name: 'asc' },
    });
    return rows.map((r) => r.name).filter(Boolean);
  }

  private async finalizeOnDemandRun(
    runId: number,
    data: {
      status: ScrapeOnDemandRunStatus;
      leadsTouched: number;
      bairrosProcessed: number;
    },
  ) {
    await this.prisma.scrapeOnDemandRun.update({
      where: { id: runId },
      data: {
        ...data,
        finishedAt: new Date(),
      },
    });
  }

  async runScrapeJob(groups: CityScrapeGroup[]) {
    if (this.running) {
      this.logger.warn('[refreshLeads] Scrape já em andamento; ignorando disparo');
      return;
    }

    this.running = true;
    try {
      for (const { city, categories, lockKeys } of groups) {
        try {
          await this.scrape(city, categories);
        } catch (e) {
          this.logger.error(
            `[refreshLeads] Scrape abortado para city=${city.name}`,
            e instanceof Error ? e.stack : e,
          );
          for (const category of categories) {
            await this.upsertCoverage(city.id, category, 'failed', 0, {
              planned: true,
            });
          }
        } finally {
          for (const key of lockKeys) {
            this.pairLock.releaseKey(key);
          }
        }
      }
    } finally {
      this.running = false;
    }
  }

  async scrape(city: { id: number; name: string }, categories: string[]) {
    this.logger.log(`[refreshLeads] Starting lead refresh for ${city.name}...`);

    let neighborhoods = await this.prisma.neighborhood.findMany({
      where: { cityId: city.id },
      select: { name: true },
    });

    if (neighborhoods.length === 0) {
      this.logger.log(
        `[refreshLeads] Nenhum bairro no DB para ${city.name}; rodando neighborhood scraper...`,
      );
      try {
        await this.googleMapsNeighborhoodScraper.scraper(city.name);
      } catch (e) {
        this.logger.error(
          `[refreshLeads] Neighborhood scraper failed city=${city.name}`,
          e instanceof Error ? e.stack : e,
        );
      }
      neighborhoods = await this.prisma.neighborhood.findMany({
        where: { cityId: city.id },
        select: { name: true },
      });
    }

    const bairros = neighborhoods.map((n) => n.name).filter(Boolean);
    if (bairros.length === 0) {
      this.logger.error(
        `[refreshLeads] Sem bairros para ${city.name}; abortando scrape de leads`,
      );
      for (const category of categories) {
        await this.upsertCoverage(city.id, category, 'failed', 0, {
          planned: true,
        });
      }
      return;
    }

    const leadCounts = new Map<string, number>();
    let scrapeFailed = false;
    try {
      await this.scraper.scrapeSorocabaLeads(
        city.name,
        categories,
        bairros,
        async (params) => {
          await this.persistLeads(params, city.id, leadCounts);
        },
      );
    } catch (e) {
      scrapeFailed = true;
      this.logger.error(
        `[refreshLeads] Error in scrapeSorocabaLeads city=${city.name}`,
        e instanceof Error ? e.stack : e,
      );
    }

    for (const category of categories) {
      const count = leadCounts.get(category) ?? 0;
      let status: CoverageStatus = 'success';
      if (scrapeFailed) {
        status = count > 0 ? 'partial' : 'failed';
      }
      await this.upsertCoverage(city.id, category, status, count, {
        planned: true,
      });
    }

    this.logger.log(`[refreshLeads] Leads refreshed for ${city.name}`);
  }

  private async persistLeads(
    params: Array<{
      name?: string;
      phone?: string;
      website?: string;
      rating?: number;
      reviews?: number;
      category?: string;
    }>,
    cityId: number,
    leadCounts: Map<string, number>,
  ) {
    for (const p of params) {
      if (!p.phone) {
        this.logger.log(`[refreshLeads] Skipping lead without phone: ${JSON.stringify(p)}`);
        continue;
      }
      const cleanPhone = p.phone.replace(/[^0-9]/g, '');
      if (!cleanPhone) {
        this.logger.log(`[refreshLeads] Skipping lead with empty phone: ${JSON.stringify(p)}`);
        continue;
      }

      const category = p.category ?? '';

      try {
        const existing = await this.prisma.lead.findUnique({
          where: { phone_cityId: { phone: cleanPhone, cityId } },
        });

        if (!existing) {
          await this.prisma.lead.create({
            data: {
              name: p.name ?? '',
              phone: cleanPhone,
              website: p.website ?? '',
              rating: p.rating ?? null,
              reviews: p.reviews ?? null,
              category,
              categories: category ? [category] : [],
              cityId,
            },
          });
          leadCounts.set(category, (leadCounts.get(category) ?? 0) + 1);
          this.logger.log(`[refreshLeads] Created lead phone=${cleanPhone} cityId=${cityId}`);
          continue;
        }

        if (existing.deletedAt) {
          this.logger.log(
            `[refreshLeads] Lead soft-deleted phone=${cleanPhone} cityId=${cityId}; skipping`,
          );
          continue;
        }

        const priorCategories =
          existing.categories.length > 0
            ? existing.categories
            : existing.category
              ? [existing.category]
              : [];
        const categories = [...new Set([...priorCategories, category].filter(Boolean))];

        await this.prisma.lead.update({
          where: { id: existing.id },
          data: {
            name: p.name ?? existing.name,
            website: p.website ?? existing.website,
            rating: p.rating ?? existing.rating,
            reviews: p.reviews ?? existing.reviews,
            category,
            categories,
          },
        });
        leadCounts.set(category, (leadCounts.get(category) ?? 0) + 1);
        this.logger.log(`[refreshLeads] Updated lead phone=${cleanPhone} cityId=${cityId}`);
      } catch (e) {
        this.logger.error(
          `[refreshLeads] Error upserting lead phone=${cleanPhone} cityId=${cityId}`,
          e instanceof Error ? e.stack : e,
        );
      }
    }
  }

  private async upsertCoverage(
    cityId: number,
    category: string,
    lastStatus: CoverageStatus,
    lastLeadCount: number,
    options: UpsertCoverageOptions = { planned: true },
  ) {
    const now = new Date();
    const existing = await this.prisma.scrapeCoverage.findUnique({
      where: { cityId_category: { cityId, category } },
    });

    const baseCoverage: ScheduledScrapeCoverage = existing
      ? {
          schedulePhase: existing.schedulePhase,
          nextScheduledRunAt: existing.nextScheduledRunAt,
          scheduledRunCount: existing.scheduledRunCount,
        }
      : {
          schedulePhase: ScrapeSchedulePhase.BOOTSTRAP,
          nextScheduledRunAt: null,
          scheduledRunCount: 0,
        };

    let schedulePhase = baseCoverage.schedulePhase;
    let nextScheduledRunAt = baseCoverage.nextScheduledRunAt;
    let scheduledRunCount = baseCoverage.scheduledRunCount;
    let lastRunKind: ScrapeLastRunKind | null = null;

    if (options.planned) {
      const advanced = advanceScheduleAfterPlannedRun(
        baseCoverage,
        lastLeadCount,
        now,
      );
      schedulePhase = advanced.schedulePhase;
      nextScheduledRunAt = advanced.nextScheduledRunAt;
      scheduledRunCount = advanced.scheduledRunCount;
      lastRunKind = ScrapeLastRunKind.planned;
    } else if (options.onDemand) {
      lastRunKind = ScrapeLastRunKind.on_demand;
    }

    await this.prisma.scrapeCoverage.upsert({
      where: { cityId_category: { cityId, category } },
      create: {
        cityId,
        category,
        firstRunAt: now,
        lastRunAt: now,
        lastStatus,
        lastLeadCount,
        schedulePhase,
        nextScheduledRunAt,
        scheduledRunCount,
        lastRunKind,
      },
      update: {
        lastRunAt: now,
        lastStatus,
        lastLeadCount,
        schedulePhase,
        nextScheduledRunAt,
        scheduledRunCount,
        ...(lastRunKind !== null ? { lastRunKind } : {}),
      },
    });
    this.logger.log(
      `[refreshLeads] Coverage cityId=${cityId} category=${category} status=${lastStatus} leads=${lastLeadCount} phase=${schedulePhase}`,
    );
  }
}
