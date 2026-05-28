import { Router, type RequestHandler, type Response } from 'express';
import { z } from 'zod';
import type { AiReviewService } from '@/ai/aiReviewService.js';
import type { ReviewStreamEvent } from '@/ai/types.js';
import { AI_REVIEW_MAX_CODE_BYTES, SUPPORTED_LANGUAGES } from '@/constants/index.js';
import { AppError } from '@/utils/errors.js';
import { logger } from '@/utils/logger.js';

const reviewBody = z.object({
  language: z.enum(SUPPORTED_LANGUAGES),
  code: z.string().min(1).max(AI_REVIEW_MAX_CODE_BYTES * 4),
});

interface BuildReviewRouterOptions {
  aiReviewService: AiReviewService;
  requireAuth: RequestHandler;
  rateLimit: RequestHandler;
}

function writeSseEvent(res: Response, event: ReviewStreamEvent): void {
  res.write(`event: ${event.type}\n`);
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

export function buildReviewRouter({
  aiReviewService,
  requireAuth,
  rateLimit,
}: BuildReviewRouterOptions): Router {
  const router = Router();

  router.post('/', requireAuth, rateLimit, async (req, res, next) => {
    try {
      const body = reviewBody.parse(req.body ?? {});
      const result = await aiReviewService.review(body);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  });

  router.post('/stream', requireAuth, rateLimit, async (req, res, next) => {
    let body: z.infer<typeof reviewBody>;
    try {
      body = reviewBody.parse(req.body ?? {});
    } catch (err) {
      next(err);
      return;
    }

    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    const heartbeat = setInterval(() => {
      res.write(': keepalive\n\n');
    }, 15_000);

    let clientDisconnected = false;
    req.on('close', () => {
      clientDisconnected = true;
    });

    try {
      for await (const event of aiReviewService.reviewStream(body)) {
        if (clientDisconnected) break;
        writeSseEvent(res, event);
      }
    } catch (err) {
      if (!clientDisconnected) {
        const appErr =
          err instanceof AppError
            ? err
            : new AppError((err as Error).message, 500, 'INTERNAL_ERROR');
        writeSseEvent(res, {
          type: 'error',
          message: appErr.message,
          code: appErr.code,
        });
      }
      logger.error({ err }, 'AI review stream errored');
    } finally {
      clearInterval(heartbeat);
      res.end();
    }
  });

  return router;
}
