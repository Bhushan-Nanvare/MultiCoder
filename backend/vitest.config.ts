import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // Source files import as `@/foo/bar.js` (NodeNext ESM needs the extension),
    // so strip it before pointing at src/ and let Vite resolve the .ts file.
    alias: [
      { find: /^@\/(.*)\.js$/, replacement: path.resolve(__dirname, 'src/$1') },
      { find: /^@\//, replacement: `${path.resolve(__dirname, 'src')}/` },
    ],
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
