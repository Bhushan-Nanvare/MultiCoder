import PostgresDB from 'sharedb-postgres';
import { config } from '@/config/index.js';
import { logger } from '@/utils/logger.js';

/**
 * Creates a sharedb-postgres database adapter using the existing DATABASE_URL.
 * pg-pool requires a config object, not a raw connection string. We also enable
 * SSL so it works with Neon (and any TLS-required Postgres host).
 */
export function createShareDbPgAdapter(): PostgresDB {
  const adapter = new PostgresDB({
    connectionString: config.databaseUrl,
    ssl: { rejectUnauthorized: false },
  });
  logger.info('ShareDB Postgres adapter initialized');
  return adapter;
}

