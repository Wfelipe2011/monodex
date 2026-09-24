import { waitForMapsFeed } from './maps-feed-scroll';

describe('waitForMapsFeed', () => {
  it('returns true when lead cards appear without role=feed', async () => {
    const order: string[] = [];
    const page = {
      waitForSelector: jest.fn(async (selector: string) => {
        order.push(selector);
        if (selector === 'div[role="feed"]' || selector.includes('m6QErb')) {
          throw new Error('missing');
        }
        return true;
      }),
      evaluate: jest.fn(async () => false),
    };

    const ok = await waitForMapsFeed(page as never);
    expect(ok).toBe(true);
    expect(page.waitForSelector).toHaveBeenCalledWith('.Nv2PK', { timeout: 15_000 });
  });

  it('returns false when no selector matches', async () => {
    const page = {
      waitForSelector: jest.fn(async () => {
        throw new Error('missing');
      }),
      evaluate: jest.fn(async () => false),
    };

    expect(await waitForMapsFeed(page as never)).toBe(false);
  });
});
