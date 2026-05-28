import {
  SNAPSHOT_MAX_CONTENT_BYTES,
  SNAPSHOT_MAX_PER_ROOM,
} from '@/constants/index.js';
import type { RealtimeDocumentService } from '@/realtime/documentService.js';
import type { RoomService } from '@/rooms/roomService.js';
import type { SnapshotRepository } from '@/snapshots/snapshotRepository.js';
import type { SnapshotDetail, SnapshotSummary } from '@/snapshots/types.js';
import { AppError, NotFoundError } from '@/utils/errors.js';
import { logger } from '@/utils/logger.js';

export class SnapshotService {
  constructor(
    private readonly repository: SnapshotRepository,
    private readonly roomService: RoomService,
    private readonly documents: RealtimeDocumentService,
  ) {}

  async saveCurrent(roomId: string, userId: string): Promise<SnapshotDetail> {
    await this.roomService.get(roomId); // 404s if room doesn't exist
    const doc = await this.documents.readDocument(roomId);

    if (Buffer.byteLength(doc.content, 'utf8') > SNAPSHOT_MAX_CONTENT_BYTES) {
      throw new AppError(
        `Document exceeds snapshot limit of ${SNAPSHOT_MAX_CONTENT_BYTES} bytes`,
        413,
        'SNAPSHOT_TOO_LARGE',
      );
    }

    const snapshot = await this.repository.create({
      roomId,
      content: doc.content,
      createdBy: userId,
    });

    // Best-effort retention enforcement; failure shouldn't block the save.
    this.enforceRetention(roomId).catch((err) => {
      logger.warn({ err, roomId }, 'Snapshot retention enforcement failed');
    });

    logger.info(
      { roomId, snapshotId: snapshot.id, bytes: snapshot.byteSize },
      'Saved room snapshot',
    );
    return snapshot;
  }

  async list(roomId: string): Promise<SnapshotSummary[]> {
    await this.roomService.get(roomId);
    return this.repository.list(roomId);
  }

  async get(roomId: string, snapshotId: string): Promise<SnapshotDetail> {
    const snapshot = await this.repository.findById(roomId, snapshotId);
    if (!snapshot) {
      throw new NotFoundError(`Snapshot ${snapshotId} not found in room ${roomId}`);
    }
    return snapshot;
  }

  private async enforceRetention(roomId: string): Promise<void> {
    const count = await this.repository.countForRoom(roomId);
    if (count <= SNAPSHOT_MAX_PER_ROOM) return;
    const removed = await this.repository.deleteOldest(roomId, SNAPSHOT_MAX_PER_ROOM);
    if (removed > 0) {
      logger.debug({ roomId, removed }, 'Trimmed old snapshots');
    }
  }
}
