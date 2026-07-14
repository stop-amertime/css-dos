# 2026-06-12 - Release audit: BIOS DCC fix, replacement carts verified, docs pruned

**BIOS bug (fixed):** Corduroy INT 10h AH=1Ah dispatched get/set DCC on
**BL** instead of **AL** (RBIL: AL=00h get, 01h set). Callers probing VGA
with `AX=1A00h, BL=junk` hit the set path; BL came back unchanged → PoP 1.4
printed "Graphics mode not available". Fixed in `handlers.asm`; smoke PASS.

**pop1_4 verified booting** (fast-shoot): second wedge was the bundled
SB-Pro/speaker-digital sound driver - it programs a ~7 kHz PIT (pitReload
174 ≈ 696 CPU cycles/IRQ) whose ISR + BIOS chain starves a 4.77 MHz 8086
forever (wedges real hardware too). Drivers renamed `.BAK`; boots to PoP
title via two "press any key" sound dialogs. **rogue1_0 verified** (title +
name prompt). Cart deletions paused by owner mid-session - nothing committed.

**Audit:** calcite cardinal-rule sweep clean (logic-level; probe bins are
dev-only). 2026-04 seg-override `CS: POP [mem]` report re-tested in
isolation - writes correctly; known-bugs.md has no open entries left.
Pruned: 2 dead plans, codex-debris doc, input-edge handover (superseded);
doom-hang-findings → archive; stale STATUS/CLAUDE/INDEX claims fixed.
