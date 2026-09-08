import ShareDB from 'sharedb';
import { config } from '@/config/index.js';
import { logger } from '@/utils/logger.js';

/**
 * Creates a ShareDB backend. Uses the Postgres adapter in production (or when
 * SHAREDB_STORAGE=postgres) so documents survive server restarts. Falls back
 * to the in-memory MemoryDB adapter for local development.
 */
export async function createShareDbBackend(): Promise<ShareDB> {
  const usePostgres =
    process.env.SHAREDB_STORAGE === 'postgres' || config.isProduction;

  if (usePostgres) {
    // Dynamic ESM import — safe in both local dev and production.
    const { createShareDbPgAdapter } = await import('@/realtime/shareDbPgAdapter.js');
    const db = createShareDbPgAdapter();
    logger.info('ShareDB backend: Postgres');
    return new ShareDB({
      db,
      presence: true,
      doNotForwardSendPresenceErrorsToClient: true,
    });
  }

  logger.info('ShareDB backend: in-memory (dev)');
  return new ShareDB({
    presence: true,
    doNotForwardSendPresenceErrorsToClient: true,
  });
}
