const MAPS_FEED_SELECTOR = 'div[role="feed"]';
const MAPS_FEED_FALLBACK_SELECTOR = '.m6QErb.DxyBCb.kA9KIf.dS8AEf';
const MAX_FEED_SCROLLS = 40;
const STALLED_SCROLL_ROUNDS = 3;

type MapsPage = {
    waitForSelector: (selector: string, options?: { timeout?: number }) => Promise<unknown>;
    evaluate: <T>(fn: () => T) => Promise<T>;
};

type FeedState = {
    atEnd: boolean;
    cardCount: number;
};

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function waitForMapsFeed(page: MapsPage): Promise<boolean> {
    try {
        await page.waitForSelector(MAPS_FEED_SELECTOR, { timeout: 15000 });
        return true;
    } catch {
        try {
            await page.waitForSelector(MAPS_FEED_FALLBACK_SELECTOR, { timeout: 10000 });
            return true;
        } catch {
            return false;
        }
    }
}

export async function scrollMapsFeedUntilSettled(page: MapsPage, label: string): Promise<void> {
    let attempts = 0;
    let stalled = 0;
    let lastCount = -1;

    console.log(`🔽 Iniciando scroll para carregar resultados (${label})...`);

    while (attempts < MAX_FEED_SCROLLS) {
        const state = await page.evaluate((): FeedState => {
            const text = (document.body.innerText || '').toLowerCase();
            const atEnd =
                !!document.querySelector('span.HlvSq') ||
                text.includes('chegou ao final da lista') ||
                text.includes('reached the end of the list');

            return {
                atEnd,
                cardCount: document.querySelectorAll('.Nv2PK').length,
            };
        });

        if (state.atEnd) {
            console.log(`✅ Fim da lista detectado (${state.cardCount} cards) - ${label}`);
            return;
        }

        if (lastCount >= 0 && state.cardCount <= lastCount) {
            stalled += 1;
            console.log(
                `⏸️ Lista não cresceu (${state.cardCount} cards, ${stalled}/${STALLED_SCROLL_ROUNDS} estagnada) - ${label}`,
            );
            if (stalled >= STALLED_SCROLL_ROUNDS) {
                console.log(`⏹️ Encerrando scroll: lista estagnada em ${state.cardCount} cards - ${label}`);
                return;
            }
        } else {
            stalled = 0;
            lastCount = state.cardCount;
        }

        console.log(
            `🔽 Scroll attempt ${attempts + 1}/${MAX_FEED_SCROLLS} (${state.cardCount} cards) - ${label}`,
        );

        await page.evaluate(() => {
            const fallbacks = document.querySelectorAll('.m6QErb.DxyBCb.kA9KIf.dS8AEf');
            const feed =
                document.querySelector('[role="feed"]') || fallbacks[1] || fallbacks[0];
            if (feed) {
                feed.scrollBy(0, Math.max((feed as HTMLElement).clientHeight, 400));
            }
        });

        await sleep(1000 + Math.random() * 2000);
        attempts += 1;
    }

    console.log(`⏹️ Encerrando scroll: teto de ${MAX_FEED_SCROLLS} tentativas - ${label}`);
}
