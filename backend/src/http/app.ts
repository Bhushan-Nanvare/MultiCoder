import cookieParser from 'cookie-parser';
import express, { type Express, type RequestHandler } from 'express';
import { pinoHttp } from 'pino-http';
import type { AiReviewService } from '@/ai/aiReviewService.js';
import type { AuthService } from '@/auth/authService.js';
import {
  AI_REVIEW_RATE_LIMIT_MAX,
  AI_REVIEW_RATE_LIMIT_WINDOW_MS,
  EXECUTION_RATE_LIMIT_MAX,
  EXECUTION_RATE_LIMIT_WINDOW_MS,
  HTTP_BODY_LIMIT,
  PLAGIARISM_RATE_LIMIT_MAX,
  PLAGIARISM_RATE_LIMIT_WINDOW_MS,
  SNAPSHOT_RATE_LIMIT_MAX,
  SNAPSHOT_RATE_LIMIT_WINDOW_MS,
} from '@/constants/index.js';
import type { ExecutionService } from '@/execution/executionService.js';
import { buildAuthRouter } from '@/http/routes/auth.js';
import { buildExecuteRouter } from '@/http/routes/execute.js';
import { buildPlagiarismRouter } from '@/http/routes/plagiarism.js';
import { buildReviewRouter } from '@/http/routes/review.js';
import { buildRoomRouter } from '@/http/routes/rooms.js';
import { buildSnapshotRouter } from '@/http/routes/snapshots.js';
import { buildUserRouter } from '@/http/routes/user.js';
import { errorHandler, notFoundHandler } from '@/http/middleware/errorHandler.js';
import { buildRateLimit } from '@/http/middleware/rateLimit.js';
import { buildCorsMiddleware, buildHelmetMiddleware } from '@/http/middleware/security.js';
import type { PlagiarismService } from '@/plagiarism/plagiarismService.js';
import type { RealtimeDocumentService } from '@/realtime/documentService.js';
import type { RoomService } from '@/rooms/roomService.js';
import type { SnapshotService } from '@/snapshots/snapshotService.js';
import { logger } from '@/utils/logger.js';

interface BuildAppOptions {
  roomService: RoomService;
  documentService: RealtimeDocumentService;
  authService: AuthService;
  executionService: ExecutionService;
  aiReviewService: AiReviewService;
  plagiarismService: PlagiarismService;
  snapshotService: SnapshotService;
  requireAuth: RequestHandler;
}

export function buildApp({
  roomService,
  documentService,
  authService,
  executionService,
  aiReviewService,
  plagiarismService,
  snapshotService,
  requireAuth,
}: BuildAppOptions): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(buildHelmetMiddleware());
  app.use(buildCorsMiddleware());
  app.use(cookieParser());
  app.use(express.json({ limit: HTTP_BODY_LIMIT }));
  app.use(pinoHttp({ logger }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  const executeRateLimit = buildRateLimit({
    max: EXECUTION_RATE_LIMIT_MAX,
    windowMs: EXECUTION_RATE_LIMIT_WINDOW_MS,
  });
  const reviewRateLimit = buildRateLimit({
    max: AI_REVIEW_RATE_LIMIT_MAX,
    windowMs: AI_REVIEW_RATE_LIMIT_WINDOW_MS,
  });
  const plagiarismRateLimit = buildRateLimit({
    max: PLAGIARISM_RATE_LIMIT_MAX,
    windowMs: PLAGIARISM_RATE_LIMIT_WINDOW_MS,
  });
  const snapshotRateLimit = buildRateLimit({
    max: SNAPSHOT_RATE_LIMIT_MAX,
    windowMs: SNAPSHOT_RATE_LIMIT_WINDOW_MS,
  });

  app.use('/auth', buildAuthRouter(authService));
  app.use('/api/user', buildUserRouter(requireAuth));
  app.use('/api/rooms', buildRoomRouter({ roomService, documentService, requireAuth }));
  app.use(
    '/api/rooms/:roomId/snapshots',
    buildSnapshotRouter({
      snapshotService,
      requireAuth,
      rateLimit: snapshotRateLimit,
    }),
  );
  app.use(
    '/api/execute',
    buildExecuteRouter({ executionService, requireAuth, rateLimit: executeRateLimit }),
  );
  app.use(
    '/api/review',
    buildReviewRouter({ aiReviewService, requireAuth, rateLimit: reviewRateLimit }),
  );
  app.use(
    '/api/check-plagiarism',
    buildPlagiarismRouter({
      plagiarismService,
      requireAuth,
      rateLimit: plagiarismRateLimit,
    }),
  );

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
