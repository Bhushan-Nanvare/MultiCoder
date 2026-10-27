import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';

// config validates the whole environment on import, so the test supplies one.
// dotenv does not override values that are already set.
process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/multicoder';
process.env.JWT_SECRET = 'a'.repeat(32);
process.env.GITHUB_CLIENT_ID = 'client-id';
process.env.GITHUB_CLIENT_SECRET = 'client-secret';
process.env.GEMINI_API_KEY = 'gemini-key';
process.env.TOKEN_ENCRYPTION_KEY = randomBytes(32).toString('base64');

const { decryptSecret, encryptSecret, safeEqual } = await import('@/utils/secrets.js');

describe('token encryption', () => {
  it('round-trips a token', () => {
    const token = 'gho_averyrealisticlookinggithubtoken';
    expect(decryptSecret(encryptSecret(token))).toBe(token);
  });

  it('produces different ciphertext each time', () => {
    expect(encryptSecret('same')).not.toBe(encryptSecret('same'));
  });

  it('rejects tampered ciphertext', () => {
    const [iv, tag, ciphertext] = encryptSecret('secret').split('.');
    const flipped = Buffer.from(ciphertext!, 'base64');
    flipped[0] ^= 0xff;
    expect(() => decryptSecret([iv, tag, flipped.toString('base64')].join('.'))).toThrow();
  });

  it('rejects a malformed payload', () => {
    expect(() => decryptSecret('nonsense')).toThrow(/malformed/);
  });
});

describe('safeEqual', () => {
  it('matches identical strings and rejects others', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'abcd')).toBe(false);
  });
});
