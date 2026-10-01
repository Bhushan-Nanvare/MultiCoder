import { describe, expect, it } from 'vitest';
import { MAX_FILE_BYTES } from '@/constants/index.js';
import { toPistonFiles } from '@/execution/pistonFiles.js';

const project = (files: Array<{ path: string; content: string }>, entryPoint = files[0]!.path) => ({
  language: 'javascript' as const,
  entryPoint,
  files,
});

describe('toPistonFiles', () => {
  it('sends the entry point first, because Piston runs files[0]', () => {
    const out = toPistonFiles(
      project([{ path: 'util.js', content: 'a' }, { path: 'main.js', content: 'b' }], 'main.js'),
    );
    expect(out[0]?.name).toBe('main.js');
  });

  it('uses bare basenames when unique so relative requires resolve', () => {
    const out = toPistonFiles(
      project([{ path: 'main.js', content: 'a' }, { path: 'src/util.js', content: 'b' }]),
    );
    expect(out.map((file) => file.name)).toEqual(['main.js', 'util.js']);
  });

  it('keeps full paths when two files share a basename', () => {
    const out = toPistonFiles(
      project([
        { path: 'main.js', content: 'a' },
        { path: 'src/util.js', content: 'b' },
        { path: 'lib/util.js', content: 'c' },
      ]),
    );
    expect(out.map((file) => file.name)).toEqual(['main.js', 'src/util.js', 'lib/util.js']);
  });

  it('refuses a path that escapes the project', () => {
    expect(() => toPistonFiles(project([{ path: '../../etc/passwd', content: 'x' }]))).toThrow();
  });

  it('refuses duplicate paths', () => {
    expect(() =>
      toPistonFiles(project([{ path: 'main.js', content: 'a' }, { path: 'main.js', content: 'b' }])),
    ).toThrow(/Duplicate/);
  });

  it('refuses an entry point that is not in the file list', () => {
    expect(() => toPistonFiles(project([{ path: 'main.js', content: 'a' }], 'other.js'))).toThrow();
  });

  it('refuses a file over the size limit', () => {
    expect(() =>
      toPistonFiles(project([{ path: 'main.js', content: 'x'.repeat(MAX_FILE_BYTES + 1) }])),
    ).toThrow(/exceeds/);
  });
});
