# 2026-07-10 — Site copy: CSS-lens additions (decoder, REP, idle-branch hardware…)

**BRANCH** (`claude/css-dos-strategy-x0h8o9`) — owner-directed copy pass on
`docs/CSS-DOS-site-copy.md`, applying the "start from the capability CSS
lacks" editorial filter. New sections, all grounded in kiln source:

- CPU: decoder (parallel raw0–7 fetch, prefix re-aliasing q0–q5, ModR/M
  by mod/div), unknown-opcode sulk, "decode everything, keep what you
  need" (standing properties vs in-branch raw-arithmetic laziness,
  Chrome @function-nesting limits), REP (IP moonwalk, dual ZF compute),
  idle-branch hardware (pitCounter/picPending custom defaults).
- Keys: manufacturing the past (prevKeyboard edge derivation), hold
  wire + 8-slot pigeonhole queue (`:checked`, kbdHeld0–7).
- Screen: DAC sub-index state machine ("one port, three meanings").
- Mem decl: out-of-1MB shadows (DAC 0x100000, disk 0x200000, 6-sig-digit
  value cliff), sparse memory as omission.
- Clock: animation as invalidation trigger.

Owner's inline [notes] left untouched per instruction.
