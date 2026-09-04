import {
  SNAPSHOT_MAX_CONTENT_BYTES,
  SNAPSHOT_MAX_PER_ROOM,
  type SupportedLanguage,
} from '@/constants/index.js';
import type { RealtimeDocumentService } from '@/realtime/documentService.js';
import type { RoomService } from '@/rooms/roomService.js';
import {
  parseSnapshotContent,
  serializeProjectSnapshot,
  snapshotListMeta,
} from '@/snapshots/snapshotPayload.js';
import type { SnapshotRepository } from '@/snapshots/snapshotRepository.js';
import type { SnapshotDetail, SnapshotRow, SnapshotSummary } from '@/snapshots/types.js';
import { AppError, NotFoundError } from '@/utils/errors.js';
import { isOwner } from '@/rooms/access.js';
import { logger } from '@/utils/logger.js';

export class SnapshotService {
  constructor(
    private readonly repository: SnapshotRepository,
    private readonly roomService: RoomService,
    private readonly documents: RealtimeDocumentService,
  ) {}

  async saveCurrent(roomId: string, userId: string): Promise<SnapshotDetail> {
    const room = await this.roomService.getEditable(roomId, userId);
    const doc = await this.documents.readDocument(roomId);
    const content = serializeProjectSnapshot(doc);

    if (Buffer.byteLength(content, 'utf8') > SNAPSHOT_MAX_CONTENT_BYTES) {
      throw new AppError(
        `Document exceeds snapshot limit of ${SNAPSHOT_MAX_CONTENT_BYTES} bytes`,
        413,
        'SNAPSHOT_TOO_LARGE',
      );
    }

    const row = await this.repository.create({
      roomId,
      content,
      createdBy: userId,
    });

    this.enforceRetention(roomId).catch((err) => {
      logger.warn({ err, roomId }, 'Snapshot retention enforcement failed');
    });

    logger.info(
      { roomId, snapshotId: row.id, bytes: Buffer.byteLength(content, 'utf8') },
      'Saved room snapshot',
    );
    return this.toDetail(row, room.language);
  }

  async list(roomId: string, userId: string | null): Promise<SnapshotSummary[]> {
    const room = await this.roomService.getReadable(roomId, userId);
    const rows = await this.repository.list(roomId);
    return rows.map((row) => this.toSummary(row, room.language));
  }

  async get(roomId: string, snapshotId: string, userId: string | null): Promise<SnapshotDetail> {
    const room = await this.roomService.getReadable(roomId, userId);
    const row = await this.repository.findById(roomId, snapshotId);
    if (!row) {
      throw new NotFoundError(`Snapshot ${snapshotId} not found in room ${roomId}`);
    }
    return this.toDetail(row, room.language);
  }

  async restore(roomId: string, snapshotId: string, userId: string): Promise<SnapshotDetail> {
    await this.roomService.getEditable(roomId, userId);
    const detail = await this.get(roomId, snapshotId, userId);
    await this.documents.replaceProject(roomId, detail.project);
    logger.info({ roomId, snapshotId }, 'Restored snapshot to live project');
    return detail;
  }

  async remove(roomId: string, snapshotId: string, userId: string): Promise<void> {
    const room = await this.roomService.getReadable(roomId, userId);
    if (!isOwner(room, userId)) {
      throw new AppError('Only the room owner can delete snapshots', 403, 'FORBIDDEN');
    }
    const deleted = await this.repository.delete(roomId, snapshotId);
    if (!deleted) {
      throw new NotFoundError(`Snapshot ${snapshotId} not found in room ${roomId}`);
    }
    logger.info({ roomId, snapshotId }, 'Deleted snapshot');
  }

  private toSummary(row: SnapshotRow, language: SupportedLanguage): SnapshotSummary {
    const parsed = parseSnapshotContent(row.content, language);
    const meta = snapshotListMeta(parsed);
    return {
      id: row.id,
      roomId: row.roomId,
      createdAt: row.createdAt,
      createdBy: row.createdBy,
      createdByUsername: row.createdByUsername,
      byteSize: Buffer.byteLength(row.content, 'utf8'),
      snapshotVersion: meta.snapshotVersion,
      fileCount: meta.fileCount,
      entryPoint: meta.entryPoint,
    };
  }

  private toDetail(row: SnapshotRow, language: SupportedLanguage): SnapshotDetail {
    const parsed = parseSnapshotContent(row.content, language);
    return {
      ...this.toSummary(row, language),
      content: row.content,
      project: parsed.project,
    };
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
