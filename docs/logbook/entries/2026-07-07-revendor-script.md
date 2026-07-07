# 2026-07-07 — `npm run revendor`: scripted vendor sync + mismatch warnings

Follow-up to the websmoke gate (owner: "why store two copies with a
manual cp-block?"). The vendored bundle stays — it's what lets a plain
clone run with no Rust toolchain and pins the shipped engine as a
reviewable commit — but the sync is now one command.
`web/scripts/revendor-calcite.mjs` (`npm run revendor`): copies the
sibling `../calcite/web/pkg` into `web/vendor/calcite-pkg/`
(`--build` runs wasm-pack first), stamps `VENDOR-INFO.json`
(calcite commit, dirty flag, date, per-file sha256 — provenance is
machine-readable now, not README prose), then runs websmoke and
**fails if the new bundle doesn't boot**. Plus: both dev servers and
the site's prod-dist copy path (`runtime-assets.mjs` `calcitePkgDir`)
now WARN when the sibling pkg being served/shipped differs by hash
from the vendored bundle — the exact test-one-engine/ship-another
split that let the 2026-07-07 breakage go unnoticed. Verified:
revendor end-to-end (stamp + websmoke 3/3 PASS); both warnings fire
on a fabricated differing sibling and stay silent on a matching one.
