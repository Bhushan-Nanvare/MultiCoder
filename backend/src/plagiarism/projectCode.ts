import type { ProjectDocument } from '@/realtime/types.js';

/**
 * Flattens a project into one deterministic string so a similarity score
 * depends on the whole submission, not on whichever file happened to be open.
 * Paths are sorted and only contents are joined — a path header would survive
 * the normalizer differently per language and skew the fingerprints.
 */
export function projectToComparableCode(doc: ProjectDocument): string {
  return Object.keys(doc.files)
    .sort()
    .map((path) => doc.files[path]?.content ?? '')
    .join('\n');
}
