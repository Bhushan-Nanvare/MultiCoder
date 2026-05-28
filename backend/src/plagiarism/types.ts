import type { SupportedLanguage } from '@/constants/index.js';

export interface SubmitSnippetInput {
  language: SupportedLanguage;
  code: string;
  ownerId: string | null;
}

export interface CheckPlagiarismInput {
  language: SupportedLanguage;
  code: string;
  /** When true, also persist the submitted snippet for future comparisons. */
  store: boolean;
  /** Caller id; matches against the same user are suppressed. */
  ownerId: string | null;
}

export interface PlagiarismMatch {
  snippetId: string;
  similarity: number;
  language: SupportedLanguage;
  matchedFingerprints: number;
  candidateFingerprintCount: number;
  ownerUsername: string | null;
  createdAt: string;
}

export interface PlagiarismResult {
  /** Highest similarity score across all matches, 0-100. */
  similarityScore: number;
  fingerprintCount: number;
  matches: PlagiarismMatch[];
  stored: { snippetId: string } | null;
}
