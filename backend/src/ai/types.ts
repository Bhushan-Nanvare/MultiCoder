import type { SupportedLanguage } from '@/constants/index.js';

export type BugSeverity = 'low' | 'medium' | 'high';

export interface ReviewBug {
  line: number;
  severity: BugSeverity;
  description: string;
}

export interface ReviewRequest {
  language: SupportedLanguage;
  code: string;
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

export type ReviewStreamEvent =
  | { type: 'chunk'; text: string }
  | { type: 'result'; result: ReviewResult }
  | { type: 'error'; message: string; code?: string };

/**
 * Pluggable AI review backend. Each implementation maps a code review request
 * to a fully-validated ReviewResult — the rest of the app never touches a
 * specific vendor SDK. Providers also expose a streaming variant for SSE.
 */
export interface AiReviewProvider {
  readonly name: string;
  readonly model: string;
  review(request: ReviewRequest): Promise<ReviewResult>;
  reviewStream(request: ReviewRequest): AsyncGenerator<ReviewStreamEvent, void, void>;
}
