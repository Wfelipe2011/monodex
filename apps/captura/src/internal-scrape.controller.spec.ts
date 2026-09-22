import { UnauthorizedException } from '@nestjs/common';
import { ExecutionContext } from '@nestjs/common/interfaces';
import { InternalScrapeSecretGuard } from './guards/internal-scrape-secret.guard';

describe('InternalScrapeSecretGuard', () => {
  const guard = new InternalScrapeSecretGuard();
  const prev = process.env.CAPTURA_INTERNAL_SCRAPE_SECRET;

  afterEach(() => {
    if (prev === undefined) {
      delete process.env.CAPTURA_INTERNAL_SCRAPE_SECRET;
    } else {
      process.env.CAPTURA_INTERNAL_SCRAPE_SECRET = prev;
    }
  });

  function context(secret?: string): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: { 'x-internal-secret': secret },
        }),
      }),
    } as ExecutionContext;
  }

  it('rejects missing or invalid secret with 401', () => {
    process.env.CAPTURA_INTERNAL_SCRAPE_SECRET = 'expected';
    expect(() => guard.canActivate(context())).toThrow(UnauthorizedException);
    expect(() => guard.canActivate(context('wrong'))).toThrow(
      UnauthorizedException,
    );
  });

  it('allows matching secret', () => {
    process.env.CAPTURA_INTERNAL_SCRAPE_SECRET = 'expected';
    expect(guard.canActivate(context('expected'))).toBe(true);
  });
});
