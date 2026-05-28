export interface SnapshotSummary {
  id: string;
  roomId: string;
  createdAt: string;
  createdBy: string | null;
  createdByUsername: string | null;
  byteSize: number;
}

export interface SnapshotDetail extends SnapshotSummary {
  content: string;
}
