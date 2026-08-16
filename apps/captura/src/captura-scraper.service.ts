import { Injectable, Logger } from '@nestjs/common';
import { City } from '@prisma/client';
import { GoogleMapsScraper } from './scraper/google-maps.scraper';
import { PrismaService } from '@core/infra/prisma/prisma.service';
import { GoogleMapsNeighborhoodScraper } from './scraper/google-maps-neighborhood.scraper';

type CoverageStatus = 'success' | 'failed' | 'partial';

type CityScrapeGroup = {
  city: City;
  categories: string[];
};

@Injectable()
export class CapturaScraperService {
  private readonly logger = new Logger(CapturaScraperService.name);
  private running = false;

  constructor(
    private scraper: GoogleMapsScraper,
    private googleMapsNeighborhoodScraper: GoogleMapsNeighborhoodScraper,
    private prisma: PrismaService,
  ) {}

  /** Disparado pelo cron dinâmico (`PlatformJobSchedule` SCRAPE). */
  async handleMorningScrape() {
    this.logger.log('[cron] Scrape disparado');

    const targets = await this.prisma.scrapeTarget.findMany({
      where: { enabled: true },
      include: { city: true },
    });

    if (targets.length === 0) {
      this.logger.log('[cron] Nenhum ScrapeTarget enabled; nada a fazer');
      return;
    }

    const byCity = new Map<number, CityScrapeGroup>();
    for (const target of targets) {
      const group = byCity.get(target.cityId);
      if (group) {
        group.categories.push(target.category);
      } else {
        byCity.set(target.cityId, {
          city: target.city,
          categories: [target.category],
        });
      }
    }

    await this.runScrapeJob([...byCity.values()]);
  }

  async runScrapeJob(groups: CityScrapeGroup[]) {
    if (this.running) {
      this.logger.warn('[refreshLeads] Scrape já em andamento; ignorando disparo');
      return;
    }

    this.running = true;
    try {
      for (const { city, categories } of groups) {
        await this.scrape(city, categories);
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
      await this.googleMapsNeighborhoodScraper.scraper(city.name);
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
        await this.upsertCoverage(city.id, category, 'failed', 0);
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
      await this.upsertCoverage(city.id, category, status, count);
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
  ) {
    const now = new Date();
    await this.prisma.scrapeCoverage.upsert({
      where: { cityId_category: { cityId, category } },
      create: {
        cityId,
        category,
        firstRunAt: now,
        lastRunAt: now,
        lastStatus,
        lastLeadCount,
      },
      update: {
        lastRunAt: now,
        lastStatus,
        lastLeadCount,
      },
    });
    this.logger.log(
      `[refreshLeads] Coverage cityId=${cityId} category=${category} status=${lastStatus} leads=${lastLeadCount}`,
    );
  }
}
