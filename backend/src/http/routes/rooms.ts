import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import { ROOM_VISIBILITIES, SUPPORTED_LANGUAGES } from '@/constants/index.js';
import { listProjectTemplates, PROJECT_TEMPLATE_IDS } from '@/projects/templates/index.js';
import type { RealtimeDocumentService } from '@/realtime/documentService.js';
import { withAccess } from '@/rooms/access.js';
import type { RoomService } from '@/rooms/roomService.js';
import { AppError } from '@/utils/errors.js';

const createRoomBody = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  language: z.enum(SUPPORTED_LANGUAGES).optional(),
  templateId: z.enum(PROJECT_TEMPLATE_IDS).optional(),
  visibility: z.enum(ROOM_VISIBILITIES).optional(),
});

const updateRoomBody = z.object({
  visibility: z.enum(ROOM_VISIBILITIES),
});

const roomIdParam = z.object({
  id: z.string().min(4).max(64),
});

interface BuildRoomRouterOptions {
  roomService: RoomService;
  documentService: RealtimeDocumentService;
  requireAuth: RequestHandler;
  optionalAuth: RequestHandler;
}

export function buildRoomRouter({
  roomService,
  documentService,
  requireAuth,
  optionalAuth,
}: BuildRoomRouterOptions): Router {
  const router = Router();

  router.get('/templates', requireAuth, (_req, res) => {
    res.json({ data: listProjectTemplates() });
  });

  router.post('/', requireAuth, async (req, res, next) => {
    try {
      const body = createRoomBody.parse(req.body ?? {});
      if (!req.user) throw new AppError('Missing user', 500, 'INTERNAL_ERROR');
      const room = await roomService.create({ ...body, ownerId: req.user.id });
      res.status(201).json({ data: withAccess(room, req.user.id) });
    } catch (err) {
      next(err);
    }
  });

  router.get('/', requireAuth, async (req, res, next) => {
    try {
      if (!req.user) throw new AppError('Missing user', 500, 'INTERNAL_ERROR');
      const rooms = await roomService.list({ ownerId: req.user.id });
      res.json({ data: rooms.map((room) => withAccess(room, req.user?.id ?? null)) });
    } catch (err) {
      next(err);
    }
  });

  router.patch('/:id', requireAuth, async (req, res, next) => {
    try {
      const { id } = roomIdParam.parse(req.params);
      const body = updateRoomBody.parse(req.body ?? {});
      if (!req.user) throw new AppError('Missing user', 500, 'INTERNAL_ERROR');
      const room = await roomService.updateVisibility(id, req.user.id, body.visibility);
      res.json({ data: withAccess(room, req.user.id) });
    } catch (err) {
      next(err);
    }
  });

  router.get('/:id', optionalAuth, async (req, res, next) => {
    try {
      const { id } = roomIdParam.parse(req.params);
      const userId = req.user?.id ?? null;
      const room = await roomService.getReadable(id, userId);
      await documentService.migrateLegacyIfNeeded(id);
      res.json({ data: withAccess(room, userId) });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
