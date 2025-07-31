import { Injectable, OnModuleInit } from '@nestjs/common';
import { GoogleMapsScraper } from './scraper/google-maps.scraper';
import { PrismaService } from '@core/infra/prisma/prisma.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import { GoogleMapsNeighborhoodScraper } from './scraper/google-maps-neighborhood.scraper';
@Injectable()
export class CapturaScraperService implements OnModuleInit {
    constructor(
        private scraper: GoogleMapsScraper,
        private googleMapsNeighborhoodScraper: GoogleMapsNeighborhoodScraper,
        private prisma: PrismaService
    ) {
        // this.scrape(["Mecanicas", "Auto Elétricas"]);
        // this.scrape(["contadores", "corretores", "consultórios", "clínicas"]);
        // this.googleMapsNeighborhoodScraper.scraper('Sorocaba');

    }

    async onModuleInit() {
        // while (true) {
        //     // console.log('[CapturaScraperService] Module initialized, starting initial scrape...');
        //     // await this.googleMapsNeighborhoodScraper.scraper('Campinas').catch(e => console.error('[CapturaScraperService] Error scraping Campinas:', e));
        //     // await this.googleMapsNeighborhoodScraper.scraper('Ribeiro Preto').catch(e => console.error('[CapturaScraperService] Error scraping Ribeirão Preto:', e));
        //     // await this.googleMapsNeighborhoodScraper.scraper('Bauru').catch(e => console.error('[CapturaScraperService] Error scraping Bauru:', e));
        //     // await this.googleMapsNeighborhoodScraper.scraper('Goiânia').catch(e => console.error('[CapturaScraperService] Error scraping Goiânia:', e));
        //     // await this.googleMapsNeighborhoodScraper.scraper('Brasília').catch(e => console.error('[CapturaScraperService] Error scraping Brasília:', e));
        // }
    }

    // @Cron(CronExpression.EVERY_DAY_AT_1AM)
    async scrape(categories: string[]) {
        console.log('[refreshLeads] Starting lead refresh...');
        await this.scraper.scrapeSorocabaLeads('Sorocaba', categories, async (params) => {
            for (const p of params) {
                if (!p.phone) {
                    console.log(`[refreshLeads] Skipping lead without phone:`, p);
                    continue;
                }
                const cleanPhone = p.phone.replace(/[^0-9]/g, '');
                try {
                    const existingLead = await this.prisma.lead.findUnique({
                        where: { phone: cleanPhone }
                    });
                    if (existingLead) {
                        console.log(`[refreshLeads] Lead with phone ${cleanPhone} already exists, skipping upsert.`);
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
                    console.log(`[refreshLeads] Upserted lead with phone: ${cleanPhone}`);
                } catch (e) {
                    console.error(`[refreshLeads] Error upserting lead with phone: ${cleanPhone}`, e);
                }
            }
        }).catch((e) => console.error('[refreshLeads] Error in scrapeSorocabaLeads:', e));
        console.log('[refreshLeads] Leads refreshed');

        await this.scrape(categories)
    }
}
