import { createHash } from 'crypto';
import {
  API_KEY_LIVE_PREFIX,
  API_KEY_PREFIX_HEX_LENGTH,
  apiKeyPrefix,
  generateApiKey,
  hashApiKey,
} from './api-key';

describe('generateApiKey', () => {
  it('gera chaves com prefixo mdx_live_ e alta entropia hex', () => {
    const key = generateApiKey();
    expect(key.startsWith(API_KEY_LIVE_PREFIX)).toBe(true);
    expect(key.slice(API_KEY_LIVE_PREFIX.length)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('não colide em amostra', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const key = generateApiKey();
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });
});

describe('hashApiKey', () => {
  it('é SHA-256 hex determinístico igual a createHash', () => {
    const raw = 'mdx_live_abcdef0123456789abcdef0123456789abcdef0123456789abcdef01234567';
    const expected = createHash('sha256').update(raw, 'utf8').digest('hex');
    expect(hashApiKey(raw)).toBe(expected);
    expect(hashApiKey(raw)).toBe(hashApiKey(raw));
    expect(hashApiKey(raw)).toHaveLength(64);
    expect(hashApiKey(raw)).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('apiKeyPrefix', () => {
  it('retorna mdx_live_ + 8 hex e não o secret inteiro', () => {
    const raw = generateApiKey();
    const prefix = apiKeyPrefix(raw);
    expect(prefix).toBe(
      raw.slice(0, API_KEY_LIVE_PREFIX.length + API_KEY_PREFIX_HEX_LENGTH),
    );
    expect(prefix).toHaveLength(API_KEY_LIVE_PREFIX.length + API_KEY_PREFIX_HEX_LENGTH);
    expect(prefix).not.toBe(raw);
    expect(raw.startsWith(prefix)).toBe(true);
    expect(prefix.length).toBeLessThan(raw.length);
  });
});
