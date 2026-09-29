import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import type { PlagiarismService } from '@/plagiarism/plagiarismService.js';
import { projectToComparableCode } from '@/plagiarism/projectCode.js';
import type { RealtimeDocumentService } from '@/realtime/documentService.js';
import type { RoomService } from '@/rooms/roomService.js';
import { AppError } from '@/utils/errors.js';

// The code is read from the room's live document, never taken from the client,
// so a score always reflects what is actually in the room.
const checkBody = z.object({
  roomId: z.string().min(4).max(64),
});

interface BuildPlagiarismRouterOptions {
  plagiarismService: PlagiarismService;
  roomService: RoomService;
  documentService: RealtimeDocumentService;
  requireAuth: RequestHandler;
  rateLimit: RequestHandler;
}

export function buildPlagiarismRouter({
  plagiarismService,
  roomService,
  documentService,
  requireAuth,
  rateLimit,
}: BuildPlagiarismRouterOptions): Router {
  const router = Router();

  router.post('/', requireAuth, rateLimit, async (req, res, next) => {
    try {
      const { roomId } = checkBody.parse(req.body ?? {});
      if (!req.user) throw new AppError('Missing user', 500, 'INTERNAL_ERROR');
      const room = await roomService.requirePlagiarismAccess(roomId, req.user.id);
      const project = await documentService.readDocument(roomId);
      const result = await plagiarismService.check({
        roomId,
        language: room.language,
        code: projectToComparableCode(project),
        ownerId: req.user.id,
      });
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
