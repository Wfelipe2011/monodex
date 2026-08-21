import {
  isSaoPauloHourInPast,
  parseSaoPauloHourToUtc,
  SAO_PAULO_OFFSET_MS,
  startOfCurrentSaoPauloHour,
} from './sao-paulo-time';

describe('sao-paulo-time', () => {
  it('converte hora SP (UTC−3) para instante UTC', () => {
    const utc = parseSaoPauloHourToUtc('2026-08-22T14:00:00');
    expect(utc.toISOString()).toBe('2026-08-22T17:00:00.000Z');
  });

  it('rejeita minuto ≠ 0', () => {
    expect(() => parseSaoPauloHourToUtc('2026-08-22T14:30:00')).toThrow(
      /minuto/,
    );
  });

  it('rejeita sufixo Z (timezone implícito SP)', () => {
    expect(() => parseSaoPauloHourToUtc('2026-08-22T14:00:00Z')).toThrow();
  });

  it('startOfCurrentSaoPauloHour trunca para hora SP', () => {
    // 15:30 UTC = 12:30 SP → início da hora SP = 12:00 SP = 15:00 UTC
    const now = new Date('2026-08-22T15:30:00.000Z');
    expect(startOfCurrentSaoPauloHour(now).toISOString()).toBe(
      '2026-08-22T15:00:00.000Z',
    );
    expect(SAO_PAULO_OFFSET_MS).toBe(3 * 60 * 60 * 1000);
  });

  it('isSaoPauloHourInPast: hora atual não é passado; anterior é', () => {
    const now = new Date('2026-08-22T17:10:00.000Z'); // 14:10 SP
    const currentHour = parseSaoPauloHourToUtc('2026-08-22T14:00:00');
    const pastHour = parseSaoPauloHourToUtc('2026-08-22T13:00:00');
    const futureHour = parseSaoPauloHourToUtc('2026-08-22T15:00:00');
    expect(isSaoPauloHourInPast(currentHour, now)).toBe(false);
    expect(isSaoPauloHourInPast(pastHour, now)).toBe(true);
    expect(isSaoPauloHourInPast(futureHour, now)).toBe(false);
  });
});
