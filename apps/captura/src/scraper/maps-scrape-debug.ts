import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';

type MapsDebugPage = {
  url: () => string;
  screenshot: (options?: { path?: string; fullPage?: boolean }) => Promise<unknown>;
};

export type MapsFeedMissContext = {
  searchQuery: string;
  city: string;
  category: string;
  bairro: string;
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

/**
 * Quando o feed do Maps não aparece, grava PNG + meta (.txt) se SCRAPE_DEBUG_DIR
 * ou SCRAPE_DEBUG_SCREENSHOTS=true estiver configurado.
 */
export async function captureMapsFeedMissDebug(
  page: MapsDebugPage,
  context: MapsFeedMissContext,
): Promise<string | null> {
  const dir = debugDir();
  if (!dir) {
    return null;
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const base = `${stamp}_${slugPart(context.city)}_${slugPart(context.category)}_${slugPart(context.bairro)}`;
  const absDir = join(process.cwd(), dir);

  try {
    await mkdir(absDir, { recursive: true });
    const pngPath = join(absDir, `${base}.png`);
    const metaPath = join(absDir, `${base}.txt`);

    await page.screenshot({ path: pngPath, fullPage: true });

    const pageUrl = page.url();
    const meta = [
      `at=${new Date().toISOString()}`,
      `searchQuery=${context.searchQuery}`,
      `city=${context.city}`,
      `category=${context.category}`,
      `bairro=${context.bairro}`,
      `pageUrl=${pageUrl}`,
      `reason=maps_feed_not_found`,
    ].join('\n');

    await writeFile(metaPath, meta, 'utf8');

    console.warn(
      `[scrape-debug] Feed ausente — screenshot: ${pngPath} meta: ${metaPath} url=${pageUrl}`,
    );
    return pngPath;
  } catch (e) {
    console.error(
      '[scrape-debug] Falha ao salvar screenshot',
      e instanceof Error ? e.message : e,
    );
    return null;
  }
}
