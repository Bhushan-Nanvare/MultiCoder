import jwt, { type SignOptions } from 'jsonwebtoken';
import { config } from '@/config/index.js';
import type { JwtPayload } from '@/auth/types.js';

const ISSUER = 'multicoder';

export function signSessionToken(payload: JwtPayload): string {
  const options: SignOptions = {
    issuer: ISSUER,
    expiresIn: config.jwtExpiresIn as SignOptions['expiresIn'],
    algorithm: 'HS256',
  };
  return jwt.sign(payload, config.jwtSecret, options);
}

export function verifySessionToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, config.jwtSecret, {
    issuer: ISSUER,
    algorithms: ['HS256'],
  });
  if (typeof decoded !== 'object' || decoded === null) {
    throw new Error('Invalid JWT payload shape');
  }
  const sub = (decoded as Record<string, unknown>).sub;
  const username = (decoded as Record<string, unknown>).username;
  if (typeof sub !== 'string' || typeof username !== 'string') {
    throw new Error('JWT payload missing sub or username');
  }
  return { sub, username };
}
