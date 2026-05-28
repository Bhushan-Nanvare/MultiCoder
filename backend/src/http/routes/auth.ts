import { Router } from 'express';
import { timingSafeEqual } from 'node:crypto';
import type { AuthService } from '@/auth/authService.js';
import {
  clearSessionCookieOptions,
  oauthStateCookieOptions,
  sessionCookieOptions,
} from '@/auth/cookies.js';
import {
  buildAuthorizeUrl,
  generateOAuthState,
} from '@/auth/githubOAuth.js';
import { config } from '@/config/index.js';
import {
  OAUTH_STATE_COOKIE_NAME,
  SESSION_COOKIE_NAME,
} from '@/constants/index.js';
import { AppError } from '@/utils/errors.js';
import { logger } from '@/utils/logger.js';

function safeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

export function buildAuthRouter(authService: AuthService): Router {
  const router = Router();

  router.get('/github', (_req, res) => {
    const state = generateOAuthState();
    res.cookie(OAUTH_STATE_COOKIE_NAME, state, oauthStateCookieOptions());
    res.redirect(buildAuthorizeUrl(state));
  });

  router.get('/github/callback', async (req, res, next) => {
    try {
      const code = typeof req.query.code === 'string' ? req.query.code : null;
      const state = typeof req.query.state === 'string' ? req.query.state : null;
      const storedState = req.cookies?.[OAUTH_STATE_COOKIE_NAME];

      if (!code || !state) {
        throw new AppError('Missing OAuth code or state', 400, 'OAUTH_INVALID_RESPONSE');
      }
      if (typeof storedState !== 'string' || !safeEqual(state, storedState)) {
        throw new AppError('OAuth state mismatch', 400, 'OAUTH_STATE_MISMATCH');
      }

      res.clearCookie(OAUTH_STATE_COOKIE_NAME, { path: '/' });

      const { user, token } = await authService.exchangeGithubCode(code);
      res.cookie(SESSION_COOKIE_NAME, token, sessionCookieOptions());
      logger.info({ userId: user.id, username: user.username }, 'User signed in via GitHub');

      res.redirect(`${config.frontendUrl}/dashboard`);
    } catch (err) {
      next(err);
    }
  });

  router.post('/logout', (_req, res) => {
    res.clearCookie(SESSION_COOKIE_NAME, clearSessionCookieOptions());
    res.status(204).end();
  });

  return router;
}
