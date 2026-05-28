import { PrismaClient } from '@prisma/client';
import { config } from '@/config/index.js';

let cached: PrismaClient | null = null;

/**
 * Returns a process-wide PrismaClient. Lazy so importing this module doesn't
 * eagerly establish a database connection (helps tests + dev startup).
 */
export function getPrismaClient(): PrismaClient {
  if (cached) return cached;
  cached = new PrismaClient({
    log: config.isDevelopment ? ['warn', 'error'] : ['error'],
  });
  return cached;
}

export async function disconnectPrisma(): Promise<void> {
  if (!cached) return;
  await cached.$disconnect();
  cached = null;
}
