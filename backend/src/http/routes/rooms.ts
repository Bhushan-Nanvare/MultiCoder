import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import { SUPPORTED_LANGUAGES } from '@/constants/index.js';
import type { RoomService } from '@/rooms/roomService.js';
import { AppError } from '@/utils/errors.js';

const createRoomBody = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  language: z.enum(SUPPORTED_LANGUAGES).optional(),
});

const roomIdParam = z.object({
  id: z.string().min(4).max(64),
});

interface BuildRoomRouterOptions {
  roomService: RoomService;
  requireAuth: RequestHandler;
}

export function buildRoomRouter({ roomService, requireAuth }: BuildRoomRouterOptions): Router {
  const router = Router();

  router.post('/', requireAuth, async (req, res, next) => {
    try {
      const body = createRoomBody.parse(req.body ?? {});
      if (!req.user) throw new AppError('Missing user', 500, 'INTERNAL_ERROR');
      const room = await roomService.create({ ...body, ownerId: req.user.id });
      res.status(201).json({ data: room });
    } catch (err) {
      next(err);
    }
  });

  router.get('/', requireAuth, async (req, res, next) => {
    try {
      if (!req.user) throw new AppError('Missing user', 500, 'INTERNAL_ERROR');
      const rooms = await roomService.list({ ownerId: req.user.id });
      res.json({ data: rooms });
    } catch (err) {
      next(err);
    }
  });

  router.get('/:id', async (req, res, next) => {
    try {
      const { id } = roomIdParam.parse(req.params);
      const room = await roomService.get(id);
      res.json({ data: room });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
