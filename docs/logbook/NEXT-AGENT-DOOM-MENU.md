# Handoff: get DOOM into the main menu

The user's stated goal: **DOOM8088 reaches the main menu where you can pick "New Game"**. Right now it's stuck on the title splash screen forever in calcite, even though under a real 8086 reference (js8086) the same cabinet auto-advances to the demo loop by ~60 M instructions and then to the press-any-key prompt.

You don't need to do anything special to dismiss the title — DOOM auto-advances. You just need calcite to actually progress the CPU at the same rate the reference does.

## Read first

- `docs/logbook/LOGBOOK.md` — `2026-04-27 — Reference-emulator-driven divergence hunt` entry. The exact state of the world: what's broken, what's fixed, what tools exist, what I got wrong before figuring it out. Don't skip the "Things I claimed earlier that turned out to be wrong" section.
- `tests/harness/diverge.mjs`, `ref-machine.mjs`, `ref-shoot.mjs`, `ref-run.mjs` — the diagnostic. Use these every time you make a calcite change to confirm the first-divergence point moves forward.

## The real bug

calcite is correct on individual instructions but **slow per tick** because it can't fast-forward several REP variants. Each unforwarded REP costs CX × per-tick-CSS-cost; the reference completes the same REP in 1 step. Over a full Doom8088 boot, calcite runs out of tick budget before hitting the demo loop.

The REP variants known to bail and need handling:

1. **REPNE/REPE SCASB and SCASW** — scan-and-compare with early exit. Used by libc string functions DOOM calls during init. Currently bails at `repType != 1`. **Next divergence is here** (calcite tick 444841, CS:IP=8AEC:7EA2).
2. **REPNE/REPE CMPSB and CMPSW** — same pattern, scan two memory regions for inequality. Probably also needed.

Anything else? Run `CALCITE_REP_TRACE=1 calcite-cli ... --dump-tick=N` and bucket the entries by opcode — the long-tail entries are candidates.

## The diagnostic loop

1. Make a change in calcite.
2. `cargo build --release -p calcite-cli` (~20 s).
3. `node tests/harness/diverge.mjs doom8088.css --from=0 --to=2000000 --step=200000` (~30-40 s, time-capped).
4. Read the `firstMismatch` field. If it moved forward, the change made progress; if not, look at `detail` — the offending CS:IP and reg deltas point at the next REP variant or instruction the cabinet uses that calcite mishandles.
5. Bisect inside the divergence window with smaller steps: `--from=400000 --to=500000 --step=10000` etc.
6. When `firstMismatch` is high enough (say > 10 M ticks), screenshot and compare:
   - `node tests/harness/pipeline.mjs fast-shoot doom8088.css --tick=N --out=calc.png`
   - `node tests/harness/ref-shoot.mjs doom8088.css --instr=N --out=ref.png`

## How to add a new REP variant to `rep_fast_forward`

`crates/calcite-core/src/compile.rs::rep_fast_forward`. It currently:
- accepts opcodes 0xA4 / 0xA5 / 0xAA / 0xAB
- accepts `repType == 1` only (REP / REPE prefix `0xF3`)
- fast-forwards N iterations as one bulk operation

For SCASB (0xAE) / SCASW (0xAF) and CMPSB (0xA6) / CMPSW (0xA7), the semantics are:

```
loop:
  if --CX == 0: exit
  src1 = read at ES:DI (and DS:SI for CMPS)
  if (REPE && src1 != AL) or (REPNE && src1 == AL): exit, ZF set accordingly
  CX--
  DI += step (and SI += step for CMPS)
```

Walk linearly in Rust through `state.read_mem`, tracking iteration count so you can:
- compute final CX, SI, DI
- set ZF correctly (last comparison's result)
- charge cycles (real 8086: SCAS = 15/iter, CMPS = 22/iter; check `kiln/cycle-counts.mjs` for the exact CSS values)
- update post-tick IP

Don't try to do all four in one PR. Do REPNE SCASB first because that's the next observed divergence; if it works, do REPE SCASB next, and so on.

## Time budget rules (the user has been very firm about these)

- **Every shell command needs an explicit ≤ 2-minute cap.** Use `timeout 100 …`.
- Don't run `pipeline.mjs fast-shoot` past tick 30 M with the current calcite — it will hit the timeout. Get the divergence-fixing PR done first, then fast-shoot will reach further.
- Don't run smoke until you have a calcite change to verify; smoke takes ~110 s total.
- Don't kick off speculative "let's see how far it gets" runs. If the math says a run won't finish, find a different way to ask the question.

## Things to NOT do

- Don't add inert defensive code. The previous `_irqActive` bail was inert because the CSS doesn't reference `--_irqActive` via `var()`. **Verify your `read_prop` calls hit a compiled slot before you trust them**; the easiest check is `grep 'var(--FOO)' doom8088.css` — zero hits means there's no slot.
- Don't chase "screen looks right" or "cycles climb" as proof of fix. Use `diverge.mjs` to check that the first-mismatch tick actually moved forward. **Match against the reference, not against vibes.**
- Don't assume DOOM is waiting for a key. It isn't. The reference auto-advances. If calcite isn't auto-advancing, calcite is failing to execute something the reference executes correctly.
- Don't reach for fulldiff (`pipeline.mjs fulldiff`) — it goes through `calcite-debugger` at ~1 instr/s and won't reach the divergence in any reasonable budget. Use `diverge.mjs` (in-process ref + `calcite-cli --dump-ticks` child).

## Sanity checks before claiming victory

1. `node tests/harness/diverge.mjs doom8088.css --from=0 --to=10000000 --step=1000000` — first mismatch should be ≥ 10 M ticks (currently ~445 K).
2. `node tests/harness/pipeline.mjs fast-shoot doom8088.css --tick=15000000 --out=t.png` — phash should NOT be `107c7c7e7e7e4600` (that's the title splash). It should be a different phash matching the demo loop / press-any-key screen.
3. `node tests/harness/run.mjs smoke` (≤ 2-min cap) — all 7 carts pass.

When all three pass, screenshot what calcite shows, compare to `ref-shoot.mjs --instr=70000000` and `--instr=100000000`, and you're done — that's the menu (or one keystroke away from it).

## Files modified by previous agent (this handoff)

In `../calcite/`:
- `crates/calcite-core/src/compile.rs` — `rep_fast_forward` bails refactored: BIOS-source bail removed (now handled by `bulk_copy_bytes`'s per-byte `read_mem`), disk-window overlap bail removed (now handled by `disk_image`-aware `read_mem`). `_irqActive`/`_tf` bail at end is INERT — read note in LOGBOOK before relying on it.
- `crates/calcite-core/src/state.rs` — added `disk_image: Option<Vec<u8>>`; `read_mem` services 0xD0000-0xD01FF when present.
- `crates/calcite-cli/src/main.rs` — loads `<cabinet>.disk.bin` sidecar at startup; `--trace-halt` and `--trace-halt-skip` flags (ring-buffer halt detector).
- `crates/calcite-wasm/src/lib.rs` — `read_framebuffer_rgba` now populates DAC via `read_byte_unified` for packed cabinets (palette fix).

In `CSS-DOS/`:
- `tests/harness/lib/ref-machine.mjs` — virtual rom-disk window + DAC port snooper.
- `tests/harness/diverge.mjs`, `ref-shoot.mjs`, `ref-run.mjs` — new diagnostics.
- `docs/logbook/LOGBOOK.md` — full session notes.
- `docs/logbook/NEXT-AGENT-DOOM-MENU.md` — this file.

Don't trust any "smoke passed" claims I made earlier in the session — smoke was passed BEFORE the disk-image change. Re-run smoke in your first hour. If it regresses, the most likely culprit is `state.read_mem` short-circuiting the disk window for cabinets that don't need it; gate the new short-circuit on `disk_image.is_some()` (already done) and double-check no smoke cart sets disk_image with a too-small disk.
