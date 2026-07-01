import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { devMiddleware } from './scripts/dev-middleware.mjs';

const here = fileURLToPath(new URL('.', import.meta.url));
const webRoot = resolve(here, '..');        // web/
const repoRoot = resolve(webRoot, '..');    // repo root

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
  resolve: {
    alias: {
      // The browser builder lives outside the site root; its own imports
      // are relative (../../builder, ../../tools), so aliasing the entry
      // dir is enough for Vite to resolve the whole graph on disk.
      '/browser-builder': resolve(webRoot, 'browser-builder'),
    },
  },
  server: {
    port: 5173,
    // browser-builder + its relative imports reach up into builder/ and
    // tools/, outside the Vite root — allow serving from the repo root.
    fs: { allow: [repoRoot] },
    // Cross-origin isolation on every response (SharedArrayBuffer path).
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Resource-Policy': 'same-origin',
    },
  },
  build: { outDir: 'dist', emptyOutDir: true },
});
