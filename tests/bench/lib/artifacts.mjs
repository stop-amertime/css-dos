// artifacts.mjs — declarative manifest of every built artifact in CSS-DOS.
//
// The single source of truth that ensureFresh consults. Each entry says:
// "here's an artifact, here are its inputs, here's how to rebuild it."
// Consumers (bench harness, smoke runner, dev server) call
// `ensureArtifact(name)` and get back a fresh, ready-to-read absolute path.
//
// Adding a new artifact: add an entry here. The dependency is declared,
// the rebuild is automatic, and staleness is detected by mtime — no
// more "the agent forgot to run prebake.mjs after editing bios/corduroy/."
//
// Naming: `<scope>:<name>` where scope is one of `cabinet`, `prebake`,
// `wasm`, `cli`. Artifacts can declare other artifacts as inputs
// (transitive deps) — `cabinet:doom8088` depending on `prebake:corduroy`
// is the canonical example.

import { registerArtifact } from './ensure-fresh.mjs';

// `../calcite/` works for the main CSS-DOS checkout but not for git
// worktrees: from `.claude/worktrees/<name>/`, `../calcite/` resolves
// to `.claude/worktrees/calcite/` (a sibling worktree, possibly on a
// different branch — usually the wrong calcite). Honour `CALCITE_REPO`
// to pick the right one. Default keeps the legacy main-checkout behaviour.
const CALCITE_REPO = process.env.CALCITE_REPO || '../calcite';

// --- Calcite WASM (used by the web bench / player) ---
registerArtifact({
  name:    'wasm:calcite',
  output:  `${CALCITE_REPO}/web/pkg/calcite_wasm_bg.wasm`,
  inputs:  [
    `${CALCITE_REPO}/crates/calcite-core/src/**`,
    `${CALCITE_REPO}/crates/calcite-core/Cargo.toml`,
    `${CALCITE_REPO}/crates/calcite-wasm/src/**`,
    `${CALCITE_REPO}/crates/calcite-wasm/Cargo.toml`,
    `${CALCITE_REPO}/Cargo.toml`,
  ],
  rebuild: `wasm-pack build "${CALCITE_REPO}/crates/calcite-wasm" --target web --out-dir ../../web/pkg --release`,
});

// --- Calcite native CLI (used by the CLI bench path) ---
//
// Build runs in the calcite directory directly — invoking cargo with
// --manifest-path from outside triggers a different build context that
// on Windows-bash produced link.exe argument-mangling errors. Running
// cargo from inside the calcite repo avoids it.
registerArtifact({
  name:    'cli:calcite',
  output:  `${CALCITE_REPO}/target/release/calcite-cli.exe`,
  inputs:  [
    `${CALCITE_REPO}/crates/calcite-core/src/**`,
    `${CALCITE_REPO}/crates/calcite-core/Cargo.toml`,
    `${CALCITE_REPO}/crates/calcite-cli/src/**`,
    `${CALCITE_REPO}/crates/calcite-cli/Cargo.toml`,
    `${CALCITE_REPO}/Cargo.toml`,
  ],
  rebuild: `cd "${CALCITE_REPO}" && cargo build --release -p calcite-cli`,
});

// --- BIOS prebake binaries (browser-side build path reads these) ---
registerArtifact({
  name:    'prebake:corduroy',
  output:  'web/prebake/corduroy.bin',
  inputs:  ['bios/corduroy/**', 'web/scripts/prebake.mjs'],
  rebuild: 'node web/scripts/prebake.mjs corduroy',
});
registerArtifact({
  name:    'prebake:gossamer',
  output:  'web/prebake/gossamer.bin',
  inputs:  ['bios/gossamer/**', 'web/scripts/prebake.mjs'],
  rebuild: 'node web/scripts/prebake.mjs gossamer',
});
registerArtifact({
  name:    'prebake:muslin',
  output:  'web/prebake/muslin.bin',
  inputs:  ['bios/muslin/**', 'web/scripts/prebake.mjs'],
  rebuild: 'node web/scripts/prebake.mjs muslin',
});

// --- Cabinets (built from carts; depend on cart files + kiln + builder
// + the BIOS prebake the cart's preset uses) ---
//
// Each cabinet lives in tests/bench/cache/, gitignored, ephemeral.
function cabinet(cartName, opts = {}) {
  const preset = opts.preset || 'corduroy';
  registerArtifact({
    name:    `cabinet:${cartName}`,
    output:  `tests/bench/cache/${cartName}.css`,
    inputs:  [
      `carts/${cartName}/**`,
      'kiln/**',
      'builder/**',
      `prebake:${preset}`,
    ],
    rebuild: `node builder/build.mjs carts/${cartName} -o tests/bench/cache/${cartName}.css`,
  });
}

cabinet('doom8088');
cabinet('zork1');
cabinet('montezuma');
cabinet('hello-text');

// Re-export the convenience helper so callers can do a single import.
export { ensureArtifact } from './ensure-fresh.mjs';
