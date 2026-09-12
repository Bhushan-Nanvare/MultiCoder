import PostgresDB from 'sharedb-postgres';
import { config } from '@/config/index.js';
import { logger } from '@/utils/logger.js';

const LOCAL_DATABASE_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

/**
 * Neon and most hosted Postgres require TLS, but the docker-compose Postgres
 * doesn't support it at all. Honour an explicit `sslmode=disable`, and skip TLS
 * for localhost URLs that don't ask for it.
 */
function sslOptionFor(databaseUrl: string): false | { rejectUnauthorized: false } {
  const url = new URL(databaseUrl);
  const sslmode = url.searchParams.get('sslmode');
  if (sslmode === 'disable') return false;
  if (!sslmode && LOCAL_DATABASE_HOSTS.has(url.hostname)) return false;
  return { rejectUnauthorized: false };
}

/**
 * Creates a sharedb-postgres database adapter using the existing DATABASE_URL.
 * pg-pool requires a config object, not a raw connection string.
 */
export function createShareDbPgAdapter(): PostgresDB {
  const ssl = sslOptionFor(config.databaseUrl);
  const adapter = new PostgresDB({ connectionString: config.databaseUrl, ssl });
  logger.info({ ssl: ssl !== false }, 'ShareDB Postgres adapter initialized');
  return adapter;
}
