import ShareDB from 'sharedb';
import { config } from '@/config/index.js';
import { logger } from '@/utils/logger.js';

/**
 * Creates a ShareDB backend. Uses the Postgres adapter by default (always in
 * production) so documents survive server restarts. SHAREDB_STORAGE=memory
 * opts into a throwaway in-memory store for local experiments.
 */
export async function createShareDbBackend(): Promise<ShareDB> {
  const usePostgres = config.sharedbStorage === 'postgres' || config.isProduction;

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

  logger.warn('ShareDB backend: in-memory — room contents are lost on every restart');
  return new ShareDB({
    presence: true,
    doNotForwardSendPresenceErrorsToClient: true,
  });
}
