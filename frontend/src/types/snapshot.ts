import type { ProjectDocument } from '@/types/room';

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
  content: string;
  project: ProjectDocument;
}
