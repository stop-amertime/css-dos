# Vendored calcite WASM

Prebuilt calcite WASM bundle so CSS-DOS runs **without the calcite repo or a
Rust toolchain**. A plain user clones CSS-DOS, starts the dev server, and it
works - this is the artifact that makes that possible.

- **Built from calcite commit:** see [`VENDOR-INFO.json`](VENDOR-INFO.json)
  (machine-readable provenance - commit, dirty flag, date, file hashes -
  stamped by `npm run revendor`).
- **Build note (2026-07-07):** the current cut was made with
  `wasm-bindgen` 0.2.126 directly, **without wasm-opt** (~889 KB instead
  of ~770 KB) - the build host only had binaryen 108, whose wasm-opt
  corrupts the funcref table limits (`WebAssembly.Table.grow(): failed
  to grow table by 4` at boot). A wasm-pack re-cut with a current
  binaryen is a safe follow-up if the size/perf delta matters.
- **Served at:** `/calcite/pkg/` by the dev server, *unless* a built sibling
  calcite repo is present (see `web/site/scripts/runtime-assets.mjs` →
  `calcitePkgDir`).

## When to re-vendor

Re-vendor when you ship a calcite change that CSS-DOS users should get
- one command:

```sh
npm run revendor              # copy sibling pkg -> here, stamp VENDOR-INFO.json,
                              # then run websmoke against the new bundle
npm run revendor -- --build   # wasm-pack build the pkg first
```

The script fails if websmoke fails, so a bundle that doesn't boot real
cabinets can't be vendored by accident. websmoke is the only gate that
executes this bundle (all other gates drive calcite-cli). Commit the
resulting bundle + `VENDOR-INFO.json` (~1 MB; plain git, no LFS).
`package.json` here is CSS-DOS-owned and not copied from the pkg.

Both dev servers and the site's prod build warn when a sibling
`../calcite/web/pkg` is being served/shipped whose engine differs from
this vendored bundle - that split (testing one engine, shipping
another) is how the 2026-07-07 site breakage went unnoticed.

## Note for calcite hackers

If you have the calcite repo (`../calcite` with a built `web/pkg`, or
`CALCITE_REPO` set), the dev server serves *that* freshly-built WASM instead,
so your edits take effect without touching this vendored copy.
