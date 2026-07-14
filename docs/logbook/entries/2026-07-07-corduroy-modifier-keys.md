# 2026-07-07 - Corduroy 0.6.0: Shift/Ctrl/Alt are real modifiers

Owner: verify modifiers work in shortcuts (PoP, MS-DOS) + hold-off
must drain immediately. Finding: the wire was fine (PoP/Doom hook
INT 9 and read raw make/break; hold-off drain machine-side, e2e'd
same day) but **Corduroy INT 09h ignored modifiers entirely** -
break codes dropped before any processing, BDA 0040:0017 never
written, modifier makes buffered as bogus ASCII-0 keys, one
unshifted translate table. Any INT 16h consumer (MS-DOS, EDIT) saw
no Shift/Ctrl/Alt, ever. Fix (`handlers.asm`, v0.6.0): modifier
make/break maintains the 0x417 flags (never buffered); translation
picks normal/shift/ctrl tables by flag (Alt → ASCII 0 + scancode).
Simultaneous `:active` presses can NOT chord (single-valued wire,
make fires on 0→nonzero only - verified) - chords come via the hold
wire or multitouch. calcite-cli `--press-events` grew a pseudo
prefix (`checked@kb-holdmode`, calcite `8928622`) to drive the hold
wire natively; verified on msdos4: hold→Shift,A → `A`; drain alone
clears flags (`b`); hold→Ctrl,C → `^C` + line abort; then `2`.
Gates: smoke 6/6, msdos, writable, kbd-e2e (real web path) all PASS.
