import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import Icons from 'unplugin-icons/vite';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  readFileSync, mkdirSync, writeFileSync, cpSync, existsSync,
} from 'node:fs';
import {
  RUNTIME_COPIES, transformRuntimeFile, resolveRuntimeUrl,
  cartsIndex, COI_HEADERS, mimeFor,
} from './scripts/runtime-assets.mjs';
import {
  resolveDevAlias, statusSnapshot, resetEverything, CLEAR_PAGE,
} from './scripts/dev-extras.mjs';

const here = fileURLToPath(new URL('.', import.meta.url));
const webRoot = resolve(here, '..');
const repoRoot = resolve(webRoot, '..');
const calciteRoot = process.env.CALCITE_REPO
  ? resolve(process.env.CALCITE_REPO)
  : resolve(repoRoot, '..', 'calcite');

// DEV: serve the runtime files off disk at their URL paths (same paths prod
// copies into dist/), plus the dev-only surfaces and endpoints that used to
// live in the retired web/scripts/dev.mjs - Vite is the ONE dev server:
//   - RUNTIME_COPIES paths (shared with prod)
//   - DEV_ALIASES paths (bench, calcite dev pages, web tests, tmp - dev only)
//   - /_status, /_reset, /_clear (cache-layer killers, see docs/rebuild-when.md)
//   - /carts/index.json (+ legacy /_carts.json alias for build.html)
// Anything not matched falls through to Vite (the Svelte site, HMR, publicDir).
const devRuntime = {
  name: 'css-dos-dev-runtime',
  apply: 'serve',
  configureServer(server) {
    // The calcite pkg dir actually being served (vendored or sibling) -
    // taken from the same table that serves it, so /_status can't lie.
    const servedPkgDir = RUNTIME_COPIES.find(([p]) => p === '/calcite/pkg')[1];
    server.middlewares.use((req, res, next) => {
      const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      const json = (code, obj) => {
        res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...COI_HEADERS });
        return res.end(JSON.stringify(obj, null, 2));
      };
      if (urlPath === '/_status') return json(200, statusSnapshot(servedPkgDir));
      if (urlPath === '/_reset') {
        const result = resetEverything(servedPkgDir);
        return json(result.steps.every(s => s.ok !== false) ? 200 : 500, result);
      }
      if (urlPath === '/_clear') {
        res.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-store', ...COI_HEADERS });
        return res.end(CLEAR_PAGE);
      }
      if (urlPath === '/carts/index.json' || urlPath === '/_carts.json') {
        return json(200, cartsIndex());
      }
      const file = resolveRuntimeUrl(urlPath) ?? resolveDevAlias(urlPath);
      if (!file) return next();
      res.writeHead(200, { 'Content-Type': mimeFor(file), 'Cache-Control': 'no-store', ...COI_HEADERS });
      return res.end(transformRuntimeFile(file, readFileSync(file)));
    });
  },
};

// PROD: copy the runtime files into dist/, emit carts/index.json, and emit
// the host header config (COOP/COEP - optional; nothing in the live path
// needs SharedArrayBuffer, kept for a possible future wasm-threads path).
const buildRuntime = {
  name: 'css-dos-build-runtime',
  apply: 'build',
  closeBundle() {
    const dist = resolve(here, 'dist');
    for (const [urlPath, srcDir] of RUNTIME_COPIES) {
      if (!existsSync(srcDir)) { this.warn(`runtime source missing, skipped: ${srcDir}`); continue; }
      const dest = join(dist, urlPath);
      mkdirSync(resolve(dest, '..'), { recursive: true });
      cpSync(srcDir, dest, {
        recursive: true,
        filter: (src) => !src.endsWith('.d.ts'),
      });
    }
    // Strip the shebang from the copied mkfat12 so the browser can import it.
    const mkfat = join(dist, 'tools', 'mkfat12.mjs');
    if (existsSync(mkfat)) writeFileSync(mkfat, transformRuntimeFile(mkfat, readFileSync(mkfat)));

    writeFileSync(join(dist, 'carts', 'index.json'), JSON.stringify(cartsIndex()));

    // vercel.json lives TRACKED at web/site/vercel.json - Vercel only
    // reads it from the project root directory at deploy start, never
    // from the build output (lesson of the 2026-07-14 /about/faqs 404).
    // Copied into dist/ too so a prebuilt-dist deploy behaves the same.
    // It holds the COOP/COEP headers and the SPA fallback rewrite the
    // real-path router needs (any path not matching a static file -
    // carts/, player/, calcite/ etc. win first - serves index.html).
    cpSync(resolve(here, 'vercel.json'), join(dist, 'vercel.json'));
    // Netlify / Cloudflare Pages fallback (headers + SPA rewrite).
    writeFileSync(join(dist, '_headers'),
      '/*\n  Cross-Origin-Opener-Policy: same-origin\n  Cross-Origin-Embedder-Policy: require-corp\n');
    writeFileSync(join(dist, '_redirects'), '/*  /index.html  200\n');

    this.info('staged runtime assets, carts/index.json, and host headers into dist/');
  },
};

// builder.svelte.js imports the browser-builder graph as native ESM by its
// runtime URL (/browser-builder/main.mjs). It is NOT bundled - it's copied
// into dist/ and resolved by the browser at runtime. Mark it external so
// Rollup emits the import verbatim instead of following into the shebang'd,
// CLI-shaped source graph. enforce:'pre' runs before Vite's own resolution.
const externalRuntimeBuilder = {
  name: 'css-dos-external-runtime-builder',
  enforce: 'pre',
  resolveId(id) {
    if (id.startsWith('/browser-builder/')) return { id, external: true };
  },
};

export default defineConfig({
  plugins: [svelte(), Icons({ compiler: 'svelte' }), externalRuntimeBuilder, devRuntime, buildRuntime],
  server: {
    // PORT env wins so harnesses (preview tools, parallel agents) can pin
    // a free port; humans keep the 5173 default.
    port: Number(process.env.PORT) || 5173,
    fs: { allow: [repoRoot, calciteRoot] },
    headers: COI_HEADERS,
  },
  build: { outDir: 'dist', emptyOutDir: true },
});
