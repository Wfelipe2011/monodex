import { Injectable } from '@nestjs/common';
import { GoogleMapsScraper } from './scraper/google-maps.scraper';
import { PrismaService } from '@core/infra/prisma/prisma.service';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class CapturaScraperService {
  constructor(
    private scraper: GoogleMapsScraper,
    private prisma: PrismaService
  ) {}

//   @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async scrape() {
     console.log('[refreshLeads] Starting lead refresh...');
        await this.scraper.scrapeSorocabaLeads(async (params) => {
            for (const p of params) {
                if (!p.phone) {
                    console.log(`[refreshLeads] Skipping lead without phone:`, p);
                    continue;
                }
                const cleanPhone = p.phone.replace(/[^0-9]/g, '');
                try {
                    await this.prisma.lead.upsert({
                        create: { ...p, phone: cleanPhone },
                        update: { ...p, phone: cleanPhone },
                        where: { phone: cleanPhone }
                    });
                    console.log(`[refreshLeads] Upserted lead with phone: ${cleanPhone}`);
                } catch (e) {
                    console.error(`[refreshLeads] Error upserting lead with phone: ${cleanPhone}`, e);
                }
            }
        }).catch((e) => console.error('[refreshLeads] Error in scrapeSorocabaLeads:', e));
        console.log('[refreshLeads] Leads refreshed');
  }
}
