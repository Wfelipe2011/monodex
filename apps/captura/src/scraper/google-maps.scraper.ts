import { Injectable } from '@nestjs/common';
import { Lead } from '@prisma/client';
import { scrollMapsFeedUntilSettled, waitForMapsFeed } from './maps-feed-scroll';

@Injectable()
export class GoogleMapsScraper {
    async scrapeSorocabaLeads(
        city: string,
        categories: string[],
        bairros: string[],
        cb: (body: Lead[]) => Promise<void>,
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

        const shuffledCategories = [...categories].sort(() => Math.random() - 0.5);
        const shuffledBairros = [...bairros].sort(() => Math.random() - 0.5);
        console.log('🔧 Categorias embaralhadas:', shuffledCategories);
        console.log('🔧 Bairros embaralhados:', shuffledBairros.length);

        for (const category of shuffledCategories) {
            console.log(`🔍 Iniciando busca para categoria: ${category}`);
            for (const bairro of shuffledBairros) {
                try {
                    console.log(`➡️  Buscando no bairro: ${bairro}`);
                    const url = `https://www.google.com/maps/search/${encodeURIComponent(category)}+${encodeURIComponent(bairro)}+${encodeURIComponent(city)}+SP`;
                    console.log(`🌐 Navegando para URL: ${url}`);
                    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

                    console.log('⏳ Aguardando feed de resultados...');
                    const hasFeed = await waitForMapsFeed(page);
                    if (!hasFeed) {
                        console.warn('⚠️ Feed de resultados não encontrado. Pulando...');
                        continue;
                    }

                    await scrollMapsFeedUntilSettled(page, `${category} no bairro ${bairro}`);

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
                    continue;
                }
            }
            console.log(`🏁 Finalizada a categoria: ${category}`);
        }

        await browser.close();
        console.log('🛑 Navegador fechado. Scraping finalizado.');
    }
}
