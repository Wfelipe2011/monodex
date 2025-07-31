import { Injectable } from '@nestjs/common';
import { Lead } from '@prisma/client';

@Injectable()
export class GoogleMapsScraper {
    async scrapeSorocabaLeads(city:string, categories: string[],cb: (body: Lead[]) => Promise<void>) {
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

        // Configurações de viewport para melhor renderização
        await page.setViewport({ width: 1440, height: 900 });
        console.log('🔧 Viewport configurado.');

        // pegar bairros de city
        const bairros = []
        const url = `https://www.google.com/maps/search/${city}+Bairros`;
        console.log(`🌐 Navegando para URL: ${url}`);
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
        
        
        
        
        
        
        
        
        
        // Embaralha a ordem das categorias antes de processar
        const shuffledCategories = [...categories].sort(() => Math.random() - 0.5);
        const shuffledBairros = [...bairros].sort(() => Math.random() - 0.5);
        console.log('🔧 Categorias embaralhadas:', shuffledCategories);
        console.log('🔧 Bairros embaralhados:', shuffledBairros);

        for (const category of shuffledCategories) {
            console.log(`🔍 Iniciando busca para categoria: ${category}`);
            for (const bairro of shuffledBairros) {
                try {
                    console.log(`➡️  Buscando no bairro: ${bairro}`);
                    const url = `https://www.google.com/maps/search/${encodeURIComponent(category)}+${encodeURIComponent(bairro)}+Sorocaba+SP`;
                    console.log(`🌐 Navegando para URL: ${url}`);
                    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

                    console.log('⏳ Aguardando seletor do container de resultados...');
                    await page.waitForSelector('.m6QErb.DxyBCb.kA9KIf.dS8AEf', { timeout: 10000 });

                    console.log('⏳ Aguardando novamente seletor do container de resultados...');
                    await page.waitForSelector('.m6QErb.DxyBCb.kA9KIf.dS8AEf', { timeout: 15000 });
                    const scrollContainers = await page.$$('.m6QErb.DxyBCb.kA9KIf.dS8AEf');
                    console.log(`🔧 Containers de scroll encontrados: ${scrollContainers.length}`);

                    if (scrollContainers.length < 2) {
                        console.warn('⚠️ Container de scroll não encontrado. Pulando categoria...');
                        continue;
                    }

                    const scrollTarget = scrollContainers[1];
                    const randomScrollPosition = Math.floor(Math.random() * (2000 - 500 + 1)) + 500;
                    console.log(`🔽 Rolando para a posição aleatória: ${randomScrollPosition}px`);
                    let isAtBottom = false;
                    let attempts = 0;
                    const maxScrolls = randomScrollPosition;

                    console.log('🔽 Iniciando scroll para carregar todos os resultados...');
                    while (!isAtBottom && attempts < maxScrolls) {
                        console.log(`🔽 Scroll attempt ${attempts + 1} - ${category} no bairro ${bairro}`);
                        await page.evaluate((el) => {
                            el.scrollBy(0, 200);
                        }, scrollTarget);

                        await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

                        isAtBottom = await page.evaluate(() => {
                            return !!document.querySelector('span.HlvSq');
                        });

                        if (isAtBottom) {
                            console.log('✅ Fim da lista detectado.');
                        }

                        attempts++;
                    }

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
                                    el.querySelector('.UY7F9')?.textContent?.replace(/\D/g, '') || '0'
                                )
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
                    }))
                    console.log("💾 Salvando leads extraídos:", body.length)
                    await cb(body)
                    console.log("✅ Leads salvos com sucesso:", body.length)

                    // Delay anti-detecção
                    const delay = 3000 + Math.random() * 5000;
                    console.log(`⏳ Aguardando ${delay.toFixed(0)}ms para evitar detecção...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                } catch (error) {
                    console.error(`❌ Erro ao processar categoria "${category}" no bairro "${bairro}":`, error);
                    continue;
                }
            }
            console.log(`🏁 Finalizada a categoria: ${category}`);
        }

        await browser.close();
        console.log('🛑 Navegador fechado. Scraping finalizado.');
    }
}
