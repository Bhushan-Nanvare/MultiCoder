import { Router } from 'express';
import type { RequestHandler } from 'express';
import { AppError } from '@/utils/errors.js';

export function buildUserRouter(requireAuth: RequestHandler): Router {
  const router = Router();

  router.get('/me', requireAuth, (req, res) => {
    if (!req.user) {
      throw new AppError('User missing from request', 500, 'INTERNAL_ERROR');
    }
    res.json({ data: req.user });
  });

  return router;
}
