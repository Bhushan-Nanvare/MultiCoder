import ShareDB from 'sharedb';
import { config } from '@/config/index.js';
import { logger } from '@/utils/logger.js';

/**
 * Creates a ShareDB backend. Uses the Postgres adapter in production (or when
 * SHAREDB_STORAGE=postgres) so documents survive server restarts. Falls back
 * to the in-memory MemoryDB adapter for local development.
 */
export function createShareDbBackend(): ShareDB {
  const usePostgres =
    process.env.SHAREDB_STORAGE === 'postgres' || config.isProduction;

  if (usePostgres) {
    // Dynamic import keeps the Postgres driver out of the bundle when unused.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { createShareDbPgAdapter } = require('@/realtime/shareDbPgAdapter.js') as typeof import('@/realtime/shareDbPgAdapter.js');
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
