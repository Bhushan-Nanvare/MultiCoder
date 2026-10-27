import { describe, expect, it } from 'vitest';
import { GITHUB_IMPORT_MAX_TOTAL_BYTES, MAX_FILES_PER_ROOM, MAX_FILE_BYTES } from '@/constants/index.js';
import type { GithubTreeEntry } from '@/github/githubClient.js';
import {
  buildProjectFromFiles,
  chooseEntryPoint,
  isProbablyText,
  selectImportableEntries,
} from '@/github/repoProject.js';

const entry = (overrides: Partial<GithubTreeEntry> & { path: string }): GithubTreeEntry => ({
  type: 'blob',
  sha: 'sha',
  size: 10,
  ...overrides,
});

describe('selectImportableEntries', () => {
  it('keeps text blobs and drops directories', () => {
    const selected = selectImportableEntries([
      entry({ path: 'src', type: 'tree' }),
      entry({ path: 'src/index.js' }),
    ]);
    expect(selected.map((item) => item.path)).toEqual(['src/index.js']);
  });

  it('drops binaries by extension', () => {
    const selected = selectImportableEntries([
      entry({ path: 'logo.png' }),
      entry({ path: 'bundle.zip' }),
      entry({ path: 'readme.md' }),
    ]);
    expect(selected.map((item) => item.path)).toEqual(['readme.md']);
  });

  it('drops files above the per-file limit', () => {
    const selected = selectImportableEntries([
      entry({ path: 'big.js', size: MAX_FILE_BYTES + 1 }),
      entry({ path: 'small.js', size: MAX_FILE_BYTES }),
    ]);
    expect(selected.map((item) => item.path)).toEqual(['small.js']);
  });

  it('drops paths that escape the project', () => {
    const selected = selectImportableEntries([
      entry({ path: '../etc/passwd' }),
      entry({ path: 'ok.js' }),
    ]);
    expect(selected.map((item) => item.path)).toEqual(['ok.js']);
  });

  it('caps the number of files', () => {
    const many = Array.from({ length: MAX_FILES_PER_ROOM + 10 }, (_, index) =>
      entry({ path: `file${String(index).padStart(3, '0')}.js` }),
    );
    expect(selectImportableEntries(many)).toHaveLength(MAX_FILES_PER_ROOM);
  });
});

describe('isProbablyText', () => {
  it('accepts utf8 source', () => {
    expect(isProbablyText(Buffer.from('const a = 1;\n'))).toBe(true);
  });

  it('rejects content with a null byte', () => {
    expect(isProbablyText(Buffer.from([0x50, 0x00, 0x4b]))).toBe(false);
  });
});

describe('chooseEntryPoint', () => {
  it('prefers the language default at the root', () => {
    expect(chooseEntryPoint(['lib/util.js', 'main.js'], 'javascript')).toBe('main.js');
  });

  it('falls back to a nested file of the same name', () => {
    expect(chooseEntryPoint(['src/main.py', 'src/util.py'], 'python')).toBe('src/main.py');
  });

  it('falls back to the first file matching the language', () => {
    expect(chooseEntryPoint(['README.md', 'app.py'], 'python')).toBe('app.py');
  });

  it('falls back to the first file when nothing matches', () => {
    expect(chooseEntryPoint(['README.md'], 'cpp')).toBe('README.md');
  });
});

describe('buildProjectFromFiles', () => {
  it('builds a v2 project with every file', () => {
    const project = buildProjectFromFiles(
      [
        { path: 'main.js', content: 'run()' },
        { path: 'src/util.js', content: 'export const a = 1;' },
      ],
      'javascript',
    );
    expect(project.version).toBe(2);
    expect(project.entryPoint).toBe('main.js');
    expect(Object.keys(project.files).sort()).toEqual(['main.js', 'src/util.js']);
  });

  it('refuses a repository with nothing importable', () => {
    expect(() => buildProjectFromFiles([], 'javascript')).toThrow(/importable/);
  });

  it('refuses a repository above the total size limit', () => {
    const content = 'x'.repeat(GITHUB_IMPORT_MAX_TOTAL_BYTES);
    expect(() =>
      buildProjectFromFiles(
        [
          { path: 'a.js', content },
          { path: 'b.js', content },
        ],
        'javascript',
      ),
    ).toThrow(/import limit/);
  });
});
