import JSZip from 'jszip';
import type { ProjectFile } from '@/types/room';

export function projectZipFilename(roomName: string, roomId: string): string {
  const slug = roomName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${slug || 'project'}-${roomId}.zip`;
}

// Returns bytes rather than a Blob so the archive can be built and asserted on
// outside a browser.
export async function buildProjectArchive(
  files: Record<string, ProjectFile>,
): Promise<Uint8Array> {
  const paths = Object.keys(files).sort();
  if (paths.length === 0) {
    throw new Error('Nothing to export — this project has no files.');
  }

  const zip = new JSZip();
  for (const path of paths) {
    zip.file(path, files[path]?.content ?? '');
  }
  return zip.generateAsync({ type: 'uint8array' });
}

export function downloadArchive(bytes: Uint8Array, filename: string): void {
  // Copied so the Blob is backed by a plain ArrayBuffer; a view over a
  // SharedArrayBuffer is not a valid BlobPart.
  const blob = new Blob([new Uint8Array(bytes)], { type: 'application/zip' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
