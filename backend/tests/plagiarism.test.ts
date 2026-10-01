import { describe, expect, it } from 'vitest';
import { normalizeCode } from '@/plagiarism/normalizer.js';
import { projectToComparableCode } from '@/plagiarism/projectCode.js';
import { computeFingerprints } from '@/plagiarism/winnowing.js';

const binarySearch = `
function binarySearch(numbers, target) {
  let low = 0;
  let high = numbers.length - 1;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    if (numbers[middle] === target) return middle;
    if (numbers[middle] < target) low = middle + 1;
    else high = middle - 1;
  }
  return -1;
}`;

const renamed = `
function find(arr, x) {
  let l = 0;
  let r = arr.length - 1;
  while (l <= r) {
    const m = Math.floor((l + r) / 2);
    if (arr[m] === x) return m;
    if (arr[m] < x) l = m + 1;
    else r = m - 1;
  }
  return -1;
}`;

const unrelated = `
function fib(n) {
  if (n < 2) return n;
  return fib(n - 1) + fib(n - 2);
}`;

function similarity(a: string, b: string): number {
  const left = computeFingerprints(normalizeCode(a, 'javascript'));
  const right = computeFingerprints(normalizeCode(b, 'javascript'));
  const shared = [...left].filter((hash) => right.has(hash)).length;
  return Math.round((shared / (left.size + right.size - shared)) * 100);
}

describe('similarity scoring', () => {
  it('ignores comments and reformatting', () => {
    const reformatted = binarySearch.replace(/\n/g, '\n  // a note\n');
    expect(similarity(binarySearch, reformatted)).toBe(100);
  });

  it('still catches a copy with every variable renamed', () => {
    // Identifiers are not normalised yet, so the score drops but stays well
    // clear of an unrelated program.
    const score = similarity(binarySearch, renamed);
    expect(score).toBeGreaterThan(15);
    expect(score).toBeLessThan(100);
    expect(score).toBeGreaterThan(similarity(binarySearch, unrelated));
  });

  it('scores unrelated programs low', () => {
    expect(similarity(binarySearch, unrelated)).toBeLessThan(15);
  });

  it('produces no fingerprints for text shorter than one k-gram', () => {
    expect(computeFingerprints('ab').size).toBe(0);
  });
});

describe('project flattening', () => {
  it('does not depend on the order files arrive in', () => {
    const a = { version: 2 as const, entryPoint: 'main.js', files: { 'main.js': { content: 'one' }, 'util.js': { content: 'two' } } };
    const b = { version: 2 as const, entryPoint: 'main.js', files: { 'util.js': { content: 'two' }, 'main.js': { content: 'one' } } };
    expect(projectToComparableCode(a)).toBe(projectToComparableCode(b));
  });

  it('includes every file, not just the entry point', () => {
    const doc = { version: 2 as const, entryPoint: 'main.js', files: { 'main.js': { content: 'one' }, 'util.js': { content: 'two' } } };
    expect(projectToComparableCode(doc)).toContain('one');
    expect(projectToComparableCode(doc)).toContain('two');
  });
});
