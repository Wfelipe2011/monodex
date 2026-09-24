import { Injectable } from '@nestjs/common';
import { Lead } from '@prisma/client';
import { scrollMapsFeedUntilSettled, waitForMapsFeed } from './maps-feed-scroll';
import { navigateToMapsSearch } from './maps-navigation';
import { captureMapsScrapeDebug } from './maps-scrape-debug';

export type ScrapeSorocabaLeadsOptions = {
    maxBairros?: number;
    startBairroIndex?: number;
    shortScroll?: boolean;
};

const SHORT_SCROLL_MAX = 12;

@Injectable()
export class GoogleMapsScraper {
    async scrapeSorocabaLeads(
        city: string,
        categories: string[],
        bairros: string[],
        cb: (body: Lead[]) => Promise<void>,
        options?: ScrapeSorocabaLeadsOptions,
    ) {
        console.log('🔧 Iniciando o scraper do Google Maps...');
        const puppeteer = require('puppeteer-extra');
        const Stealth = require('puppeteer-extra-plugin-stealth')();
        puppeteer.use(Stealth);

        console.log('🔧 Abrindo navegador...');
        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
        });
        const page = await browser.newPage();

        await page.setViewport({ width: 1440, height: 900 });
        console.log('🔧 Viewport configurado.');

        const shortRun = options?.shortScroll === true || options?.maxBairros != null;
        const categoryList = shortRun ? categories : [...categories].sort(() => Math.random() - 0.5);
        let bairroList: string[];
        if (options?.maxBairros != null) {
            const start = options.startBairroIndex ?? 0;
            bairroList = bairros.slice(start, start + options.maxBairros);
        } else if (shortRun) {
            bairroList = bairros;
        } else {
            bairroList = [...bairros].sort(() => Math.random() - 0.5);
        }
        console.log('🔧 Categorias:', categoryList);
        console.log('🔧 Bairros nesta execução:', bairroList.length);

        const scrollOpts = options?.shortScroll ? { maxScrolls: SHORT_SCROLL_MAX } : undefined;

        for (const category of categoryList) {
            console.log(`🔍 Iniciando busca para categoria: ${category}`);
            for (const bairro of bairroList) {
                try {
                    console.log(`➡️  Buscando no bairro: ${bairro}`);
                    const searchQuery = `${category} ${bairro} ${city} SP`;
                    console.log(`🌐 Navegando para busca: ${searchQuery}`);
                    await navigateToMapsSearch(page, searchQuery);

                    console.log('⏳ Aguardando feed de resultados...');
                    const hasFeed = await waitForMapsFeed(page);
                    const debugCtx = { searchQuery, city, category, bairro };
                    if (!hasFeed) {
                        console.warn('⚠️ Feed de resultados não encontrado. Pulando...');
                        await captureMapsScrapeDebug(page, {
                            ...debugCtx,
                            reason: 'maps_feed_not_found',
                        });
                        continue;
                    }

                    await scrollMapsFeedUntilSettled(
                        page,
                        `${category} no bairro ${bairro}`,
                        scrollOpts,
                    );

                    console.log('📝 Extraindo dados dos resultados...');
                    const categoryResults = await page.evaluate(() => {
                        const results = [];
                        const items = document.querySelectorAll('.Nv2PK');

                        items.forEach((el) => {
                            const websiteElement = el.querySelector('.lcr4fd') as HTMLAnchorElement;
                            results.push({
                                name: el.querySelector('.qBF1Pd')?.textContent?.trim(),
                                phone: el.querySelector('.UsdlK')?.textContent?.trim(),
                                website: websiteElement?.href || '',
                                rating: parseFloat(el.querySelector('.MW4etd')?.textContent || '0'),
                                reviews: parseInt(
                                    el.querySelector('.UY7F9')?.textContent?.replace(/\D/g, '') || '0',
                                ),
                            });
                        });

                        return results;
                    });

                    console.log(`🔢 Quantidade de resultados extraídos: ${categoryResults.length}`);

                    if (categoryResults.length === 0) {
                        console.warn('⚠️ Nenhum lead extraído dos cards visíveis.');
                        await captureMapsScrapeDebug(page, {
                            ...debugCtx,
                            reason: 'zero_leads_extracted',
                        });
                        continue;
                    }

                    const body: Lead[] = categoryResults.map((item) => ({
                        name: item['name'],
                        phone: item['phone'],
                        website: item['website'],
                        rating: item['rating'],
                        reviews: item['reviews'],
                        category: category,
                    }));
                    console.log('💾 Salvando leads extraídos:', body.length);
                    await cb(body);
                    console.log('✅ Leads salvos com sucesso:', body.length);

                    const delay = 3000 + Math.random() * 5000;
                    console.log(`⏳ Aguardando ${delay.toFixed(0)}ms para evitar detecção...`);
                    await new Promise((resolve) => setTimeout(resolve, delay));
                } catch (error) {
                    console.error(
                        `❌ Erro ao processar categoria "${category}" no bairro "${bairro}":`,
                        error,
                    );
                    const message = error instanceof Error ? error.message : String(error);
                    await captureMapsScrapeDebug(page, {
                        searchQuery: `${category} ${bairro} ${city} SP`,
                        city,
                        category,
                        bairro,
                        reason: 'scrape_error',
                        extra: message.slice(0, 500),
                    }).catch(() => undefined);
                    continue;
                }
            }
            console.log(`🏁 Finalizada a categoria: ${category}`);
        }

        await browser.close();
        console.log('🛑 Navegador fechado. Scraping finalizado.');
    }
}
