import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  test: {
    // The binding is driven through a fake Monaco model, so no DOM is needed.
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
