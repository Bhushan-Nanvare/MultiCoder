import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import { oauthStateCookieOptions } from '@/auth/cookies.js';
import { buildConnectUrl, generateOAuthState } from '@/auth/githubOAuth.js';
import { config } from '@/config/index.js';
import {
  GITHUB_RETURN_COOKIE_NAME,
  GITHUB_STATE_COOKIE_NAME,
} from '@/constants/index.js';
import type { GithubService } from '@/github/githubService.js';
import { AppError } from '@/utils/errors.js';
import { safeEqual } from '@/utils/secrets.js';

const importBody = z.object({
  roomId: z.string().min(4).max(64),
  fullName: z
    .string()
    .min(3)
    .max(140)
    .regex(/^[\w.-]+\/[\w.-]+$/, 'Expected owner/repository'),
  branch: z.string().min(1).max(255).optional(),
});

const connectQuery = z.object({
  returnTo: z
    .string()
    .max(512)
    .refine((value) => value.startsWith('/') && !value.startsWith('//'), {
      message: 'returnTo must be a relative path',
    })
    .optional(),
});

interface BuildGithubRouterOptions {
  githubService: GithubService;
  requireAuth: RequestHandler;
  rateLimit: RequestHandler;
}

export function buildGithubRouter({
  githubService,
  requireAuth,
  rateLimit,
}: BuildGithubRouterOptions): Router {
  const router = Router();

  router.get('/status', requireAuth, async (req, res, next) => {
    try {
      if (!req.user) throw new AppError('Missing user', 500, 'INTERNAL_ERROR');
      res.json({ data: await githubService.connectionFor(req.user.id) });
    } catch (err) {
      next(err);
    }
  });

  router.get('/connect', requireAuth, (req, res, next) => {
    try {
      githubService.assertEnabled();
      const { returnTo } = connectQuery.parse(req.query);
      const state = generateOAuthState();
      res.cookie(GITHUB_STATE_COOKIE_NAME, state, oauthStateCookieOptions());
      res.cookie(GITHUB_RETURN_COOKIE_NAME, returnTo ?? '/dashboard', oauthStateCookieOptions());
      res.redirect(buildConnectUrl(state));
    } catch (err) {
      next(err);
    }
  });

  router.delete('/connection', requireAuth, async (req, res, next) => {
    try {
      if (!req.user) throw new AppError('Missing user', 500, 'INTERNAL_ERROR');
      await githubService.disconnect(req.user.id);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  router.get('/repos', requireAuth, rateLimit, async (req, res, next) => {
    try {
      if (!req.user) throw new AppError('Missing user', 500, 'INTERNAL_ERROR');
      res.json({ data: await githubService.listRepositories(req.user.id) });
    } catch (err) {
      next(err);
    }
  });

  router.post('/import', requireAuth, rateLimit, async (req, res, next) => {
    try {
      const body = importBody.parse(req.body ?? {});
      if (!req.user) throw new AppError('Missing user', 500, 'INTERNAL_ERROR');
      const result = await githubService.importRepository(
        req.user.id,
        body.roomId,
        body.fullName,
        body.branch,
      );
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

interface BuildCallbackOptions {
  githubService: GithubService;
  optionalAuth: RequestHandler;
}

export function buildGithubConnectCallbackRouter({
  githubService,
  optionalAuth,
}: BuildCallbackOptions): Router {
  const router = Router();

  router.get('/', optionalAuth, async (req, res, next) => {
    try {
      const code = typeof req.query.code === 'string' ? req.query.code : null;
      const state = typeof req.query.state === 'string' ? req.query.state : null;
      const storedState = req.cookies?.[GITHUB_STATE_COOKIE_NAME];
      const returnTo = req.cookies?.[GITHUB_RETURN_COOKIE_NAME];

      if (!code || !state) {
        throw new AppError('Missing OAuth code or state', 400, 'OAUTH_INVALID_RESPONSE');
      }
      if (typeof storedState !== 'string' || !safeEqual(state, storedState)) {
        throw new AppError('OAuth state mismatch', 400, 'OAUTH_STATE_MISMATCH');
      }
      if (!req.user) {
        throw new AppError('Sign in before connecting GitHub', 401, 'UNAUTHENTICATED');
      }

      res.clearCookie(GITHUB_STATE_COOKIE_NAME, { path: '/' });
      res.clearCookie(GITHUB_RETURN_COOKIE_NAME, { path: '/' });
      await githubService.saveConnection(req.user.id, code);

      const path = typeof returnTo === 'string' && returnTo.startsWith('/') && !returnTo.startsWith('//')
        ? returnTo
        : '/dashboard';
      res.redirect(`${config.frontendUrl}${path}`);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
