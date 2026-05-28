import type { RequestHandler } from 'express';
import type { AuthService } from '@/auth/authService.js';
import { verifySessionToken } from '@/auth/jwt.js';
import { SESSION_COOKIE_NAME } from '@/constants/index.js';
import { AppError } from '@/utils/errors.js';

/**
 * Reads the session cookie, verifies the JWT, hydrates the user from the
 * database, and attaches it to req.user. If anything is missing or invalid
 * a 401 is raised; downstream handlers can rely on req.user being set.
 */
export function buildRequireAuth(authService: AuthService): RequestHandler {
  return async (req, _res, next) => {
    try {
      const token = req.cookies?.[SESSION_COOKIE_NAME];
      if (typeof token !== 'string' || token.length === 0) {
        throw new AppError('Not authenticated', 401, 'UNAUTHENTICATED');
      }
      const payload = verifySessionToken(token);
      const user = await authService.getUserById(payload.sub);
      if (!user) {
        throw new AppError('Session user no longer exists', 401, 'UNAUTHENTICATED');
      }
      req.user = user;
      next();
    } catch (err) {
      if (err instanceof AppError) {
        next(err);
        return;
      }
      next(new AppError('Invalid session', 401, 'UNAUTHENTICATED'));
    }
  };
}
