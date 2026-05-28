import type { RequestHandler } from 'express';
import { AppError } from '@/utils/errors.js';

interface RateLimitOptions {
  /** Maximum number of requests allowed in the window. */
  max: number;
  /** Window length in milliseconds. */
  windowMs: number;
  /**
   * Derives the bucket key from the request. Defaults to authenticated user
   * id; throws if no `req.user` is set, so this middleware must be mounted
   * after `requireAuth`.
   */
  keyFn?: (req: Parameters<RequestHandler>[0]) => string;
}

interface Bucket {
  count: number;
  resetAt: number;
}

/**
 * Minimal in-memory fixed-window rate limiter. Sufficient for single-instance
 * dev/portfolio deployments. For multi-instance production, swap the Map for
 * Redis-backed storage without changing call sites.
 */
export function buildRateLimit(options: RateLimitOptions): RequestHandler {
  const buckets = new Map<string, Bucket>();
  const keyFn =
    options.keyFn ??
    ((req) => {
      if (!req.user) {
        throw new AppError('Rate limit requires authenticated user', 500, 'INTERNAL_ERROR');
      }
      return req.user.id;
    });

  return (req, res, next) => {
    try {
      const key = keyFn(req);
      const now = Date.now();
      const existing = buckets.get(key);

      if (!existing || existing.resetAt <= now) {
        buckets.set(key, { count: 1, resetAt: now + options.windowMs });
        res.setHeader('X-RateLimit-Limit', String(options.max));
        res.setHeader('X-RateLimit-Remaining', String(options.max - 1));
        next();
        return;
      }

      if (existing.count >= options.max) {
        const retryAfterSec = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
        res.setHeader('Retry-After', String(retryAfterSec));
        res.setHeader('X-RateLimit-Limit', String(options.max));
        res.setHeader('X-RateLimit-Remaining', '0');
        next(
          new AppError(
            `Rate limit exceeded — try again in ${retryAfterSec}s`,
            429,
            'RATE_LIMITED',
            { retryAfterSec },
          ),
        );
        return;
      }

      existing.count += 1;
      res.setHeader('X-RateLimit-Limit', String(options.max));
      res.setHeader('X-RateLimit-Remaining', String(options.max - existing.count));
      next();
    } catch (err) {
      next(err);
    }
  };
}
