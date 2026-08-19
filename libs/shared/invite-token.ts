import { createHash, randomInt } from 'crypto';

export const INVITE_TOKEN_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
export const INVITE_TOKEN_LENGTH = 8;
export const DEFAULT_INVITE_TTL_HOURS = 8;

export function generateInviteToken(): string {
  let token = '';
  for (let i = 0; i < INVITE_TOKEN_LENGTH; i++) {
    token += INVITE_TOKEN_ALPHABET[randomInt(INVITE_TOKEN_ALPHABET.length)];
  }
  return token;
}

export function hashInviteToken(raw: string): string {
  return createHash('sha256').update(raw, 'utf8').digest('hex');
}

export function inviteExpiresAt(now: Date, ttlHours: number): Date {
  if (ttlHours <= 0) {
    throw new RangeError('ttlHours must be greater than 0');
  }
  return new Date(now.getTime() + ttlHours * 3_600_000);
}
