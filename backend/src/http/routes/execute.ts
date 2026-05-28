import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import {
  EXECUTION_MAX_CODE_BYTES,
  EXECUTION_MAX_STDIN_BYTES,
  SUPPORTED_LANGUAGES,
} from '@/constants/index.js';
import type { ExecutionService } from '@/execution/executionService.js';

const executeBody = z.object({
  language: z.enum(SUPPORTED_LANGUAGES),
  code: z.string().min(1).max(EXECUTION_MAX_CODE_BYTES * 4),
  stdin: z.string().max(EXECUTION_MAX_STDIN_BYTES * 4).optional(),
});

interface BuildExecuteRouterOptions {
  executionService: ExecutionService;
  requireAuth: RequestHandler;
  rateLimit: RequestHandler;
}

export function buildExecuteRouter({
  executionService,
  requireAuth,
  rateLimit,
}: BuildExecuteRouterOptions): Router {
  const router = Router();

  router.post('/', requireAuth, rateLimit, async (req, res, next) => {
    try {
      const body = executeBody.parse(req.body ?? {});
      const result = await executionService.execute({
        language: body.language,
        code: body.code,
        stdin: body.stdin,
      });
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
