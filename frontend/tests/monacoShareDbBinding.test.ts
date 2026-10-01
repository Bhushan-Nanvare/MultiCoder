import ShareDB from 'sharedb';
import type { Doc } from 'sharedb/lib/client';
import { beforeEach, describe, expect, it } from 'vitest';
import { bindMonacoToShareDb } from '@/realtime/monacoShareDbBinding';
import type { ProjectDocument } from '@/types/room';

/**
 * A one-line stand-in for the slice of Monaco the binding touches. Keeping the
 * content on a single line means offsets map to columns directly, which is all
 * the binding needs to translate edits both ways.
 */
function fakeEditor() {
  let value = '';
  let position = { lineNumber: 1, column: 1 };
  const listeners: Array<(event: unknown) => void> = [];
  const emit = (changes: unknown[]) => listeners.slice().forEach((fn) => fn({ changes }));

  const model = {
    getValue: () => value,
    setValue(next: string) {
      const previous = value;
      value = next;
      emit([{ rangeOffset: 0, rangeLength: previous.length, text: next }]);
    },
    getPositionAt: (offset: number) => ({ lineNumber: 1, column: offset + 1 }),
    validatePosition: (p: { column: number }) => ({
      lineNumber: 1,
      column: Math.min(p.column, value.length + 1),
    }),
    applyEdits(edits: Array<{ range: { startColumn: number; endColumn: number }; text: string }>) {
      for (const edit of edits) {
        const start = edit.range.startColumn - 1;
        const end = edit.range.endColumn - 1;
        value = value.slice(0, start) + edit.text + value.slice(end);
        emit([{ rangeOffset: start, rangeLength: end - start, text: edit.text }]);
      }
    },
  };

  const editor = {
    getModel: () => model,
    onDidChangeModelContent(fn: (event: unknown) => void) {
      listeners.push(fn);
      return { dispose: () => listeners.splice(listeners.indexOf(fn), 1) };
    },
    getPosition: () => position,
    setPosition: (next: typeof position) => {
      position = next;
    },
  };

  return {
    editor,
    model,
    /** Simulates a person typing `text` at `offset`. */
    type: (offset: number, text: string) =>
      model.applyEdits([{ range: { startColumn: offset + 1, endColumn: offset + 1 }, text }]),
  };
}

const waitFor = async (predicate: () => boolean, timeoutMs = 2000): Promise<boolean> => {
  const start = Date.now();
  while (!predicate() && Date.now() - start < timeoutMs) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  return predicate();
};

const done = (fn: (cb: (err?: unknown) => void) => void): Promise<void> =>
  new Promise((resolve, reject) => fn((err) => (err ? reject(err) : resolve())));

describe('Monaco <-> ShareDB binding', () => {
  let peerA: ReturnType<ShareDB['connect']>;
  let docA: Doc<ProjectDocument>;
  let docB: Doc<ProjectDocument>;

  beforeEach(async () => {
    const backend = new ShareDB();
    peerA = backend.connect();
    docA = peerA.get('rooms', 'r1') as Doc<ProjectDocument>;
    await done((cb) =>
      docA.create(
        {
          version: 2,
          entryPoint: 'main.js',
          files: { 'main.js': { content: 'hello' }, 'util.js': { content: 'u' } },
        },
        cb,
      ),
    );
    await done((cb) => docA.subscribe(cb));
    docB = backend.connect().get('rooms', 'r1') as Doc<ProjectDocument>;
    await done((cb) => docB.subscribe(cb));
  });

  it('shows the file content as soon as it binds', () => {
    const { editor, model } = fakeEditor();
    bindMonacoToShareDb(editor as never, docB, 'main.js');
    expect(model.getValue()).toBe('hello');
  });

  it('applies a remote text edit', async () => {
    const { editor, model } = fakeEditor();
    bindMonacoToShareDb(editor as never, docB, 'main.js');
    docA.submitOp([{ p: ['files', 'main.js', 'content', 5], si: ' world' }]);
    expect(await waitFor(() => model.getValue() === 'hello world')).toBe(true);
  });

  it('reloads the editor when a snapshot restore replaces every file', async () => {
    // Restore swaps the whole `files` object in one op rather than editing
    // text, so the binding has to reload instead of patching.
    const { editor, model } = fakeEditor();
    bindMonacoToShareDb(editor as never, docB, 'main.js');
    docA.submitOp([
      { p: ['files'], od: docA.data.files, oi: { 'main.js': { content: 'restored' } } },
    ]);
    expect(await waitFor(() => model.getValue() === 'restored')).toBe(true);
  });

  it('keeps typing in sync after a restore', async () => {
    const { editor, model, type } = fakeEditor();
    bindMonacoToShareDb(editor as never, docB, 'main.js');
    docA.submitOp([
      { p: ['files'], od: docA.data.files, oi: { 'main.js': { content: 'restored' } } },
    ]);
    await waitFor(() => model.getValue() === 'restored');

    type(8, '!');
    expect(await waitFor(() => docA.data.files['main.js']?.content === 'restored!')).toBe(true);
  });

  it('reloads when just this file is replaced', async () => {
    const { editor, model } = fakeEditor();
    bindMonacoToShareDb(editor as never, docB, 'main.js');
    docA.submitOp([
      { p: ['files', 'main.js'], od: docA.data.files['main.js'], oi: { content: 'replaced' } },
    ]);
    expect(await waitFor(() => model.getValue() === 'replaced')).toBe(true);
  });

  it('sends local typing to the other peer', async () => {
    const { editor, type } = fakeEditor();
    bindMonacoToShareDb(editor as never, docB, 'main.js');
    type(5, '!');
    expect(await waitFor(() => docA.data.files['main.js']?.content === 'hello!')).toBe(true);
  });
});
