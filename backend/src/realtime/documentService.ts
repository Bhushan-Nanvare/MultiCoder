import type ShareDB from 'sharedb';
import { SHAREDB_COLLECTION, type SupportedLanguage } from '@/constants/index.js';
import type { RoomDocument } from '@/realtime/types.js';
import { NotFoundError } from '@/utils/errors.js';

export class RealtimeDocumentService {
  constructor(private readonly backend: ShareDB) {}

  /**
   * Creates the ShareDB document for a room if it doesn't already exist.
   * Idempotent — safe to call multiple times for the same room id.
   */
  async initializeDocument(roomId: string, language: SupportedLanguage): Promise<void> {
    const connection = this.backend.connect();
    const doc = connection.get(SHAREDB_COLLECTION, roomId);

    await new Promise<void>((resolve, reject) => {
      doc.fetch((fetchErr) => {
        if (fetchErr) {
          reject(fetchErr);
          return;
        }
        if (doc.type) {
          resolve();
          return;
        }
        const initial: RoomDocument = { content: '', language };
        doc.create(initial, (createErr) => {
          if (createErr) {
            reject(createErr);
            return;
          }
          resolve();
        });
      });
    });

    connection.close();
  }

  /**
   * Reads the live ShareDB document for a room. Throws NotFoundError if the
   * room has no initialized document.
   */
  async readDocument(roomId: string): Promise<RoomDocument> {
    const connection = this.backend.connect();
    const doc = connection.get(SHAREDB_COLLECTION, roomId);

    try {
      const data = await new Promise<RoomDocument>((resolve, reject) => {
        doc.fetch((err) => {
          if (err) {
            reject(err);
            return;
          }
          if (!doc.type || doc.data === undefined) {
            reject(new NotFoundError(`Room ${roomId} has no document`));
            return;
          }
          resolve(doc.data as RoomDocument);
        });
      });
      return data;
    } finally {
      connection.close();
    }
  }
}
