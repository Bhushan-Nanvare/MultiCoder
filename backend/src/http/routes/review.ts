import { Router, type RequestHandler, type Response } from 'express';
import { z } from 'zod';
import type { AiReviewService } from '@/ai/aiReviewService.js';
import type { ReviewStreamEvent } from '@/ai/types.js';
import { AI_REVIEW_MAX_CODE_BYTES, SUPPORTED_LANGUAGES } from '@/constants/index.js';
import type { RoomService } from '@/rooms/roomService.js';
import { AppError } from '@/utils/errors.js';
import { logger } from '@/utils/logger.js';

// `roomId` decides who may ask: in an assessment room only the owner can, so a
// candidate cannot get AI help on the work being judged.
const reviewBody = z.object({
  roomId: z.string().min(4).max(64),
  language: z.enum(SUPPORTED_LANGUAGES),
  code: z.string().min(1).max(AI_REVIEW_MAX_CODE_BYTES * 4),
});

interface BuildReviewRouterOptions {
  aiReviewService: AiReviewService;
  roomService: RoomService;
  requireAuth: RequestHandler;
  rateLimit: RequestHandler;
}

function writeSseEvent(res: Response, event: ReviewStreamEvent): void {
  res.write(`event: ${event.type}\n`);
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

export function buildReviewRouter({
  aiReviewService,
  roomService,
  requireAuth,
  rateLimit,
}: BuildReviewRouterOptions): Router {
  const router = Router();

  router.post('/', requireAuth, rateLimit, async (req, res, next) => {
    try {
      const body = reviewBody.parse(req.body ?? {});
      if (!req.user) throw new AppError('Missing user', 500, 'INTERNAL_ERROR');
      await roomService.requireAiReviewAccess(body.roomId, req.user.id);
      const result = await aiReviewService.review(body);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  });

  router.post('/stream', requireAuth, rateLimit, async (req, res, next) => {
    // Both the body check and the access check run before any SSE headers, so
    // a rejection is still a normal JSON error response.
    let body: z.infer<typeof reviewBody>;
    try {
      body = reviewBody.parse(req.body ?? {});
      if (!req.user) throw new AppError('Missing user', 500, 'INTERNAL_ERROR');
      await roomService.requireAiReviewAccess(body.roomId, req.user.id);
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
