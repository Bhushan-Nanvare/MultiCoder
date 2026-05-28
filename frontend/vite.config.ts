import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
  plugins: [
    react(),
    // ShareDB's browser client relies on Node built-ins (util.inherits,
    // EventEmitter from events, stream, buffer). Vite doesn't polyfill these
    // in production builds, so pull them in explicitly.
    nodePolyfills({
      include: ['util', 'events', 'stream', 'buffer', 'process'],
      globals: { Buffer: true, process: true },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
