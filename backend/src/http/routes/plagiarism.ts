import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import {
  PLAGIARISM_MAX_CODE_BYTES,
  SUPPORTED_LANGUAGES,
} from '@/constants/index.js';
import type { PlagiarismService } from '@/plagiarism/plagiarismService.js';
import { AppError } from '@/utils/errors.js';

const checkBody = z.object({
  language: z.enum(SUPPORTED_LANGUAGES),
  code: z.string().min(1).max(PLAGIARISM_MAX_CODE_BYTES * 4),
  store: z.boolean().optional().default(true),
});

interface BuildPlagiarismRouterOptions {
  plagiarismService: PlagiarismService;
  requireAuth: RequestHandler;
  rateLimit: RequestHandler;
}

export function buildPlagiarismRouter({
  plagiarismService,
  requireAuth,
  rateLimit,
}: BuildPlagiarismRouterOptions): Router {
  const router = Router();

  router.post('/', requireAuth, rateLimit, async (req, res, next) => {
    try {
      const body = checkBody.parse(req.body ?? {});
      if (!req.user) throw new AppError('Missing user', 500, 'INTERNAL_ERROR');
      const result = await plagiarismService.check({
        language: body.language,
        code: body.code,
        store: body.store,
        ownerId: req.user.id,
      });
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
