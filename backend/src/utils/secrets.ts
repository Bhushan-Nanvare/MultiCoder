import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from 'node:crypto';
import { config } from '@/config/index.js';
import { AppError } from '@/utils/errors.js';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;

function encryptionKey(): Buffer {
  if (!config.tokenEncryptionKey) {
    throw new AppError(
      'TOKEN_ENCRYPTION_KEY is not configured',
      503,
      'INTEGRATION_NOT_CONFIGURED',
    );
  }
  return Buffer.from(config.tokenEncryptionKey, 'base64');
}

export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), ciphertext].map((part) => part.toString('base64')).join('.');
}

export function decryptSecret(payload: string): string {
  const [iv, tag, ciphertext] = payload.split('.').map((part) => Buffer.from(part, 'base64'));
  if (!iv || !tag || !ciphertext) {
    throw new AppError('Stored secret is malformed', 500, 'INTERNAL_ERROR');
  }
  const decipher = createDecipheriv(ALGORITHM, encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}
