import { createHash } from 'crypto';
import {
  DEFAULT_INVITE_TTL_HOURS,
  generateInviteToken,
  hashInviteToken,
  INVITE_TOKEN_ALPHABET,
  INVITE_TOKEN_LENGTH,
  inviteExpiresAt,
} from './invite-token';

const ALPHABET_SET = new Set(INVITE_TOKEN_ALPHABET.split(''));

describe('generateInviteToken', () => {
  it('gera tokens de length 8 só com o alfabeto', () => {
    for (let i = 0; i < 200; i++) {
      const token = generateInviteToken();
      expect(token).toHaveLength(INVITE_TOKEN_LENGTH);
      for (const char of token) {
        expect(ALPHABET_SET.has(char)).toBe(true);
      }
    }
  });
});

describe('hashInviteToken', () => {
  it('é SHA-256 hex determinístico de 64 chars', () => {
    const raw = 'AB23KLMN';
    const expected = createHash('sha256').update(raw, 'utf8').digest('hex');
    expect(hashInviteToken(raw)).toBe(expected);
    expect(hashInviteToken(raw)).toBe(hashInviteToken(raw));
    expect(hashInviteToken(raw)).toHaveLength(64);
    expect(hashInviteToken(raw)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('hashes de tokens distintos diferem', () => {
    expect(hashInviteToken('AB23KLMN')).not.toBe(hashInviteToken('AB23KLMP'));
  });
});

describe('inviteExpiresAt', () => {
  const now = new Date('2026-08-19T12:00:00.000Z');

  it('avança exatamente ttlHours horas', () => {
    expect(inviteExpiresAt(now, 8).getTime()).toBe(
      now.getTime() + 8 * 3_600_000,
    );
    expect(inviteExpiresAt(now, DEFAULT_INVITE_TTL_HOURS).toISOString()).toBe(
      '2026-08-19T20:00:00.000Z',
    );
  });

  it('ttlHours inválido lança RangeError', () => {
    expect(() => inviteExpiresAt(now, 0)).toThrow(RangeError);
    expect(() => inviteExpiresAt(now, -1)).toThrow(RangeError);
  });
});

describe('DEFAULT_INVITE_TTL_HOURS', () => {
  it('documenta o TTL default como 8h', () => {
    expect(DEFAULT_INVITE_TTL_HOURS).toBe(8);
  });
});
