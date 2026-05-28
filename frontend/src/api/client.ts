import { env } from '@/config/env';
import { readSseFrames } from '@/api/sseClient';
import type { AuthUser } from '@/types/auth';
import type { ExecutionResult } from '@/types/execution';
import type { PlagiarismRequest, PlagiarismResult } from '@/types/plagiarism';
import type {
  ReviewRequest,
  ReviewResult,
  ReviewStreamCallbacks,
  ReviewStreamEvent,
} from '@/types/review';
import type { Room, SupportedLanguage } from '@/types/room';
import type { SnapshotDetail, SnapshotSummary } from '@/types/snapshot';

interface ApiErrorBody {
  code: string;
  message: string;
  details?: unknown;
}

export class ApiError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details: unknown;

  constructor(status: number, body: ApiErrorBody | undefined, fallback: string) {
    super(body?.message ?? fallback);
    this.status = status;
    this.code = body?.code ?? 'UNKNOWN';
    this.details = body?.details;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${env.apiUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
    credentials: 'include',
  });

  if (response.status === 204) {
    return undefined as T;
  }

  if (!response.ok) {
    let payload: { error?: ApiErrorBody } | undefined;
    try {
      payload = (await response.json()) as { error?: ApiErrorBody };
    } catch {
      payload = undefined;
    }
    throw new ApiError(
      response.status,
      payload?.error,
      `Request failed: ${response.status} ${response.statusText}`,
    );
  }

  return (await response.json()) as T;
}

export const api = {
  async createRoom(input: { name?: string; language?: SupportedLanguage } = {}): Promise<Room> {
    const json = await request<{ data: Room }>('/api/rooms', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return json.data;
  },

  async listRooms(): Promise<Room[]> {
    const json = await request<{ data: Room[] }>('/api/rooms');
    return json.data;
  },

  async getRoom(id: string): Promise<Room> {
    const json = await request<{ data: Room }>(`/api/rooms/${encodeURIComponent(id)}`);
    return json.data;
  },

  async me(): Promise<AuthUser> {
    const json = await request<{ data: AuthUser }>('/api/user/me');
    return json.data;
  },

  async logout(): Promise<void> {
    await request<void>('/auth/logout', { method: 'POST' });
  },

  async executeCode(input: {
    language: SupportedLanguage;
    code: string;
    stdin?: string;
  }): Promise<ExecutionResult> {
    const json = await request<{ data: ExecutionResult }>('/api/execute', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return json.data;
  },

  async reviewCode(input: ReviewRequest): Promise<ReviewResult> {
    const json = await request<{ data: ReviewResult }>('/api/review', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return json.data;
  },

  async saveSnapshot(roomId: string): Promise<SnapshotDetail> {
    const json = await request<{ data: SnapshotDetail }>(
      `/api/rooms/${encodeURIComponent(roomId)}/snapshots`,
      { method: 'POST' },
    );
    return json.data;
  },

  async listSnapshots(roomId: string): Promise<SnapshotSummary[]> {
    const json = await request<{ data: SnapshotSummary[] }>(
      `/api/rooms/${encodeURIComponent(roomId)}/snapshots`,
    );
    return json.data;
  },

  async getSnapshot(roomId: string, snapshotId: string): Promise<SnapshotDetail> {
    const json = await request<{ data: SnapshotDetail }>(
      `/api/rooms/${encodeURIComponent(roomId)}/snapshots/${encodeURIComponent(snapshotId)}`,
    );
    return json.data;
  },

  async checkPlagiarism(input: PlagiarismRequest): Promise<PlagiarismResult> {
    const json = await request<{ data: PlagiarismResult }>('/api/check-plagiarism', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return json.data;
  },

  async reviewCodeStream(
    input: ReviewRequest,
    callbacks: ReviewStreamCallbacks,
    signal?: AbortSignal,
  ): Promise<void> {
    const response = await fetch(`${env.apiUrl}/api/review/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      credentials: 'include',
      body: JSON.stringify(input),
      signal,
    });
    if (!response.ok) {
      let payload: { error?: { code: string; message: string } } | undefined;
      try {
        payload = (await response.json()) as { error?: { code: string; message: string } };
      } catch {
        payload = undefined;
      }
      throw new ApiError(
        response.status,
        payload?.error,
        `Stream request failed: ${response.status} ${response.statusText}`,
      );
    }

    for await (const frame of readSseFrames(response, signal)) {
      let event: ReviewStreamEvent;
      try {
        event = JSON.parse(frame.data) as ReviewStreamEvent;
      } catch {
        continue;
      }
      if (event.type === 'chunk') callbacks.onChunk?.(event.text);
      else if (event.type === 'result') callbacks.onResult?.(event.result);
      else if (event.type === 'error') callbacks.onError?.(event.message, event.code);
    }
  },
};

export function buildGithubLoginUrl(): string {
  return `${env.apiUrl}/auth/github`;
}
