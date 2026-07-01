import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { devMiddleware } from './scripts/dev-middleware.mjs';

// Mounts the ported dev.mjs endpoints (/_status, /_reset, /_carts.json,
// /_clear) and the alias file surface (/player/, /carts/, ...) ahead of
// Vite's own handling.
const devEndpoints = {
  name: 'css-dos-dev-endpoints',
  configureServer(server) {
    server.middlewares.use(devMiddleware);
  },
};

export default defineConfig({
  plugins: [svelte(), devEndpoints],
  server: {
    port: 5173,
    // Cross-origin isolation on every response (SharedArrayBuffer path).
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Resource-Policy': 'same-origin',
    },
  },
  build: { outDir: 'dist', emptyOutDir: true },
});
