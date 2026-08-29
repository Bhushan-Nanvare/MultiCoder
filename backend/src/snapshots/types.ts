import type { ProjectDocument } from '@/realtime/types.js';

export interface SnapshotSummary {
  id: string;
  roomId: string;
  createdAt: string;
  createdBy: string | null;
  createdByUsername: string | null;
  byteSize: number;
  snapshotVersion: 1 | 2;
  fileCount: number;
  entryPoint: string;
}

export interface SnapshotDetail extends SnapshotSummary {
  /** Raw column value (JSON for v2, source text for legacy v1). */
  content: string;
  project: ProjectDocument;
}

export interface SnapshotRow {
  id: string;
  roomId: string;
  createdAt: string;
  createdBy: string | null;
  createdByUsername: string | null;
  content: string;
}
