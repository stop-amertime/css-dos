# Public-presentation cleanup sweep

**2026-06-29 · LANDED · branch `cleanup/public-presentation`**

Acting on a prior audit survey (the detailed sub-agent notes weren't
recoverable; the synthesized survey was the working record). Verified
every item against code before changing it; several survey items were
refined or corrected. Seven commits.

- **Personal-path leaks (the embarrassing ones).** Hardcoded home dirs
  for two usernames removed: NASM path (`Ahmed Amer`) in
  `builder/stages/bios.mjs`, `bios/corduroy/toolchain.env`,
  `conformance/ref-muslin.mjs` → resolve `nasm` from PATH (NASM env
  override kept). Playwright npx-cache fallback (`AdmT9N0CX01V65438A`)
  in bench driver + 3 web test/probe scripts → read `PLAYWRIGHT_DIR`.
  `.mcp.json` absolute path → `../calcite` relative. `baseline.json`
  absolute `cabinet` field → basename. Same NASM scrub in `legacy/`.
- **Dead/broken scripts.** Deleted orphan `tests/harness/fb-pack-diff.mjs`
  and bit-rotted `conformance/ref-muslin.mjs` (assembled a BIOS now in
  `legacy/`, read a never-committed `dos/disk.img`, contradicted its
  README) - README fixed to point full-DOS conformance at
  `pipeline.mjs fulldiff`.
- **Stale cart refs.** `web/site/assets/carts.js` stopped advertising
  deleted carts (digger/lemmings/montezuma) + fixed `rogue`→`rogue1_0`;
  `tests/bench/lib/artifacts.mjs` dropped montezuma + mis-pathed
  hello-text registrations. (Found `carts/sokoban` has files but no
  `program.json` while the manifest lists it - spun off as a task.)
- **Noisy dev docs.** Gitignored `docs/benches/` (48 raw JSONs, kept on
  disk); removed AI-agent-prompt + session-handoff cruft from
  `docs/archive/`, kept the INDEX-vouched dated design specs.
- **Stale `transpiler/` refs** (dir renamed to `kiln/`) fixed in
  AGENT-GUIDE, template.mjs, bios-handlers.mjs, three `tests/*.asm`
  headers; rename-history mentions left intact.
- **Web honesty.** "no menus drop down yet" comments reworded;
  dangling `VSYNC-PLAN.md` refs dropped (×4); bridge canary
  `v48-pseudo-input-restored` → `bridge-1`.
- **Doc contradictions vs code.** Write-slot count 6→**3** (word-slot
  scheme, `NUM_WRITE_SLOTS=3`) in CLAUDE.md/AGENT-GUIDE/kiln README/
  memory-layout; architecture.md "Four"→"Five stages"; cart-format
  Corduroy "Experimental"→default (Muslin = alt); corduroy README
  Status corrected.
- **Dead code.** Removed 6 zero-ref emitters (unpacked path) from
  `kiln/memory.mjs`, a ghost JSDoc in emit-css.mjs, the no-op
  `--dump-slots` flag in tools/compare.mjs.

**Verified:** kiln builds a cabinet; `run.mjs smoke` 6/6 after the
dead-code removal. Branch not yet merged to master.

**Follow-ups (tasks spawned):** sokoban program.json; DRY
REG16/SPLIT_REGS across kiln pattern files (only if emit stays
byte-identical).
