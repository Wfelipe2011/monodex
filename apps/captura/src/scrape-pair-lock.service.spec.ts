import { ScrapePairLockService } from './scrape-pair-lock.service';

describe('ScrapePairLockService', () => {
  let locks: ScrapePairLockService;

  beforeEach(() => {
    locks = new ScrapePairLockService();
  });

  it('blocks second acquire on same pair until release', () => {
    expect(locks.tryAcquire(1, 'gym')).toBe(true);
    expect(locks.tryAcquire(1, 'gym')).toBe(false);
    locks.release(1, 'gym');
    expect(locks.tryAcquire(1, 'gym')).toBe(true);
  });

  it('allows different pairs concurrently', () => {
    expect(locks.tryAcquire(1, 'gym')).toBe(true);
    expect(locks.tryAcquire(1, 'yoga')).toBe(true);
    expect(locks.tryAcquire(2, 'gym')).toBe(true);
  });
});
