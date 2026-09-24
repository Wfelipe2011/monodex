export const MAPS_LEAD_CARD_SELECTOR = '.Nv2PK';

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

async function waitSelector(page: MapsPage, selector: string, timeout: number): Promise<boolean> {
    try {
        await page.waitForSelector(selector, { timeout });
        return true;
    } catch {
        return false;
    }
}

/**
 * Maps often shows the results panel without `role="feed"`. Treat lead cards as success.
 */
export async function waitForMapsFeed(page: MapsPage): Promise<boolean> {
    if (await waitSelector(page, MAPS_FEED_SELECTOR, 15_000)) {
        return true;
    }
    if (await waitSelector(page, MAPS_FEED_FALLBACK_SELECTOR, 10_000)) {
        return true;
    }
    if (await waitSelector(page, MAPS_LEAD_CARD_SELECTOR, 15_000)) {
        return true;
    }
    return page.evaluate(
        () => document.querySelectorAll('.Nv2PK').length > 0,
    );
}

export async function scrollMapsFeedUntilSettled(
    page: MapsPage,
    label: string,
    options?: { maxScrolls?: number },
): Promise<void> {
    const scrollLimit = options?.maxScrolls ?? MAX_FEED_SCROLLS;
    let attempts = 0;
    let stalled = 0;
    let lastCount = -1;

    console.log(`🔽 Iniciando scroll para carregar resultados (${label})...`);

    while (attempts < scrollLimit) {
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
            `🔽 Scroll attempt ${attempts + 1}/${scrollLimit} (${state.cardCount} cards) - ${label}`,
        );

        await page.evaluate(() => {
            const scrollStep = 400;
            const feed = document.querySelector('[role="feed"]');
            if (feed) {
                feed.scrollBy(0, Math.max((feed as HTMLElement).clientHeight, scrollStep));
                return;
            }
            const fallbacks = document.querySelectorAll('.m6QErb.DxyBCb.kA9KIf.dS8AEf');
            const panel = fallbacks[1] || fallbacks[0];
            if (panel) {
                panel.scrollBy(0, Math.max(panel.clientHeight, scrollStep));
                return;
            }
            const panels = document.querySelectorAll('.m6QErb');
            for (const el of panels) {
                const html = el as HTMLElement;
                if (el.querySelector('.Nv2PK') && html.scrollHeight > html.clientHeight + 8) {
                    html.scrollBy(0, Math.max(html.clientHeight, scrollStep));
                    return;
                }
            }
        });

        await sleep(1000 + Math.random() * 2000);
        attempts += 1;
    }

    console.log(`⏹️ Encerrando scroll: teto de ${scrollLimit} tentativas - ${label}`);
}
