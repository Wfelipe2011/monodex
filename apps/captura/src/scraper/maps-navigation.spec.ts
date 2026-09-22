import { navigateToMapsSearch } from './maps-navigation';

describe('navigateToMapsSearch', () => {
  it('uses encoded URL and domcontentloaded first', async () => {
    const calls: Array<{ url: string; waitUntil?: string }> = [];
    const page = {
      goto: async (url: string, options?: { waitUntil?: string }) => {
        calls.push({ url, waitUntil: options?.waitUntil });
      },
    };

    await navigateToMapsSearch(page, 'Cruzeiro Bairros');

    expect(calls[0]).toEqual({
      url: 'https://www.google.com/maps/search/Cruzeiro%20Bairros',
      waitUntil: 'domcontentloaded',
    });
    expect(calls).toHaveLength(1);
  });

  it('retries with load after domcontentloaded failure', async () => {
    const calls: string[] = [];
    const page = {
      goto: async (_url: string, options?: { waitUntil?: string }) => {
        calls.push(options?.waitUntil ?? '');
        if (calls.length === 1) {
          throw new Error('timeout');
        }
      },
    };

    await navigateToMapsSearch(page, 'City');

    expect(calls).toEqual(['domcontentloaded', 'load']);
  });

  it('throws after exhausting retries', async () => {
    const page = {
      goto: async () => {
        throw new Error('Navigation timeout');
      },
    };

    await expect(navigateToMapsSearch(page, 'City', { timeoutMs: 1000 })).rejects.toThrow(
      'Navigation timeout',
    );
  });
});
