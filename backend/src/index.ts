import { createServer } from 'node:http';
import { AiReviewService } from '@/ai/aiReviewService.js';
import { buildAiReviewProvider } from '@/ai/providerFactory.js';
import { AuthService } from '@/auth/authService.js';
import { PrismaUserRepository } from '@/auth/userRepository.js';
import { config } from '@/config/index.js';
import { disconnectPrisma, getPrismaClient } from '@/db/prismaClient.js';
import { ExecutionService } from '@/execution/executionService.js';
import { PistonClient } from '@/execution/pistonClient.js';
import { buildApp } from '@/http/app.js';
import { buildRequireAuth } from '@/http/middleware/auth.js';
import { PlagiarismService } from '@/plagiarism/plagiarismService.js';
import { PrismaSnippetRepository } from '@/plagiarism/snippetRepository.js';
import { RealtimeDocumentService } from '@/realtime/documentService.js';
import { createShareDbBackend } from '@/realtime/shareDbBackend.js';
import { attachShareDbWebSocket } from '@/realtime/wsServer.js';
import { PrismaRoomRepository } from '@/rooms/prismaRoomRepository.js';
import { RoomService } from '@/rooms/roomService.js';
import { PrismaSnapshotRepository } from '@/snapshots/snapshotRepository.js';
import { SnapshotService } from '@/snapshots/snapshotService.js';
import { logger } from '@/utils/logger.js';

async function main(): Promise<void> {
  const prisma = getPrismaClient();
  await prisma.$connect();
  logger.info('Connected to Postgres');

  const backend = createShareDbBackend();
  const documentService = new RealtimeDocumentService(backend);
  const roomRepository = new PrismaRoomRepository(prisma);
  const roomService = new RoomService(roomRepository, documentService);
  const userRepository = new PrismaUserRepository(prisma);
  const authService = new AuthService(userRepository);
  const requireAuth = buildRequireAuth(authService);

  const pistonClient = new PistonClient(config.pistonBaseUrl);
  const executionService = new ExecutionService(pistonClient);
  executionService.initialize().catch((err) => {
    logger.warn({ err }, 'Piston runtime resolution failed; will retry on first request');
  });

  const aiProvider = buildAiReviewProvider();
  const aiReviewService = new AiReviewService(aiProvider);
  logger.info({ provider: aiProvider.name, model: aiProvider.model }, 'AI review provider ready');

  const snippetRepository = new PrismaSnippetRepository(prisma);
  const plagiarismService = new PlagiarismService(snippetRepository);

  const snapshotRepository = new PrismaSnapshotRepository(prisma);
  const snapshotService = new SnapshotService(snapshotRepository, roomService, documentService);

  const app = buildApp({
    roomService,
    documentService,
    authService,
    executionService,
    aiReviewService,
    plagiarismService,
    snapshotService,
    requireAuth,
  });
  const server = createServer(app);

  attachShareDbWebSocket({ server, backend });

  server.listen(config.port, config.host, () => {
    logger.info(
      { port: config.port, host: config.host, env: config.nodeEnv },
      'MultiCoder backend listening',
    );
  });

  const shutdown = (signal: NodeJS.Signals): void => {
    logger.info({ signal }, 'Shutting down');
    server.close((err) => {
      if (err) {
        logger.error({ err }, 'Error during server close');
        process.exit(1);
      }
      backend.close(async (closeErr) => {
        if (closeErr) {
          logger.error({ err: closeErr }, 'Error closing ShareDB backend');
          process.exit(1);
        }
        try {
          await disconnectPrisma();
        } catch (disconnectErr) {
          logger.error({ err: disconnectErr }, 'Error disconnecting Prisma');
        }
        process.exit(0);
      });
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  process.on('unhandledRejection', (reason) => {
    logger.error({ reason }, 'Unhandled promise rejection');
  });
  process.on('uncaughtException', (err) => {
    logger.fatal({ err }, 'Uncaught exception');
    process.exit(1);
  });
}

main().catch((err) => {
  logger.fatal({ err }, 'Fatal startup error');
  process.exit(1);
});
