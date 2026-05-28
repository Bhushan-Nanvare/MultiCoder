import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import type { SnapshotService } from '@/snapshots/snapshotService.js';
import { AppError } from '@/utils/errors.js';

const roomIdParam = z.object({ roomId: z.string().min(4).max(64) });
const snapshotIdParam = z.object({
  roomId: z.string().min(4).max(64),
  snapshotId: z.string().min(4).max(64),
});

interface BuildSnapshotRouterOptions {
  snapshotService: SnapshotService;
  requireAuth: RequestHandler;
  rateLimit: RequestHandler;
}

export function buildSnapshotRouter({
  snapshotService,
  requireAuth,
  rateLimit,
}: BuildSnapshotRouterOptions): Router {
  // `mergeParams` so :roomId from the parent mount comes through.
  const router = Router({ mergeParams: true });

  router.post('/', requireAuth, rateLimit, async (req, res, next) => {
    try {
      const { roomId } = roomIdParam.parse(req.params);
      if (!req.user) throw new AppError('Missing user', 500, 'INTERNAL_ERROR');
      const snapshot = await snapshotService.saveCurrent(roomId, req.user.id);
      res.status(201).json({ data: snapshot });
    } catch (err) {
      next(err);
    }
  });

  router.get('/', requireAuth, async (req, res, next) => {
    try {
      const { roomId } = roomIdParam.parse(req.params);
      const snapshots = await snapshotService.list(roomId);
      res.json({ data: snapshots });
    } catch (err) {
      next(err);
    }
  });

  router.get('/:snapshotId', requireAuth, async (req, res, next) => {
    try {
      const { roomId, snapshotId } = snapshotIdParam.parse(req.params);
      const snapshot = await snapshotService.get(roomId, snapshotId);
      res.json({ data: snapshot });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
