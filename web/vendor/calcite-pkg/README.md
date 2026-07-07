# Vendored calcite WASM

Prebuilt calcite WASM bundle so CSS-DOS runs **without the calcite repo or a
Rust toolchain**. A plain user clones CSS-DOS, starts the dev server, and it
works — this is the artifact that makes that possible.

- **Built from calcite commit:** `2f0d012` (rep Copy per-tick fallback;
  includes the writable packed-cell window backing `a44d2ab` — required
  by writable cabinets like msdos4/dos-shell)
- **Build note (2026-07-07):** this cut was made with `wasm-bindgen`
  0.2.126 directly, **without wasm-opt** (~889 KB instead of ~770 KB) —
  the build host only had binaryen 108, whose wasm-opt corrupts the
  funcref table limits (`WebAssembly.Table.grow(): failed to grow table
  by 4` at boot). A wasm-pack re-cut with a current binaryen is a safe
  follow-up if the size/perf delta matters.
- **Served at:** `/calcite/pkg/` by the dev server, *unless* a built sibling
  calcite repo is present (see `web/scripts/dev.mjs` → `resolveCalcitePkgDir`).

## When to re-vendor

Re-vendor when you ship a calcite change that CSS-DOS users should get. From a
built calcite repo (`wasm-pack build crates/calcite-wasm --target web
--out-dir <abs>/web/pkg --release`):

```sh
cp ../calcite/web/pkg/calcite_wasm.js          web/vendor/calcite-pkg/
cp ../calcite/web/pkg/calcite_wasm_bg.wasm     web/vendor/calcite-pkg/
cp ../calcite/web/pkg/calcite_wasm.d.ts        web/vendor/calcite-pkg/
cp ../calcite/web/pkg/calcite_wasm_bg.wasm.d.ts web/vendor/calcite-pkg/
cp ../calcite/web/pkg/package.json             web/vendor/calcite-pkg/
```

Then update the commit hash above. ~770 KB; plain git, no LFS needed.

## Note for calcite hackers

If you have the calcite repo (`../calcite` with a built `web/pkg`, or
`CALCITE_REPO` set), the dev server serves *that* freshly-built WASM instead,
so your edits take effect without touching this vendored copy.
