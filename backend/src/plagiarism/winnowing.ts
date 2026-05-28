import { PLAGIARISM_KGRAM_SIZE, PLAGIARISM_WINDOW_SIZE } from '@/constants/index.js';

const BASE = 257n;
const MOD = (1n << 61n) - 1n; // 2^61 - 1 Mersenne prime, comfortably fits one BigInt op

/**
 * Computes a Rabin-Karp rolling hash for every length-k contiguous substring
 * of `text`. Returns one hash per starting position; the array length is
 * `text.length - k + 1`, or empty if `text` is shorter than `k`.
 */
export function rollingHashes(text: string, k: number = PLAGIARISM_KGRAM_SIZE): bigint[] {
  if (text.length < k) return [];

  const hashes: bigint[] = [];
  let baseK = 1n;
  for (let i = 0; i < k - 1; i++) baseK = (baseK * BASE) % MOD;

  let hash = 0n;
  for (let i = 0; i < k; i++) {
    hash = (hash * BASE + BigInt(text.charCodeAt(i))) % MOD;
  }
  hashes.push(hash);

  for (let i = k; i < text.length; i++) {
    const leaving = BigInt(text.charCodeAt(i - k));
    const entering = BigInt(text.charCodeAt(i));
    hash = (hash + MOD - (leaving * baseK) % MOD) % MOD;
    hash = (hash * BASE + entering) % MOD;
    hashes.push(hash);
  }

  return hashes;
}

/**
 * Winnowing per Schleimer/Wilkerson/Aiken (SIGMOD 2003): for every length-w
 * window of hashes, select the minimum (right-most on ties). Yields a
 * de-duplicated set of fingerprints with the local-density guarantee that
 * any matching substring ≥ k + w - 1 chars long produces at least one shared
 * fingerprint.
 */
export function winnow(
  hashes: bigint[],
  windowSize: number = PLAGIARISM_WINDOW_SIZE,
): Set<string> {
  const fingerprints = new Set<string>();
  if (hashes.length === 0) return fingerprints;
  if (hashes.length <= windowSize) {
    let min = hashes[0]!;
    for (let i = 1; i < hashes.length; i++) {
      if (hashes[i]! < min) min = hashes[i]!;
    }
    fingerprints.add(min.toString());
    return fingerprints;
  }

  let lastSelectedIdx = -1;
  for (let start = 0; start + windowSize <= hashes.length; start++) {
    let minIdx = start;
    for (let i = start + 1; i < start + windowSize; i++) {
      if (hashes[i]! <= hashes[minIdx]!) minIdx = i;
    }
    if (minIdx !== lastSelectedIdx) {
      fingerprints.add(hashes[minIdx]!.toString());
      lastSelectedIdx = minIdx;
    }
  }

  return fingerprints;
}

export function computeFingerprints(normalized: string): Set<string> {
  return winnow(rollingHashes(normalized));
}
