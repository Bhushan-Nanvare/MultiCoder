import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { buildProjectArchive, projectZipFilename } from '@/project/exportZip';

const project = {
  'main.js': { content: "console.log('hi')" },
  'src/util.js': { content: 'export const add = (a, b) => a + b;' },
  'empty.txt': { content: '' },
};

describe('buildProjectArchive', () => {
  it('round-trips every file, nested paths included', async () => {
    const zip = await JSZip.loadAsync(await buildProjectArchive(project));
    // JSZip adds an implicit `src/` folder entry, which is not a file.
    const paths = Object.keys(zip.files).filter((path) => !zip.files[path]?.dir);
    expect(paths.sort()).toEqual(['empty.txt', 'main.js', 'src/util.js']);
    expect(await zip.file('main.js')?.async('string')).toBe("console.log('hi')");
    expect(await zip.file('src/util.js')?.async('string')).toBe('export const add = (a, b) => a + b;');
    expect(await zip.file('empty.txt')?.async('string')).toBe('');
  });

  it('refuses to build an empty archive', async () => {
    await expect(buildProjectArchive({})).rejects.toThrow(/no files/);
  });
});

describe('projectZipFilename', () => {
  it('slugifies the room name and keeps the id', () => {
    expect(projectZipFilename('My Room 2!', 'aB3dE')).toBe('my-room-2-aB3dE.zip');
  });

  it('falls back when the name has nothing usable', () => {
    expect(projectZipFilename('   ***   ', 'aB3dE')).toBe('project-aB3dE.zip');
  });
});
