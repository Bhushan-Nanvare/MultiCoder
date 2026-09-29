import type { SupportedLanguage } from '@/types/room';

export type BugSeverity = 'low' | 'medium' | 'high';

export interface ReviewBug {
  line: number;
  severity: BugSeverity;
  description: string;
}

export interface ReviewResult {
  timeComplexity: string;
  spaceComplexity: string;
  summary: string;
  suggestions: string[];
  bugs: ReviewBug[];
  securityConcerns: string[];
  score: number;
  provider: string;
  model: string;
}

export interface ReviewRequest {
  /** The server checks the room's mode and your role before answering. */
  roomId: string;
  language: SupportedLanguage;
  code: string;
}

export type ReviewStreamEvent =
  | { type: 'chunk'; text: string }
  | { type: 'result'; result: ReviewResult }
  | { type: 'error'; message: string; code?: string };

export interface ReviewStreamCallbacks {
  onChunk?: (text: string) => void;
  onResult?: (result: ReviewResult) => void;
  onError?: (message: string, code?: string) => void;
}
