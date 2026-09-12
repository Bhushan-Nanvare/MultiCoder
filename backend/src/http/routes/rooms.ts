import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import { ROOM_VISIBILITIES, SUPPORTED_LANGUAGES } from '@/constants/index.js';
import { listProjectTemplates, PROJECT_TEMPLATE_IDS } from '@/projects/templates/index.js';
import type { RealtimeDocumentService } from '@/realtime/documentService.js';
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

const addMemberBody = z.object({
  username: z.string().trim().min(1).max(39),
});

const roomIdParam = z.object({
  id: z.string().min(4).max(64),
});

const memberParam = z.object({
  id: z.string().min(4).max(64),
  userId: z.string().min(1).max(64),
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
      res.status(201).json({ data: await roomService.toPublic(room, req.user.id) });
    } catch (err) {
      next(err);
    }
  });

  router.get('/', requireAuth, async (req, res, next) => {
    try {
      if (!req.user) throw new AppError('Missing user', 500, 'INTERNAL_ERROR');
      const rooms = await roomService.list({ userId: req.user.id });
      const data = await Promise.all(rooms.map((room) => roomService.toPublic(room, req.user?.id ?? null)));
      res.json({ data });
    } catch (err) {
      next(err);
    }
  });

  router.get('/:id/members', requireAuth, async (req, res, next) => {
    try {
      const { id } = roomIdParam.parse(req.params);
      if (!req.user) throw new AppError('Missing user', 500, 'INTERNAL_ERROR');
      const members = await roomService.listMembers(id, req.user.id);
      res.json({ data: members });
    } catch (err) {
      next(err);
    }
  });

  router.post('/:id/members', requireAuth, async (req, res, next) => {
    try {
      const { id } = roomIdParam.parse(req.params);
      const body = addMemberBody.parse(req.body ?? {});
      if (!req.user) throw new AppError('Missing user', 500, 'INTERNAL_ERROR');
      const member = await roomService.addMember(id, req.user.id, body.username);
      res.status(201).json({ data: member });
    } catch (err) {
      next(err);
    }
  });

  router.delete('/:id/members/:userId', requireAuth, async (req, res, next) => {
    try {
      const { id, userId } = memberParam.parse(req.params);
      if (!req.user) throw new AppError('Missing user', 500, 'INTERNAL_ERROR');
      await roomService.removeMember(id, req.user.id, userId);
      res.status(204).end();
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
      res.json({ data: await roomService.toPublic(room, req.user.id) });
    } catch (err) {
      next(err);
    }
  });

  router.delete('/:id', requireAuth, async (req, res, next) => {
    try {
      const { id } = roomIdParam.parse(req.params);
      if (!req.user) throw new AppError('Missing user', 500, 'INTERNAL_ERROR');
      await roomService.deleteRoom(id, req.user.id);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  router.get('/:id', optionalAuth, async (req, res, next) => {
    try {
      const { id } = roomIdParam.parse(req.params);
      const userId = req.user?.id ?? null;
      const room = await roomService.getReadable(id, userId);
      // Recreates an empty project if the live document was lost (e.g. a dev
      // server that ran with in-memory ShareDB storage). No-op when it exists.
      await documentService.initializeDocument(id, room.language);
      await documentService.migrateLegacyIfNeeded(id);
      res.json({ data: await roomService.toPublic(room, userId) });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
