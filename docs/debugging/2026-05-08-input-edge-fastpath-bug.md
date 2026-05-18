# Handover: input-edge fast-path bug in calcite

**Status:** open. **Repro:** in browser only (web player). CLI is unaffected.

## Symptom

User runs the **web player** (`node web/scripts/dev.mjs`, opens
`/player/calcite.html?cabinet=...`) after the 2026-05-07 calcite
session and observes:

- **Zork:** press 'J' repeatedly. The first one or two appear on screen.
  Subsequent J presses do nothing visible — the screen looks frozen.
  Then pressing **Enter** snaps the screen forward (multiple Js
  appear at once, plus newline).
- **Doom8088:** screen is **totally black** in the player. Doesn't
  appear to advance past mode-13h init.
- General feel: frames are "choppy".

The CLI bench has none of these symptoms. `tests/bench/driver/run.mjs
doom-loading --target=cli` reaches in-game at the expected tick with
the expected cycle count, and `tests/harness/pipeline.mjs fast-shoot`
at tick 5M shows the DOOM title screen rendering correctly. **The
bug is web-bridge-specific or rendering-side, not CPU-side.**

Smoke 7/7 PASSES. So the simpler carts (zork1, montezuma, smoke set)
are unaffected by the regression on those harness paths — but the
user's interactive Zork session in the browser exhibits the freeze.
The harness runs zork1 for 10K ticks with no input, so it doesn't
exercise the input path.

## Recent changes (the suspect set)

Two commits landed in calcite `main` 2026-05-07:

1. **[`6d9e80a`](https://github.com/stop-amertime/calcite/commit/6d9e80a) — "fix: apply_input_edges fast path"**
   - Introduces lazy compile-once + grouping in `apply_input_edges`.
   - Adds an empty-set fast-path early-return:
     ```rust
     if state.pseudo_active.is_empty() && !self.last_apply_was_nonzero {
         return;
     }
     ```
   - Changes `State.pseudo_active` from `HashMap<(String, String), bool>`
     to `HashSet<(String, String)>`.
   - Adds `pseudo_class_active_pair` helper with empty-set short-circuit.
   - Adds `last_apply_was_nonzero: bool` field on `Evaluator`.

2. **[`f014d35`](https://github.com/stop-amertime/calcite/commit/f014d35) — "default-on: BIfNEL2 fusion"**
   - Removes the `CALCITE_BIF2_FUSE` env-var gate around
     `fuse_diff_slot_bifnel_pairs`. Now always runs.

A bisect ruled out BIF2 as the cause of one earlier symptom (a
black fast-shoot at tick 4M turned out to be a transitional moment
between text-mode and mode-13h, not a bug). **The user's web symptoms
appeared after `6d9e80a` was deployed and have not been bisected
against just `f014d35`.** Suggested first step: revert each commit
individually on a worktree and have the user retest.

## Why I think it's `6d9e80a`

The user's symptom shape is keyboard-driven:
- "First J appears" — the first press fires correctly.
- "Subsequent J's don't appear" — the cabinet's edge detector for
  `_kbdPress` (transitions of `--keyboard` from 0 → nonzero) may
  not be seeing the transitions because of stale state.
- "Enter unfreezes" — Enter triggers `set_pseudo_class_active` which
  forces my fast-path **off** (`pseudo_active.is_empty()` is now
  false), so any work that was being skipped runs.

The cabinet has these CSS rules referencing `--keyboard`:

```css
style(--keyboard: 0): 0;
style(--keyboard: 0): 1;
style(--_kbdPress: 1): --rightShift(var(--keyboard), 8);
--prevKeyboard: if(style(--_tf: 1): var(--__1prevKeyboard); ...
                   else: var(--keyboard));
```

`--prevKeyboard` saves last-tick keyboard. `--_kbdPress` fires on a
0→nonzero transition. The cabinet expects `--keyboard` to be 0 when
no key is held.

My traced reasoning says the fast-path *is* clearing slot[keyboard]
on the release-tick (when `pseudo_active` becomes empty,
`last_apply_was_nonzero` is still true → full path runs once → writes
0 → flips bool false → subsequent ticks skip). I couldn't find a
hole in that logic, but the symptom strongly suggests one exists.

Possibilities I didn't fully eliminate:

- **`state.state_vars` writeback gap.** `apply_input_edges` writes
  to `state.state_vars[slot]` directly. The bytecode reads via
  `state.read_mem(addr)`. For doom8088 (`pack=2` packed cells),
  is there a packed-cell sync step the original write-every-tick
  pattern was implicitly driving? Look at
  `state.populate_memory_from_readmem` and `wire_state_for_packed_memory`.

- **String property cache.** `tick_no_diff` runs string assignments
  after execute. The `properties` HashMap is populated from
  `compiled.property_slots`. If `--keyboard` has a string-side
  cache that was being refreshed by the original
  `apply_input_edges`'s implicit reset, my fast-path may leave it
  stale.

- **Frame sampler hash skip.** `web/shim/calcite-bridge.js:546`
  skips frame emission if the rgba hash matches `lastFrameHash`.
  If the cabinet's framebuffer ALSO depends on `--keyboard` via
  some chain, and my fast-path leaves an intermediate cell unwritten
  that has visual side effects, the rendered frame could match
  the previous hash and be skipped. The "Enter unfreezes" matches
  this — Enter changes `--keyboard`, breaks the hash equality,
  emits a new frame.

  Strong test: temporarily disable the hash-skip in calcite-bridge.js
  and see if the freeze goes away.

## What I tried, what's already known

- Bisect (5M-tick raw bench) confirmed the *performance* regression
  was real: 289K ticks/sec pre-`a5e8eee` → 162K ticks/sec post-merge.
  My fix recovered 297K ticks/sec at the raw level.
- Fast-shoot via `tests/harness/pipeline.mjs fast-shoot` at tick
  500K (DR-DOS banner), 1M (NANSI), 2M (DOOM init), 3M, 5M (title)
  all render correctly with the fix applied.
- Smoke 7/7 PASS.
- doom-loading bench (CLI): reaches in-game at correct tick with
  correct cycle count (389,935,570).
- The fast-path's three layers each independently are correct in
  the value sense — slot[keyboard] does end up at 0 when no key
  is held. I couldn't construct a scenario where the value diverged
  from the original code.

So the bug is almost certainly **a side effect of the WRITE itself**
(not its value), or **a downstream pipeline** that depended on the
write happening per-tick.

## Suggested investigation order

1. **Confirm which commit is at fault.** Have the user revert
   `6d9e80a` only (keep `f014d35`), rebuild WASM, retest in browser.
   If symptom persists with just `f014d35` reverted, my commit is
   not the cause and we're chasing the wrong thing.

   ```sh
   cd ../calcite
   git revert 6d9e80a
   wasm-pack build crates/calcite-wasm --target web --out-dir ../../web/pkg --release
   ```

2. **If `6d9e80a` is at fault, narrow the layer.** Start by reverting
   just the early-return (the simplest hypothesis):

   ```rust
   // in apply_input_edges, comment this out:
   // if state.pseudo_active.is_empty() && !self.last_apply_was_nonzero {
   //     return;
   // }
   ```

   Rebuild, retest. If symptom resolves, the bug is in "skip the
   write entirely". The fix is either:
   - Don't skip — keep the per-tick write but make it cheap (the
     remaining optimisations in the commit, lazy slot resolution +
     grouping, still give a meaningful speedup without the early-out).
   - Or: skip but ALSO invalidate whatever downstream cache depends
     on the write.

3. **If the early-return isn't the issue, suspect the HashSet
   change.** The original code used `HashMap<(String, String), bool>`
   where `false` was distinguishable from "not present". My HashSet
   conflates them. If any code path elsewhere reads `pseudo_active`
   and treats `false` differently from "absent", the change would
   cause divergence.

   ```sh
   grep -rn "pseudo_active" crates/ | grep -v worktrees
   ```

   At time of writing, only `apply_input_edges` and `set_pseudo_class_active`
   read it. But verify.

4. **Look at the bridge's frame sampler.** Specifically
   `web/shim/calcite-bridge.js` lines 463–549 (the `maybeEmitFrame`
   function and its hash-skip at line 546). Adding a debug log
   at the skip path and watching the user's session would tell
   whether frames are being skipped for hash reasons during the
   freeze. If yes, the bug is "rendered framebuffer happens to
   produce same hash because some intermediate state is stuck".

5. **Build a minimal browser repro.** The user's manual session
   isn't reproducible from a script. Either:
   - Use Playwright in headed mode to drive the player, send key
     events, capture frames.
   - Add a test cabinet that exercises the input-edge path without
     the full doom8088 stack.

   The 7-cart smoke set passes because none of those carts use
   pseudo-class input — the regression is on the input *path*, not
   the eval path. A cart that polls `--keyboard` and writes its
   value to text VRAM would be the simplest repro.

6. **As a last resort:** revert both commits. The session's net
   gain is the perf fix; if the bug isn't tractable, ship the
   revert and reopen lead #3 in the FPS brief with a more
   conservative implementation that doesn't skip writes.

## Where the relevant code lives

| What | Path |
|---|---|
| `apply_input_edges` | `crates/calcite-core/src/eval.rs:705` (post-fix) |
| `build_input_edge_groups` helper | `crates/calcite-core/src/eval.rs:1652` |
| `pseudo_active` field | `crates/calcite-core/src/state.rs:95` |
| `set_pseudo_class_active` | `crates/calcite-core/src/state.rs:268` |
| `pseudo_class_active_pair` | `crates/calcite-core/src/state.rs:303` |
| Web bridge tickloop | `web/shim/calcite-bridge.js:261` |
| Web bridge `set_pseudo_class_active` calls | `web/shim/calcite-bridge.js:272, 282` |
| Frame sampler + hash-skip | `web/shim/calcite-bridge.js:463, 546` |
| Cabinet `--keyboard` rules | `tests/bench/cache/doom8088.css` (`grep "kb-" doom8088.css`) |

## Logbook entries to read

- CSS-DOS `docs/logbook/LOGBOOK.md` 2026-05-07 entries (most recent
  first). The "regression fixed (recovered 1.83×)" entry has the
  bench numbers and three-layer fix description.
- Calcite `docs/log.md` 2026-05-07 entries. Same span.
- The 2026-04-30 net-wash measurement that originally gated BIF2
  off — referenced in the BIF2 commit message.

## Acceptance criteria for the fix

- User can press J multiple times in the browser Zork session and
  see each J appear on screen as it's pressed.
- Doom8088 in the browser reaches the title screen and main menu;
  user can navigate via Enter.
- Smoke 7/7 still PASS.
- doom-loading CLI bench still hits in-game at tick 34.65M with
  cycle count 389,935,570.
- doom-loading CLI bench remains close to the post-fix throughput
  (215 K ticks/sec range; small regressions are acceptable to fix
  the bug). If we can't preserve the speedup, that's worth
  flagging — partial revert is a valid outcome.

## Files I touched in this session

```
crates/calcite-core/src/compile.rs   (BIF2 default-on)
crates/calcite-core/src/eval.rs      (input-edge fast path)
crates/calcite-core/src/state.rs     (HashSet + empty fast-path)
docs/log.md                          (calcite log)

# CSS-DOS side:
docs/agent-briefs/2026-05-07-pre-ship-fps-leads.md
docs/logbook/LOGBOOK.md
docs/logbook/STATUS.md
```

Probe added in earlier session: `crates/calcite-cli/src/bin/probe_bif_predecessor.rs`
(useful for sanity-checking peephole-fusion candidates against the
post-compile static stream — not directly relevant to this bug).
