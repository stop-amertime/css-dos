# Vendored calcite WASM

Prebuilt calcite WASM bundle so CSS-DOS runs **without the calcite repo or a
Rust toolchain**. A plain user clones CSS-DOS, starts the dev server, and it
works — this is the artifact that makes that possible.

- **Built from calcite commit:** `4bad19e` (perf improvements)
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
