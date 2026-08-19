import { PrismaService } from '@core/infra/prisma/prisma.service';
import { Injectable } from '@nestjs/common';
import { scrollMapsFeedUntilSettled, waitForMapsFeed } from './maps-feed-scroll';

@Injectable()
export class GoogleMapsNeighborhoodScraper {
    constructor(private prismaService: PrismaService) { }

    async scraper(cityName: string): Promise<void> {
        let city = await this.prismaService.city.findFirst({
            where: {
                name: cityName,
            },
        });
        if (!city) {
            console.error(`❌ Cidade "${cityName}" não encontrada no banco de dados.`);
            city = await this.prismaService.city.create({
                data: {
                    name: cityName,
                },
            });
            console.log(`✅ Cidade "${cityName}" criada no banco de dados.`);
        }

        console.log('🔧 Iniciando o scraper do Google Maps...');
        const puppeteer = require('puppeteer-extra');
        const Stealth = require('puppeteer-extra-plugin-stealth')();
        puppeteer.use(Stealth);

        console.log('🔧 Abrindo navegador...');
        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();

        await page.setViewport({ width: 1440, height: 900 });
        console.log('🔧 Viewport configurado.');

        const url = `https://www.google.com/maps/search/${cityName}+Bairros`;
        console.log(`🌐 Navegando para URL: ${url}`);
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });


        console.log('⏳ Aguardando feed de resultados...');
        const hasFeed = await waitForMapsFeed(page);
        if (!hasFeed) {
            console.warn(`⚠️ Feed de resultados não encontrado para ${cityName}. Abortando.`);
            await browser.close();
            return;
        }

        await scrollMapsFeedUntilSettled(page, `na cidade ${cityName}`);

        console.log('📝 Extraindo dados dos resultados...');
        const result = await page.evaluate(() => {
            const results = [];
            const items = document.querySelectorAll('.Nv2PK');

            items.forEach((el) => {
                results.push({
                    name: el.querySelector('.qBF1Pd')?.textContent?.trim(),
                });
            });

            return results;
        }) as { name: string }[];

        console.log(`🔢 Quantidade de resultados extraídos: ${result.length}`);

        for (const item of result) {
            const neighborhood = await this.prismaService.neighborhood.findFirst({
                where: {
                    name: item.name,
                    cityId: city.id,
                },
            });
            if (!neighborhood) {
                await this.prismaService.neighborhood.create({
                    data: {
                        name: item.name,
                        cityId: city.id,
                    },
                });
                console.log(`✅ Bairro "${item.name}" criado no banco de dados.`);
            } else {
                console.log(`✅ Bairro "${item.name}" já existe no banco de dados.`);
            }
        }
        await browser.close();
        console.log('🛑 Navegador fechado. Scraping finalizado.');
    }
}
