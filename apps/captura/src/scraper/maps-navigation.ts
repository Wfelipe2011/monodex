type MapsNavPage = {
  goto: (
    url: string,
    options?: { waitUntil?: 'domcontentloaded' | 'load' | 'networkidle2'; timeout?: number },
  ) => Promise<unknown>;
};

const MAPS_SEARCH_BASE = 'https://www.google.com/maps/search/';

/**
 * Google Maps rarely reaches networkidle; prefer DOM/load and retry once on timeout.
 */
export async function navigateToMapsSearch(
  page: MapsNavPage,
  searchQuery: string,
  options?: { timeoutMs?: number },
): Promise<void> {
  const timeout = options?.timeoutMs ?? 60_000;
  const url = `${MAPS_SEARCH_BASE}${encodeURIComponent(searchQuery)}`;

  const waitStrategies: Array<'domcontentloaded' | 'load'> = ['domcontentloaded', 'load'];
  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt++) {
    for (const waitUntil of waitStrategies) {
      try {
        await page.goto(url, { waitUntil, timeout });
        return;
      } catch (error) {
        lastError = error;
      }
    }
  }

  throw lastError;
}
