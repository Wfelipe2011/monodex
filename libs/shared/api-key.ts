import { createHash, randomBytes } from 'crypto';

export const API_KEY_LIVE_PREFIX = 'mdx_live_';
/** Hex chars from the secret portion kept in the display prefix (after `mdx_live_`). */
export const API_KEY_PREFIX_HEX_LENGTH = 8;
const API_KEY_SECRET_BYTES = 32;

export function generateApiKey(): string {
  return API_KEY_LIVE_PREFIX + randomBytes(API_KEY_SECRET_BYTES).toString('hex');
}

export function hashApiKey(raw: string): string {
  return createHash('sha256').update(raw, 'utf8').digest('hex');
}

/** Non-secret display prefix: `mdx_live_` + first 8 hex of the secret. Never the full raw key. */
export function apiKeyPrefix(raw: string): string {
  return raw.slice(0, API_KEY_LIVE_PREFIX.length + API_KEY_PREFIX_HEX_LENGTH);
}
