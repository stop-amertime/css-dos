# Resume: rep-generic recogniser gap

You're finishing the `rep_fast_forward` genericity mission — the
project's #1 ship-blocker (remove the hardcoded x86 cheat without
calcite knowing anything above the CSS layer). The hard part is done
and recovered; one recogniser gap stands between it and a green smoke
gate.

## State

- Branch: calcite `feat/rep-generic` (`origin`, HEAD `99f99ce`).
  Branched from `main` `8de61a8`. Worktree:
  `calcite/.claude/worktrees/rep-generic`.
- The descriptor-driven dispatcher (`compile.rs` `rep_fast_forward`)
  is landed: deletes the 341-line opcode table, routes purely through
  `LoopDescriptor` → `BulkClass` → `apply_*_with_commit`. Unit-green
  (281+28+7+5+10), all three binaries build.
- **It panics on 6/7 smoke carts.** Not shippable.

## The gap (already diagnosed — read before touching code)

`../calcite/docs/log.md` 2026-06-08 has the full analysis. Short
version: `extract_ip_extra_advance_slot`
(`pattern/loop_descriptor.rs:1266`) only recognises IP-advance shaped
as top-level `Add(dispatch, prefixLenVar)`. Real cabinets emit a
per-opcode `_repContinue`-gated body instead (`IP − prefixLen` while
the REP continues, `IP + 1` after). The `ip_extra_advance_slot_*`
unit tests hand-build the wrong shape — that's why they're green while
every real cabinet panics. **Do not trust those tests as a spec.**

A first hypothesis (descend the TF/IRQ `StyleCondition` wrappers) was
already disproven against the real CSS — the wrappers aren't the
issue, the gated-subtraction per-key body is.

## Cardinal rule (the gate)

Calcite must stay generic — no x86/DOS/Doom/opcode-byte awareness. The
recogniser change must be derivable from CSS *shape* alone (a 6502 or
brainfuck cabinet sharing the shape would trigger it identically). If
your rule reads name characters or special-cases opcode values, it's
wrong. The applier must reproduce exactly what Chrome computes for the
post-REP IP.

## Success criteria

1. `node tests/harness/run.mjs smoke` → 7/7
   (export `CALCITE_REPO` to the rep-generic worktree).
2. Then, and only then, the ±1% perf bench — see
   `tests/bench/README.md` before benching.
3. Branch stays unit-green; add a real-shape test (not another
   hand-built wrong-shape one).

Until 1+2 pass it's `BRANCH`, not `LANDED`.

## First move

Confirm whether all 6 failing carts share this one shape or there are
further independent recogniser gaps behind it — cheap, and it sizes
the job before you commit to a fix.
