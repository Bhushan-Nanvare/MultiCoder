import { describe, expect, it } from 'vitest';
import { MAX_FILE_BYTES, MAX_PROJECT_META_BYTES } from '@/constants/index.js';
import {
  assertValidLiveDocument,
  buildLegacyMigrationOps,
  normalizeDocument,
} from '@/realtime/documentHelpers.js';

const validDoc = () => ({
  version: 2 as const,
  entryPoint: 'main.js',
  files: { 'main.js': { content: 'console.log(1)', language: 'javascript' as const } },
});

// These are the checks that stop one client from breaking a room for everyone,
// so each case mirrors an op a browser could really submit.
describe('assertValidLiveDocument', () => {
  it('accepts a well-formed project', () => {
    expect(() => assertValidLiveDocument(validDoc())).not.toThrow();
  });

  it('rejects a document with no files left', () => {
    expect(() => assertValidLiveDocument({ ...validDoc(), files: {} })).toThrow();
  });

  it('rejects an entry point that is not one of the files', () => {
    expect(() => assertValidLiveDocument({ ...validDoc(), entryPoint: 'gone.js' })).toThrow();
  });

  it('rejects a file larger than the per-file limit', () => {
    const doc = validDoc();
    doc.files['main.js'].content = 'x'.repeat(MAX_FILE_BYTES + 1);
    expect(() => assertValidLiveDocument(doc)).toThrow(/exceeds/);
  });

  it('rejects a path that climbs out of the project', () => {
    const doc = { ...validDoc(), files: { '../escape.js': { content: '' }, 'main.js': { content: '' } } };
    expect(() => assertValidLiveDocument(doc)).toThrow();
  });

  it('rejects unknown top-level fields', () => {
    expect(() => assertValidLiveDocument({ ...validDoc(), injected: true })).toThrow(/Unexpected/);
  });

  it('rejects meta too large to broadcast', () => {
    const doc = { ...validDoc(), meta: { lastRun: { stdout: 'x'.repeat(MAX_PROJECT_META_BYTES) } } };
    expect(() => assertValidLiveDocument(doc)).toThrow(/meta/);
  });

  it('rejects the legacy single-file shape as a live document', () => {
    // The server migrates legacy docs before clients edit them.
    expect(() => assertValidLiveDocument({ content: 'x', language: 'javascript' })).toThrow();
  });
});

describe('legacy migration', () => {
  it('reads a v1 document as a one-file project', () => {
    const migrated = normalizeDocument({ content: 'print(1)', language: 'python' });
    expect(migrated.version).toBe(2);
    expect(migrated.entryPoint).toBe('main.py');
    expect(migrated.files['main.py']?.content).toBe('print(1)');
  });

  it('builds ops that both add v2 fields and drop the v1 ones', () => {
    const ops = buildLegacyMigrationOps({ content: 'x', language: 'javascript' });
    const paths = ops.map((op) => (op.p as string[])[0]);
    expect(paths).toEqual(expect.arrayContaining(['version', 'entryPoint', 'files', 'content', 'language']));
  });
});
