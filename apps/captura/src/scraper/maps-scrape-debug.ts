import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';

export type MapsScrapeDebugReason =
  | 'maps_feed_not_found'
  | 'zero_leads_extracted'
  | 'scrape_error';

type MapsDebugPage = {
  url: () => string;
  screenshot: (options?: { path?: string; fullPage?: boolean }) => Promise<unknown>;
  content: () => Promise<string>;
};

export type MapsScrapeDebugContext = {
  searchQuery: string;
  city: string;
  category: string;
  bairro: string;
  reason: MapsScrapeDebugReason;
  extra?: string;
};

function debugDir(): string | null {
  const dir = process.env.SCRAPE_DEBUG_DIR?.trim();
  if (dir) {
    return dir;
  }
  const flag = process.env.SCRAPE_DEBUG_SCREENSHOTS?.trim().toLowerCase();
  if (flag === '1' || flag === 'true' || flag === 'yes') {
    return 'logs/scrape-debug';
  }
  return null;
}

function slugPart(value: string, maxLen = 40): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, maxLen)
    .toLowerCase();
}

/** @deprecated use captureMapsScrapeDebug */
export async function captureMapsFeedMissDebug(
  page: MapsDebugPage,
  context: Omit<MapsScrapeDebugContext, 'reason'>,
): Promise<string | null> {
  return captureMapsScrapeDebug(page, {
    ...context,
    reason: 'maps_feed_not_found',
  });
}

/**
 * PNG + HTML + meta (.txt) quando SCRAPE_DEBUG_DIR ou SCRAPE_DEBUG_SCREENSHOTS=true.
 */
export async function captureMapsScrapeDebug(
  page: MapsDebugPage,
  context: MapsScrapeDebugContext,
): Promise<string | null> {
  const dir = debugDir();
  if (!dir) {
    return null;
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const base = `${stamp}_${slugPart(context.city)}_${slugPart(context.category)}_${slugPart(context.bairro)}_${context.reason}`;
  const absDir = join(process.cwd(), dir);

  try {
    await mkdir(absDir, { recursive: true });
    const pngPath = join(absDir, `${base}.png`);
    const htmlPath = join(absDir, `${base}.html`);
    const metaPath = join(absDir, `${base}.txt`);

    await page.screenshot({ path: pngPath, fullPage: true });

    const pageUrl = page.url();
    const html = await page.content();
    await writeFile(htmlPath, html, 'utf8');

    const cardCountMatch = html.match(/class="Nv2PK"/g);
    const metaLines = [
      `at=${new Date().toISOString()}`,
      `searchQuery=${context.searchQuery}`,
      `city=${context.city}`,
      `category=${context.category}`,
      `bairro=${context.bairro}`,
      `pageUrl=${pageUrl}`,
      `reason=${context.reason}`,
      `htmlNv2PKCount=${cardCountMatch?.length ?? 0}`,
    ];
    if (context.extra) {
      metaLines.push(`extra=${context.extra}`);
    }
    await writeFile(metaPath, metaLines.join('\n'), 'utf8');

    console.warn(
      `[scrape-debug] ${context.reason} — png: ${pngPath} html: ${htmlPath} meta: ${metaPath}`,
    );
    return pngPath;
  } catch (e) {
    console.error(
      '[scrape-debug] Falha ao salvar artefatos',
      e instanceof Error ? e.message : e,
    );
    return null;
  }
}
