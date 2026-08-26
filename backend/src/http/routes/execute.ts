import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import {
  EXECUTION_MAX_CODE_BYTES,
  EXECUTION_MAX_STDIN_BYTES,
  MAX_FILE_BYTES,
  MAX_FILES_PER_ROOM,
  MAX_PROJECT_PATH_LENGTH,
  SUPPORTED_LANGUAGES,
} from '@/constants/index.js';
import type { ExecutionService } from '@/execution/executionService.js';

const stdinSchema = z.string().max(EXECUTION_MAX_STDIN_BYTES * 4).optional();

const singleFileBody = z.object({
  language: z.enum(SUPPORTED_LANGUAGES),
  code: z.string().min(1).max(EXECUTION_MAX_CODE_BYTES * 4),
  stdin: stdinSchema,
});

const projectFileBody = z.object({
  path: z.string().min(1).max(MAX_PROJECT_PATH_LENGTH),
  content: z.string().max(MAX_FILE_BYTES * 4),
});

const projectBody = z.object({
  language: z.enum(SUPPORTED_LANGUAGES),
  entryPoint: z.string().min(1).max(MAX_PROJECT_PATH_LENGTH),
  files: z.array(projectFileBody).min(1).max(MAX_FILES_PER_ROOM),
  stdin: stdinSchema,
});

const executeBody = z.union([projectBody, singleFileBody]);

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
      if ('files' in body) {
        const result = await executionService.executeProject({
          language: body.language,
          entryPoint: body.entryPoint,
          files: body.files,
          stdin: body.stdin,
        });
        res.json({ data: result });
        return;
      }

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
