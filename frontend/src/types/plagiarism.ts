import type { SupportedLanguage } from '@/types/room';

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
  similarityScore: number;
  fingerprintCount: number;
  matches: PlagiarismMatch[];
  stored: { snippetId: string } | null;
}

export interface PlagiarismRequest {
  language: SupportedLanguage;
  code: string;
  store?: boolean;
}
