# 2026-07-06 — Corduroy: digits + `,` `.` `/` were dead keys (scancode2ascii holes)

Owner report: "." didn't type at the A:\> prompt (`edit readme.txt`),
F1 seemed dead. Root cause for the dot: Corduroy's INT 09h ignores the
ASCII byte on the --keyboard wire and does its own `scancode2ascii[]`
lookup (handlers.asm) — and that table only mapped letters + Esc/Bksp/
Tab/Enter/Space. Digits `1`–`0` (0x02–0x0B) and `,` `.` `/`
(0x33–0x35) — all present on the player keyboard and in kiln's
KEYBOARD_KEYS — fell into 0x00 holes, so INT 16h handed DOS a dead
key. Fixed the table (corduroy v0.3.0), rebuilt bios.bin + prebake.
F1 was NOT broken: F-keys are extended keys (ASCII 0 correct); in
COMMAND.COM F1 copies the previous command's template one char per
press — on a fresh boot the template is empty, so it looks dead.
Verified per class through the real web player path (dos-shell cart,
click → form GET → SW → bridge): letters, all 10 digits, `,` `.` `/`,
Space, Enter, Esc (line cancel), Bksp, F1 (template char copy), F3
(full template recall), arrows (cursor moves in FreeDOS Edit, Line/Col
readout). Muslin unaffected (its INT 16h consumes the packed wire word
directly; INT 09 is a dummy). Smoke 6/6. Also: corduroy
`toolchain.env` NASM= now an absolute path (bare `nasm` wasn't on
PATH for execFileSync).
