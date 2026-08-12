import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { GoogleMapsScraper } from './scraper/google-maps.scraper';
import { PrismaService } from '@core/infra/prisma/prisma.service';
import { Cron } from '@nestjs/schedule';
import { GoogleMapsNeighborhoodScraper } from './scraper/google-maps-neighborhood.scraper';

const SCRAPE_CITY = 'Pindamonhangaba';
const SCRAPE_CATEGORIES = [
    "Construtoras",
    // "Escritórios de advocacia",
    // "Clínicas médicas",
    // "Clínicas odontológicas",
    // "Consultórios",
    // "Estéticas",
    // "Consutorias"
  ];

/** Data (America/Sao_Paulo) em que o scrape das 20h deve rodar uma vez. */
const ONE_SHOT_EVENING_DATE = '2026-08-11';

@Injectable()
export class CapturaScraperService implements OnModuleInit {
  private readonly logger = new Logger(CapturaScraperService.name);
  private running = false;

  constructor(
    private scraper: GoogleMapsScraper,
    private googleMapsNeighborhoodScraper: GoogleMapsNeighborhoodScraper,
    private prisma: PrismaService,
  ) {}

  async onModuleInit() {
    this.logger.log(
      `[onModuleInit] Scrape agendado: 06:00 diário + 20:00 one-shot em ${ONE_SHOT_EVENING_DATE} (America/Sao_Paulo)`,
    );
  }

  /** Todo dia às 06:00 (horário de Brasília). */
  @Cron('0 6 * * *', { timeZone: 'America/Sao_Paulo' })
  async handleMorningScrape() {
    this.logger.log('[cron] Scrape das 06:00 disparado');
    await this.runScrapeJob(SCRAPE_CATEGORIES);
  }

  /** Hoje (2026-08-11) às 20:00 BRT; nos demais dias não faz nada. */
  @Cron('25 20 * * *', { timeZone: 'America/Sao_Paulo' })
  async handleEveningScrapeOnce() {
    const todayBr = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());

    if (todayBr !== ONE_SHOT_EVENING_DATE) {
      this.logger.debug(
        `[cron] Scrape 20:00 ignorado (hoje=${todayBr}, one-shot=${ONE_SHOT_EVENING_DATE})`,
      );
      return;
    }

    this.logger.log(`[cron] Scrape one-shot das 20:00 (${ONE_SHOT_EVENING_DATE}) disparado`);
    await this.runScrapeJob(SCRAPE_CATEGORIES);
  }

  async runScrapeJob(categories: string[]) {
    if (this.running) {
      this.logger.warn('[refreshLeads] Scrape já em andamento; ignorando disparo');
      return;
    }

    this.running = true;
    try {
      await this.scrape(SCRAPE_CITY, categories);
    } finally {
      this.running = false;
    }
  }

  async scrape(cityName: string, categories: string[]) {
    this.logger.log(`[refreshLeads] Starting lead refresh for ${cityName}...`);

    let city = await this.prisma.city.findFirst({ where: { name: cityName } });
    if (!city) {
      city = await this.prisma.city.create({ data: { name: cityName } });
      this.logger.log(`[refreshLeads] Cidade criada: ${cityName}`);
    }

    let neighborhoods = await this.prisma.neighborhood.findMany({
      where: { cityId: city.id },
      select: { name: true },
    });

    if (neighborhoods.length === 0) {
      this.logger.log(
        `[refreshLeads] Nenhum bairro no DB para ${cityName}; rodando neighborhood scraper...`,
      );
      await this.googleMapsNeighborhoodScraper.scraper(cityName);
      neighborhoods = await this.prisma.neighborhood.findMany({
        where: { cityId: city.id },
        select: { name: true },
      });
    }

    const bairros = neighborhoods.map((n) => n.name).filter(Boolean);
    if (bairros.length === 0) {
      this.logger.error(
        `[refreshLeads] Sem bairros para ${cityName}; abortando scrape de leads`,
      );
      return;
    }

    await this.scraper
      .scrapeSorocabaLeads(cityName, categories, bairros, async (params) => {
        for (const p of params) {
          if (!p.phone) {
            this.logger.log(`[refreshLeads] Skipping lead without phone: ${JSON.stringify(p)}`);
            continue;
          }
          const cleanPhone = p.phone.replace(/[^0-9]/g, '');
          try {
            const existingLead = await this.prisma.lead.findUnique({
              where: { phone: cleanPhone },
            });
            if (existingLead) {
              this.logger.log(
                `[refreshLeads] Lead with phone ${cleanPhone} already exists, skipping`,
              );
              continue;
            }
            await this.prisma.lead.create({
              data: {
                name: p.name,
                phone: cleanPhone,
                website: p.website ?? '',
                rating: p.rating ?? null,
                reviews: p.reviews ?? null,
                category: p.category ?? '',
              },
            });
            this.logger.log(`[refreshLeads] Created lead phone=${cleanPhone}`);
          } catch (e) {
            this.logger.error(
              `[refreshLeads] Error upserting lead phone=${cleanPhone}`,
              e instanceof Error ? e.stack : e,
            );
          }
        }
      })
      .catch((e) =>
        this.logger.error(
          '[refreshLeads] Error in scrapeSorocabaLeads',
          e instanceof Error ? e.stack : e,
        ),
      );

    this.logger.log('[refreshLeads] Leads refreshed');
  }
}
