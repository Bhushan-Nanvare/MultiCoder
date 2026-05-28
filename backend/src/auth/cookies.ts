import type { CookieOptions } from 'express';
import { config } from '@/config/index.js';
import {
  OAUTH_STATE_TTL_MS,
  SESSION_COOKIE_MAX_AGE_MS,
} from '@/constants/index.js';

/**
 * In production the frontend (Vercel) and backend (Render/Fly) live on
 * different origins, so we need sameSite='none' + secure for the browser to
 * send the session cookie on cross-origin fetches and WS upgrades. In dev
 * everything is on localhost ports — 'lax' avoids the secure requirement
 * (no HTTPS locally).
 */
const sameSite: CookieOptions['sameSite'] = config.isProduction ? 'none' : 'lax';

export function sessionCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: config.isProduction,
    sameSite,
    path: '/',
    maxAge: SESSION_COOKIE_MAX_AGE_MS,
  };
}

export function clearSessionCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: config.isProduction,
    sameSite,
    path: '/',
    maxAge: 0,
  };
}

export function oauthStateCookieOptions(): CookieOptions {
  // OAuth state cookie crosses sites (github.com redirect carries the
  // browser back to us) — same sameSite rules apply.
  return {
    httpOnly: true,
    secure: config.isProduction,
    sameSite,
    path: '/',
    maxAge: OAUTH_STATE_TTL_MS,
  };
}
