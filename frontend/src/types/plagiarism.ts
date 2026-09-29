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

/**
 * Only the room id travels: the server reads the submission from the room's
 * live project, so a score can't be faked by sending different code.
 */
export interface PlagiarismRequest {
  roomId: string;
}
