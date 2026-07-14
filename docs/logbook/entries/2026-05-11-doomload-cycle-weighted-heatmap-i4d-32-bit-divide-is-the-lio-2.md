> **INTERPRETATION CORRECTED 2026-06-09:** cycle-weighting answers
> "where do guest cycles go", not "where does calcite wall go" - wall
> follows ticks. By tick-share (verified against the burst samples,
> no aliasing artefact): kernel 0x55 = 48.6%, `__I4D` = 22.3%. The
> raw data, LOAD_SEG resolution and pipeline notes below remain
> valid. See `2026-06-09-doomload-tick-weighted-heatmap-kernel-is-the-lion.md`.

## 2026-05-11 - doomLoad cycle-weighted heatmap: `__I4D` (32-bit divide) is the lion

**Measurement.** Added a `cycles` column to calcite-cli's
`--sample-cs-ip` output (reads the cabinet's `cycleCount` state-var
at sample time). Cold-boot `tests/bench/cache/doom8088.css` with
`--sample-cs-ip=600,1000,100`, halt-on-ingame watches, filtered to
the loading window (tick 4.6M–34M) → `tmp/sampler/load-window.csv`.

Cross-check: count-weighted segment heatmap (what the old "67.8 %
segment 0x55" number used) vs cycle-weighted (sum of cycleCount
deltas per `(CS)` bucket from wide singles). Total cycles in
window 938 M reconciles with `cycleCount` end-minus-start. Top by
cycles:

| Segment | cycles% | count% | Resolved to |
|---|---:|---:|---|
| **0x2D96** | **46.1 %** | 22.3 % | **Watcom `__I4D` - 32-bit signed integer divide** (libc helper, 0xD3 = 211 bytes). |
| **0x26EF** | **24.2 %** | 5.3 %  | **`r_draw_TEXT` at offset 0xBB6** - column/span renderer inner loops. |
| 0x55       | 17.6 %    | 48.6 % | EDR-DOS kernel (below DOOM LOAD_SEG). "67.8 %" claim was a count-weighted sampling artefact. |
| 0x2BC2     | 5.3 %     | 9.2 %  | `st_stuff_TEXT` - status bar drawing. |
| 0x1122     | 2.1 %     | 7.3 %  | Below DOOM LOAD_SEG - EDR-DOS / DOS area. |

**How segments were resolved.** DOOM8088 source is at
`../Doom8088/`; Watcom map at `../Doom8088/WC16/DOOM16WC.map`
(map 2026-04-25 19:36, cart EXE 2026-04-26 00:36 - same build
day). LOAD_SEG derived from a known landmark: CS=0x2D96 has hot
IPs 0x27–0x53; map shows `i4d` at link-relative offset 0x16948
(paragraph 0x1694, offset 0x08 within the `0fd5:` code group).
So **LOAD_SEG = 0x2D96 − 0x1694 = 0x1702**. Verified: every
other hot CS maps cleanly into a named map segment with this
constant.

Formula for any CS:IP from this run:
```
link_relative_linear = (CS − 0x1702) × 16 + IP
```
Then find the `_TEXT` segment in the map whose
`[base, base+size)` contains that linear. Symbols inside each
segment are listed lower in the map.

**Shape of the lion (`__I4D`).** IPs 0x27–0x53 hit roughly
equally (top 20 IPs all 2.0–2.7 % each). That's the bit-shift
loop body inside the divide routine - 8086's `DIV` is only
16-bit, so 32-bit signed division is a software bit-loop of
~32–33 iterations over a ~6–10-byte body. The flat histogram
across ~45 bytes of IP space is exactly that body cycling.
Standard SAR/SHR/SBB long-divide algorithm (Watcom's
`clibm.lib(i4d)` per the map header).

**Why DOOM divides so much during level-load.** Fixed-point
math: BSP traversal, line-segment intersections, BBox clipping,
`divline_t` computations in `p_setup.c` / `p_maputl.c` /
`p_sight.c`. Any `fixed_t / fixed_t` (or wider-than-16-bit
divisor) compiles to a `__I4D` call. **Not** the zone walk the
perf doc speculated.

**Three corrections to the perf docs:**

1. Segment 0x55 is **not** 67.8 % of doomLoad - that was the
   *count* of samples, not weighted by cycles. By cycles it's
   17.6 %, and it's **EDR-DOS kernel**, not "DOOM zone-walk".
2. Segment 0x2D96 is **not** "Corduroy BIOS dispatch" - Corduroy
   is at runtime F000. It's `__I4D`.
3. The biggest single doomLoad optimisation target is **the libc
   divide routine**, not DOOM application code, not BIOS, not
   zone allocation.

**Why `__I4D` is a strong target.**
- Tiny (211 bytes), fixed routine, called from many sites.
- Inner-loop body matches the affine-loop fast-forward plan's
  shape: deterministic per-iter side effects, counter-bounded
  exit.
- Cardinal-rule-clean: a calcite recogniser for "tight
  bit-shift self-loop with counter exit" would fire on any
  other libc's 32-bit divide on any cabinet - no DOOM- or
  Watcom-specific knowledge needed.
- Alternative: whole-function semantic substitution.
  Pattern-recognise the 211-byte routine's CSS body as a unit,
  substitute one host i32 `idiv`. Much higher payoff per byte
  of matched code, narrower applicability. The recogniser would
  still read only CSS-shape facts (no x86 / DOOM knowledge).

**`r_draw` (24 %).** Previous `column_drawer_fast_forward`
attempt (deleted 2026-05-05) targeted this exact code. Failed
because per-tick detection cost exceeded savings. The
affine-loop plan's compile-time-keyed detection design fixes
that failure mode. Hot IPs cluster across pages 0x1400 (39.9 %),
0x1500 (46.5 %), 0x1600 (9.7 %) - a function with multiple
inner loops spanning ~768 bytes. Land `i4d` first to build
confidence in the compile-time-keyed detection pattern, then
revisit `r_draw`.

### Pipeline & artifacts (for the next agent)

- **calcite-cli `--sample-cs-ip`** now emits a `cycles` column
  (absolute `cycleCount` state-var at sample time;
  per-sample cost = `cycles[i] − cycles[i−1]`). Edit lives in
  `../calcite/crates/calcite-cli/src/main.rs` (search
  `cycleCount`). Build with `cargo build --release --bin
  calcite-cli` in `../calcite`. CSV header is now
  `tick,cs,ip,sp,cycles,burst_id` (was 5 columns).
- **Standing analyser
  `tests/harness/analyse-cs-ip-samples.mjs` does NOT yet
  consume the new column** - it still reads the 5-column
  schema. Update it before re-running automated analysis.
  Current cycle-weighted analysis was ad-hoc awk.
- **Raw data retained.** `tmp/sampler/cold.csv` = full
  cold-boot through past-ingame (tick 0 to ~96M).
  `tmp/sampler/load-window.csv` = filtered to tick 4.6M–34M.
  Built from `tests/bench/cache/doom8088.css` with the
  ingame-halt watches from `tests/bench/profiles/doom-loading.mjs`
  and `--sample-cs-ip=600,1000,100`.
- **Cycle reconciliation check.** Sum of cycle deltas in window
  938 M; final `cycleCount` − first sample ≈ 1.04 G - discrepancy
  is the first wide-single's leading delta from before the
  window started. Within reason.

### Recommended next steps

1. **Confirm `i4d` body shape in the cabinet.** Translate
   CS=0x2D96 IP=0x08..0xDB to the calcite dispatch entries the
   cabinet emits for those linear addresses. Use
   `probe_bytecode_shape` in `../calcite/crates/calcite-cli/src/bin/`
   or inspect the cabinet CSS directly. The question: does the
   loop-core body match the affine-loop plan's invariants
   (single induction variable, side-effect bounded, exits via
   `BranchIfNotEqLit`)?
2. **Pick recogniser granularity:**
   - *Per-iter affine fast-forward* - the existing plan at
     `docs/plans/2026-05-01-affine-loop-fastforward.md`. Wins
     on any libc divide on any cabinet.
   - *Function-level semantic substitution* - bigger payoff,
     much narrower applicability. Still cardinal-rule-clean
     if the recogniser only reads CSS shape.
3. **Measure trip-count distribution first** (plan's step 3).
   `__I4D`'s trip count is ~32/call (architectural), so should
   easily pass the plan's step-4 gate (abandon if avg trip
   count < 4). Confirm with `--probe-affine-loops` before
   building.
4. **Re-run the cycle-weighted heatmap after any change.**
   Protocol: 3-run web `doom-all --headed` medians for the
   headline + cycle-weighted CS heatmap for sanity-checking
   *where* the change moved cost.
5. **Address `r_draw` (24 %) second**, with the lesson from
   `column_drawer_fast_forward` in mind.

### Open questions / things to verify

- **Is `r_draw` really hot during level-load**, or hot during
  the menu/title redraw running in parallel with G_DoLoadLevel?
  Tick window 4.6M–34M starts at `_g_usergame=1` (level-load
  begin) but the menu may still be onscreen. Disambiguate by
  re-sampling with the bursts gated to fire only after a watch
  confirms stage_loading has fired, or by filtering on a more
  precise tick boundary.
- **Cycle-weighting honesty when bulk ops fire.** Sampler
  records `cycleCount` at sample time, but `cycleCount` can be
  advanced in bulk by `rep_fast_forward` (and possibly other
  bulk paths). If a bulk op completes between two wide
  singles, the delta is attributed to whichever segment we
  *caught* the second sample in - not where the cycles were
  actually spent. Spot-check by comparing the cycle-weighted
  heatmap against a per-burst variant (bursts are tick-by-tick
  so they don't suffer this).
