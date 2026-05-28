import type { SupportedLanguage } from '@/constants/index.js';

/**
 * Reduce source code to a comparable canonical form by stripping comments and
 * collapsing whitespace. This is intentionally simple — token-level or
 * AST-based normalization (renaming identifiers etc.) is a bigger project.
 *
 * The same input must always produce the same output, otherwise fingerprints
 * computed at submit-time won't match fingerprints computed at check-time.
 */
export function normalizeCode(code: string, language: SupportedLanguage): string {
  let working = code;

  if (language === 'javascript' || language === 'cpp') {
    working = stripCBlockComments(working);
    working = stripCLineComments(working);
  } else if (language === 'python') {
    working = stripPythonLineComments(working);
  }

  // Collapse all whitespace runs to nothing and lowercase. Code semantics
  // remain comparable for identifier-preserving similarity.
  return working.replace(/\s+/g, '').toLowerCase();
}

function stripCLineComments(code: string): string {
  return code.replace(/\/\/[^\n]*/g, '');
}

function stripCBlockComments(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\//g, '');
}

function stripPythonLineComments(code: string): string {
  return code
    .split('\n')
    .map((line) => {
      // Naive: cuts on first '#' outside string literals. Misses '#' inside
      // strings, accepted tradeoff — fingerprints still cluster by structure.
      const idx = line.indexOf('#');
      return idx === -1 ? line : line.slice(0, idx);
    })
    .join('\n');
}
