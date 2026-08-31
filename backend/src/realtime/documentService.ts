import type ShareDB from 'sharedb';
import { SHAREDB_COLLECTION, type SupportedLanguage } from '@/constants/index.js';
import {
  buildLegacyMigrationOps,
  createEmptyProjectDocument,
  isLegacyRoomDocument,
  normalizeDocument,
  validateProjectDocument,
} from '@/realtime/documentHelpers.js';
import type { ProjectDocument } from '@/realtime/types.js';
import { NotFoundError } from '@/utils/errors.js';
import { logger } from '@/utils/logger.js';

function fetchDoc(doc: ReturnType<ShareDB.Connection['get']>): Promise<void> {
  return new Promise((resolve, reject) => {
    doc.fetch((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

export class RealtimeDocumentService {
  constructor(private readonly backend: ShareDB) {}

  /**
   * Creates the ShareDB document for a room if it doesn't already exist.
   * Idempotent — safe to call multiple times for the same room id.
   */
  async initializeDocument(
    roomId: string,
    language: SupportedLanguage,
    initial?: ProjectDocument,
  ): Promise<void> {
    const connection = this.backend.connect();
    const doc = connection.get(SHAREDB_COLLECTION, roomId);

    try {
      await fetchDoc(doc);
      if (doc.type) return;

      const payload = initial ?? createEmptyProjectDocument(language);
      validateProjectDocument(payload);
      await new Promise<void>((resolve, reject) => {
        doc.create(payload, (createErr) => {
          if (createErr) reject(createErr);
          else resolve();
        });
      });
    } finally {
      connection.close();
    }
  }

  /**
   * Upgrades a legacy v1 document to ProjectDocument v2 in ShareDB. No-op if
   * already v2. Called before reads and when a room page is opened.
   */
  async migrateLegacyIfNeeded(roomId: string): Promise<void> {
    const connection = this.backend.connect();
    const doc = connection.get(SHAREDB_COLLECTION, roomId);

    try {
      await fetchDoc(doc);
      if (!doc.type || doc.data === undefined) return;
      if (!isLegacyRoomDocument(doc.data)) return;

      const legacy = doc.data;
      const ops = buildLegacyMigrationOps(legacy);
      await new Promise<void>((resolve, reject) => {
        doc.submitOp(ops, { source: 'migration' }, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      logger.info({ roomId }, 'Migrated legacy room document to ProjectDocument v2');
    } finally {
      connection.close();
    }
  }

  /**
   * Reads the live ShareDB document for a room. Throws NotFoundError if the
   * room has no initialized document. Legacy documents are migrated first.
   */
  async readDocument(roomId: string): Promise<ProjectDocument> {
    await this.migrateLegacyIfNeeded(roomId);

    const connection = this.backend.connect();
    const doc = connection.get(SHAREDB_COLLECTION, roomId);

    try {
      const data = await new Promise<ProjectDocument>((resolve, reject) => {
        doc.fetch((err) => {
          if (err) {
            reject(err);
            return;
          }
          if (!doc.type || doc.data === undefined) {
            reject(new NotFoundError(`Room ${roomId} has no document`));
            return;
          }
          try {
            resolve(normalizeDocument(doc.data));
          } catch (normalizeErr) {
            reject(normalizeErr);
          }
        });
      });
      return data;
    } finally {
      connection.close();
    }
  }

  /**
   * Replaces the live project with `target` via JSON0 object replace ops so
   * every connected client receives the restore.
   */
  async replaceProject(roomId: string, target: ProjectDocument): Promise<void> {
    await this.migrateLegacyIfNeeded(roomId);

    const connection = this.backend.connect();
    const doc = connection.get(SHAREDB_COLLECTION, roomId);

    try {
      await fetchDoc(doc);
      if (!doc.type || doc.data === undefined) {
        throw new NotFoundError(`Room ${roomId} has no document`);
      }

      const current = normalizeDocument(doc.data);
      const ops: Array<Record<string, unknown>> = [];

      if (JSON.stringify(current.files) !== JSON.stringify(target.files)) {
        ops.push({ p: ['files'], od: current.files, oi: target.files });
      }
      if (current.entryPoint !== target.entryPoint) {
        ops.push({ p: ['entryPoint'], od: current.entryPoint, oi: target.entryPoint });
      }

      if (ops.length === 0) return;

      await new Promise<void>((resolve, reject) => {
        doc.submitOp(ops, { source: 'snapshot-restore' }, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      logger.info({ roomId, fileCount: Object.keys(target.files).length }, 'Restored project from snapshot');
    } finally {
      connection.close();
    }
  }
}
