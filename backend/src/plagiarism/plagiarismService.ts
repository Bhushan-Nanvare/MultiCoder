import {
  PLAGIARISM_MAX_CODE_BYTES,
  PLAGIARISM_MAX_MATCHES_RETURNED,
} from '@/constants/index.js';
import { normalizeCode } from '@/plagiarism/normalizer.js';
import type { SnippetRepository } from '@/plagiarism/snippetRepository.js';
import type {
  CheckPlagiarismInput,
  PlagiarismMatch,
  PlagiarismResult,
} from '@/plagiarism/types.js';
import { computeFingerprints } from '@/plagiarism/winnowing.js';
import { AppError } from '@/utils/errors.js';

export class PlagiarismService {
  constructor(private readonly repository: SnippetRepository) {}

  async check(input: CheckPlagiarismInput): Promise<PlagiarismResult> {
    if (Buffer.byteLength(input.code, 'utf8') > PLAGIARISM_MAX_CODE_BYTES) {
      throw new AppError(
        `Code exceeds plagiarism limit of ${PLAGIARISM_MAX_CODE_BYTES} bytes`,
        413,
        'PLAGIARISM_CODE_TOO_LARGE',
      );
    }
    if (input.code.trim().length === 0) {
      throw new AppError('Cannot check empty code', 400, 'PLAGIARISM_EMPTY_CODE');
    }

    const normalized = normalizeCode(input.code, input.language);
    const fingerprintSet = computeFingerprints(normalized);
    const fingerprints = Array.from(fingerprintSet);

    const rawMatches = await this.repository.findMatches({
      language: input.language,
      fingerprints,
      excludeOwnerId: input.ownerId,
      limit: PLAGIARISM_MAX_MATCHES_RETURNED,
    });

    const matches: PlagiarismMatch[] = rawMatches.map((row) => {
      // Jaccard similarity over fingerprint sets: |A ∩ B| / |A ∪ B|.
      const intersection = row.matchedCount;
      const union = fingerprints.length + row.candidateFingerprintCount - intersection;
      const similarity = union === 0 ? 0 : Math.round((intersection / union) * 100);
      return {
        snippetId: row.snippetId,
        similarity,
        language: row.language,
        matchedFingerprints: row.matchedCount,
        candidateFingerprintCount: row.candidateFingerprintCount,
        ownerUsername: row.ownerUsername,
        createdAt: row.createdAt.toISOString(),
      };
    });

    matches.sort((a, b) => b.similarity - a.similarity);

    let stored: { snippetId: string } | null = null;
    if (input.store && fingerprints.length > 0) {
      const created = await this.repository.storeSnippet({
        ownerId: input.ownerId,
        language: input.language,
        code: input.code,
        fingerprints,
      });
      stored = { snippetId: created.id };
    }

    return {
      similarityScore: matches[0]?.similarity ?? 0,
      fingerprintCount: fingerprints.length,
      matches,
      stored,
    };
  }
}
