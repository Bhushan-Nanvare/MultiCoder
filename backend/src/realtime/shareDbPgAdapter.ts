import PostgresDB from 'sharedb-postgres';
import { config } from '@/config/index.js';
import { logger } from '@/utils/logger.js';

/**
 * Creates a sharedb-postgres database adapter using the existing DATABASE_URL.
 * sharedb-postgres internally creates a `pg.Pool`, so we parse the connection
 * string into the format it expects.
 */
export function createShareDbPgAdapter(): PostgresDB {
  const adapter = new PostgresDB(config.databaseUrl);
  logger.info('ShareDB Postgres adapter initialized');
  return adapter;
}
