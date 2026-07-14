## 2026-05-05 - calcite-genericity cleanup: tasks 1-4 of the audit list

Worked through the post-keyboard "make calcite not cheat" list (LOGBOOK
2026-05-05 line 271-278). Four of five items landed; the fifth is its
own mission, deferred.

**Task 1: delete `column_drawer_fast_forward`.**
Off by default since 2026-04-29 (net perf loss; doom-specific 21-byte
ROM body recogniser, fired 159 times across a 35M-tick run). Removed
the function, its `FusionDiag` thread-local funnel, the
`CALCITE_FUSION_FASTFWD` and `CALCITE_FUSION_DIAG` env-var gates, and
the `rom_match` helper from `crates/calcite-core/src/compile.rs`.
Stripped the corresponding `fusion_diag_enable` /
`fusion_diag_snapshot` / `fusion_fire_count` plumbing from
`crates/calcite-cli/src/main.rs`. Smoke 7/7 PASS pre and post.

**Task 2: move `summary.rs` out of `calcite-core`.**
Per-tick event log + block segmenter for execution diagnostics - every
field name (CS/IP/opcode/_irqActive) was upstream-aware. New crate
`calcite-debug-summary` (lib, depends on calcite-core), registered in
the workspace `Cargo.toml` and as a workspace dependency. The
`calcite-debugger` consumer was migrated from
`calcite_core::summary::*` to `calcite_debug_summary::*`. The
calcite-core integration test for summary moved to a new test in the
new crate (and updated to bootstrap `State` via `parse_css` +
`load_properties` rather than poking the `pub(crate) state_var_index`
directly). 5 unit tests + 1 integration test green; smoke 7/7 PASS.

**Task 3: move CGA renderer + CP437 + DAC palette out of `calcite-core`.**
`State::render_screen` / `render_screen_ansi` / `render_screen_html` /
`render_framebuffer` / `read_framebuffer_rgba` / `read_video_memory`,
the `CGA_PALETTE` and `VGA_DAC_LINEAR` constants, and the
`cp437_to_unicode` helper all baked PC-video conventions into the
engine crate. New crate `calcite-pc-video` (lib, depends on
calcite-core) re-hosts them as free functions taking `&State`.
Consumers migrated: calcite-wasm (its `pub fn render_screen` /
`render_framebuffer` / `read_framebuffer_rgba` / `read_video_memory`
methods now delegate to the new crate, and the wasm public surface is
unchanged), calcite-cli (CGA palette + render_screen_ansi +
render_framebuffer call sites), calcite-debugger (its
`Session::render_screen` helper). Wasm rebuilt via `wasm-pack build
crates/calcite-wasm --target web --out-dir ../../web/pkg --release` so
the JS bindings reflect the new build. Smoke 7/7 PASS.

**Task 4: strip doom/DOS comments from non-test calcite-core code.**
Surgical comment pass - converted `doom8088`/`DOOM`/`x86CSS`/`CSS-DOS`
references in production-path comments to generic phrasings ("the
reference cabinet", "measured cabinets", "the cabinet's bytecode").
Kept calibration citations where they're load-bearing context (e.g.
"95% of all such pairs in the reference cabinet") and didn't touch
test code or comments inside `rep_fast_forward` (those describe real
cardinal-rule violations the *code* makes; reframing them in comments
without fixing the code would just hide the issue - see task 5).
Files touched: lib.rs, compile.rs, eval.rs, conformance.rs,
parser/fast_path.rs, pattern/broadcast_write.rs, pattern/byte_period.rs,
pattern/fusion_sim.rs, pattern/packed_broadcast_write.rs. Comment-only;
calcite-core builds clean.

**Task 5: reframe `rep_fast_forward` as a generic CSS-shape recogniser
- DEFERRED.**

This is the audit's "perf-gated mission" item, not a quick refactor.
The function (~341 lines + helpers in calcite-core/src/compile.rs)
inspects an x86 string-op opcode latch (`--opcode` ∈ {0xA4, 0xA5,
0xAA, 0xAB, 0xA6, 0xA7, 0xAE, 0xAF}), decodes 8086 REPE/REPNE
semantics, segment overrides, the direction flag, and bulk-applies CX
iterations. It also encodes a list of "virtual" memory regions
(0x0500-0x0502 keyboard bridge, 0xD0000-0xD0200 ROM-disk,
0xF0000-0x100000 BIOS ROM) that the bulk path mustn't trample, and
panics if it would. None of that knowledge is derivable from CSS
shape - it's pure upstream awareness encoded in the engine.

Generalising means recognising "function repeats body N times,
incrementing/decrementing addr, until counter hits 0" as a CSS shape
without ever spelling 0xA4. That's the design the affine-loop
fastforward plan (`docs/plans/2026-05-01-affine-loop-fastforward.md`)
already sketches for non-REP loops, but applying it to REP requires:
(a) detecting the shape at compile time keyed off the function name
the cabinet uses, (b) deriving the (init, step, terminator) tuple
from the body, (c) replacing the hardcoded x86 flag-word semantics
with whatever the body says, (d) replacing the hardcoded
virtual-region check with a generic "this address falls outside the
bulk-writable range" predicate driven by the address-map's dispatch
exceptions. Plus the perf gate - doom8088 web+CLI must stay within 1%
of current.

Multi-session work. Punted to its own brief.
