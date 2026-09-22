import { Injectable } from '@nestjs/common';

/** In-process lock per `(cityId, category)` — shared by planned cron and on-demand. */
@Injectable()
export class ScrapePairLockService {
  private readonly locks = new Map<string, boolean>();

  pairKey(cityId: number, category: string): string {
    return `${cityId}:${category}`;
  }

  tryAcquire(cityId: number, category: string): boolean {
    const key = this.pairKey(cityId, category);
    if (this.locks.get(key)) {
      return false;
    }
    this.locks.set(key, true);
    return true;
  }

  release(cityId: number, category: string): void {
    this.locks.delete(this.pairKey(cityId, category));
  }

  releaseKey(key: string): void {
    this.locks.delete(key);
  }

  isHeld(cityId: number, category: string): boolean {
    return this.locks.get(this.pairKey(cityId, category)) ?? false;
  }
}
