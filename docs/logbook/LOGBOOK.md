# CSS-DOS Logbook

**Single source of truth for project status.** Every agent MUST read this
before starting work and MUST update it before finishing.
See `PROTOCOL.md` for the entry format. Pre-session-12 entries archived to
`docs/archive/logbook-sessions-1-12-2026-04.md`.

Last updated: 2026-04-19 (session 13 — autofit memory fix)

---

## Current status

V4 single-cycle CSS, 6 memory write slots (slot-live gated), rom-disk window at 0xD0000.
Corduroy (C BIOS) is the default DOS BIOS; Muslin (asm) is the fallback.
Full DOS boot works (BIOS → EDR-DOS kernel → bootle.com). Hardware IRQ
delivery is live: PIT fires IRQ 0 through IVT[8]; keyboard press/release
fire IRQ 1 through IVT[9]; ports 0x20/0x21/0x40–0x43/0x60 all decode.
Build pipeline is `builder/build.mjs` against a `program.json` cart;
three presets (`dos-corduroy`, `dos-muslin`, `hack`). Player is
`player/index.html`. Kernel is EDR-DOS (SvarDOS build) — the
`kwc8616.map` file is FreeDOS and does NOT match.

**Driving target:** Doom8088. All audited CSS-side blockers
(#24/#25/#26/#27/#28) are closed. Everything Doom needs (Mode 13h
framebuffer, INT 21h file I/O, 640 KB conventional, 8086 ISA, port 0x60
IN, IRQ delivery) already works. Build with
`-march=i8088 -nosound -noxms -noems`.

## Active blocker

Eliza / COMMAND.COM "keyboard doesn't work" (session 12, unresolved).
Eliza is stuck in a linked-list walk in the Watcom runtime at
CS:IP=0FC8:0BE0 with all-zero nodes; RESPONSE.DAT contents aren't in
memory. Working hypothesis: file-read fails, eliza hangs pre-input, and
"keyboard" is a misdiagnosis — unverified. See session 12 entry.

## What's working

- V4 single-cycle, 6 memory write slots (slot-live gated), contiguous 0–640 KB RAM, SP 16-bit clamp.
- BIOS: INT 10h (Mode 13h, AH=1Ah), INT 13h (floppy via REP MOVSW),
  INT 16h (BDA ring buffer), INT 1Ah (auto-incrementing ticks).
- Corduroy: real INT 09h handler, EOI on INT 08h/09h.
- Hardware: PIT countdown from `--cycleCount/4`, picMask/picPending/
  picInService, keyboard press + release edges, `--_kbdPort60` returns
  break scancode on release, port 0x21 IN returns `--picMask`.
- Rom-disk window at 0xD0000 dispatching to `--readDiskByte` (LBA at
  linear 0x4F0, NOT BDA_SEG:0x4F0). Calcite's flat-array op makes it fast.
- Hack path (.COM) fully working. Conformance tests pass: timer-irq,
  rep-stosb, bcd, keyboard-irq.

## What's next (priority order)

1. **Resolve eliza/keyboard (active blocker).** First step: run the
   prebuilt echo test (`/tmp/echo_test.css`, source at
   `AppData/Local/Temp/echo_test/ECHO.COM`) and see whether INT 21h
   AH=01h returns keys under corduroy. That single test rules keyboard
   in or out.
2. **INT 13h hard disk rejection.** DL >= 0x80 → CF=1. Previously
   caused a stall in a timeout loop; with the PIT now firing, should
   self-unblock. Retest.
3. **Rom-disk WAD validation.** Retest Zork+FROTZ (~284 KB), then
   Doom8088's WAD. Confirms flat-array dispatch scales.
4. **Build + boot Doom8088 end-to-end.**
5. More programs (rogue, etc.).

Parallel/deferred: Muslin still has `int_dummy` for INT 09h and no EOI
on INT 08h (not blocking Doom); `calcite/run.bat`, `run-js.bat`,
`serve.mjs` still reference pre-rename paths; aspirational cart-schema
fields (`disk.size`, `disk.writable`, sub-640K, hack memory knobs) not
yet plumbed; `ref-corduroy.mjs` not yet written.

## Recent decisions

- Default DOS BIOS is Corduroy (C), not Muslin (asm). (2026-04-18)
- `skipMicrocodeBios: true` on assembly-BIOS builds — unconditional
  0xD6 handler registration collided with 53 x 0xD6 bytes in the
  EDR-DOS kernel. (2026-04-14)
- Kernel is EDR-DOS (SvarDOS); ignore `kwc8616.map`. (2026-04-14)
- 32 batched write slots for REP string ops (activate only on
  0xA4/0xA5/0xAA/0xAB; DF=1 not handled). (2026-04-13)
- `pitReload=0` means 65536 (real hardware semantics). (2026-04-13)
- C BIOS is long-term plan; asm is interim. (2026-04-13)

## Uncommitted work

**CSS-DOS:** none from session 12.

**Calcite (sibling):**
- `/run-until` endpoint in `crates/calcite-debugger/src/main.rs`
  (session 12). Conditions: `cs_ip`, `cs`, `ip_range`, `int`,
  `int_num`, `property_equals`, `property_changes`, `mem_byte_equals`.
- Session-11d launcher wiring (`run-web.bat` → `builder/build.mjs`).
- Flat-array dispatch op wiring from session 10 + calc-cli menu rewrite.

---

## Entry log

Newest first. See `PROTOCOL.md` for format. Pre-session-12 history is
archived at `docs/archive/logbook-sessions-1-12-2026-04.md`; one-line
summaries below.

### 2026-04-19 — Session 13: autofit memory fix (Corduroy stack)

**What:** User reported that DOS builds using `memory.conventional:
"autofit"` (the default for `dos-corduroy`) never boot — only `"640K"`
worked. Root-caused to the Corduroy entry stub hardcoding its stack at
`0x9000:0xFFFE` (linear 0x9FFFE), which sits outside autofit memory.
Autofit for a tiny program produces memBytes=0x44000 (272 KB), so the
stack lives in unmapped memory: every `push`/`ret` silently corrupts
control flow, `call bios_init_` never returns to a valid address, and
boot dies inside BIOS init.

**Fix:** `bios/corduroy/entry.asm` now loads `mov ax, 0xBEEE` before
`mov ss, ax; mov sp, 0xFFFE`. `patchBiosStackSeg()` in
`builder/stages/kiln.mjs` rewrites the 0xBEEE immediate to
`(memBytes - 0x10000) >> 4`, placing the stack in a 64 KB window ending
just below the configured memory top. Mirrors the existing `0xBEEF`
→ `conventional_mem_kb` patch pattern.

**Verification:** Built the same tiny .COM cart with autofit vs 640K.
At 2M ticks both produce identical cycle counts (13,311,444) and the
same IP (295). Before the fix autofit stalled at IP=94 (spinning in
the IRQ0 handler after the call chain corrupted); 640K reached IP=295.
Prebaked web/prebake/corduroy.bin refreshed automatically via
`refreshPrebake` — browser builder gets the fix on next build.

**Scope:** Only affects Corduroy. Muslin sets its stack at 0x0030:0x0100
(inside the IVT) and was never broken. Hack path (.COM) doesn't use
this BIOS stub.

---

### 2026-04-19 — Session 12: eliza / COMMAND.COM keyboard investigation (inconclusive)

**What:** User reported keyboard doesn't work in ELIZA.EXE or
COMMAND.COM (bootle works). Triaged a prior-agent "add 186 opcodes"
theory, then started actual debugging. Did not reach a fix.

**Why:** The "add 186 opcodes" theory needed to be ruled out before any
opcode work happened; after ruling it out, we needed to locate where
eliza actually fails.

**Ruled out:**
- **Not a 186/286/386 gap.** Disassembled ELIZA.EXE and unpacked
  COMMAND.COM (UPX-packed SVARCOM). Both are pure 8086 — every 0xC1 in
  eliza is a FAR-ptr operand or ModR/M byte, not a shift-imm opcode. No
  0x0F, 0x66, 0x67 prefixes reachable. Kernel the same.
- **Not a `--IP` overflow.** Debugger's `/state.registers` reports raw
  state-var storage > 0xFFFF; the `properties` block at the same tick
  reports the correctly masked --CS/--IP/--ipAddr. Debugger reporting
  artefact, not a fetch bug.

**Observed but not root-caused:**
- Eliza prints its prompt, then freezes at CS:IP = 0FC8:0BE0 cycling
  through 5 addresses (0BE0→0BE3→0BE7→0BCE→0BD2→0BE0, period 5).
  Loop body (disasm): `mov si,[es:si]; cmp si,[0x1E]; jnz 0xBCE;
  cmp dx,[es:si+6]; jnz 0xBE0; ...`. It's a linked-list walk. At every
  tick in the loop SI=0, ES=0x7B06, bytes at ES:SI are zero, so SI stays
  0 forever. IF=0, halt=0, cycleCount advances.
- Eliza is in the **Watcom runtime segment** (0x0FC8), not its own image
  (0x0DF2). Entry signature found via memory scan at linear 0xDD9D with
  `CALL FAR 0DF2:0000`.
- **RESPONSE.DAT contents are NOT in memory.** Scanning all addressable
  memory for "Don't you believe" returned zero hits. The filename
  "RESPONSE" string is present (linear 0x1A24, 0x8A8B4) but the file
  contents have not been loaded.
- Eliza only uses INT 21h for I/O (20×; 0× INT 16h, 0× INT 10h). Input
  via AH=06h / AH=3Fh. File open via AH=3Dh at img offset 0x0F76 with
  correct `JC` error check.

**Working hypothesis (unverified):** Eliza prints prompt → tries to
open/read RESPONSE.DAT → something fails (read returns 0 / parse
produces empty list) → enters a linked-list walk over all-zero nodes →
loops forever. "Keyboard doesn't work" is likely a misdiagnosis — the
program probably never reaches an input call.

**Key finding:** Before going deep on disassembly or memory forensics,
run the minimal key-echo test. A 21-byte ECHO.COM exists at
`AppData/Local/Temp/echo_test/ECHO.COM`; the built cart is at
`/tmp/echo_test.css`. Neither has been run yet. If keys echo, the
keyboard path is fine and this is 100% an eliza data-structure issue.

**Infrastructure added:** `/run-until` endpoint in calcite-debugger
(`crates/calcite-debugger/src/main.rs`, uncommitted in calcite).
Conditions listed in Uncommitted work above. `int_num: 33` tested and
correctly locates INT 21h calls.

**Mistakes to avoid next session:** (1) Do the echo test FIRST, not
last. (2) Use `run_in_background: true` for the debugger process, not
trailing `&` — processes died at turn boundaries and orphaned the port.
(3) The `--IP > 0xFFFF` red herring wasted time; trust the masked
`properties` block.

**Not checked:** COMMAND.COM failure mode (session 11d noted it fails
separately — "Bad or missing command interpreter" on Corduroy, unusable
prompt on Muslin); Muslin running eliza; why bootle's INT 21h usage
differs from eliza's (bootle is .COM single-seg, eliza is .EXE
multi-seg + Watcom runtime).

**Blocked on:** Unresolved — see "Active blocker".

---

## Earlier sessions (one-line index)

Full text at `docs/archive/logbook-sessions-1-12-2026-04.md`.

- **Session 11d (2026-04-18) — launcher tidy-up.** Bridged calcite launcher to
  `builder/build.mjs`. `.gitignore` no longer swallows presets. `mkfat12.mjs`
  root dir 16 → 224 entries. Default preset Muslin → Corduroy.
- **Session 11c (2026-04-18) — Doom8088 blockers #25/#26/#27/#28.** Corduroy
  INT 09h handler + EOI on INT 08h/09h. Kiln emits break scancodes and
  `--_kbdPort60`. Port 0x21 IN now returns `--picMask`. `compare.mjs` fixed
  for v4 (uOp, ANSI prefix).
- **Session 11b (2026-04-18) — the big rename.** Vocabulary
  (cart/cabinet/floppy/Kiln/builder/Gossamer/Muslin/Corduroy/player).
  `builder/build.mjs` replaces the three `generate-*.mjs`. `program.schema.json`
  + `docs/cart-format.md` canonical. BIOS files fan out. Player HTML extracted.
  Ref emulators → `conformance/`. See CHANGELOG for full move list.
- **Session 11a (2026-04-18) — Doom8088 readiness + IRQ phases 1–3.** PIC/PIT
  port decode, PIT countdown from `--cycleCount/4`, single-cycle IRQ override
  (SP/IP/CS/flags push, jump to IVT vector). IRQ 0 + IRQ 1 only. No palette
  writes, no break-scancode edge (closed later in 11c).
- **Session 10 (2026-04-15) — rom-disk end-to-end + calcite flat-array + CLI
  menu.** Bootle boots via rom-disk. Calcite's `Op::DispatchFlatArray` wired
  up. `calcite-cli` grid menu. Bootle: parse 4.7s, compile ~16s, 1 tick ~74µs.
- **Session 9 (2026-04-14) — rom-disk on feature branch.** Disk bytes outside
  the 1 MB space, accessed through a 512-byte window at 0xD0000; LBA at
  linear 0x4F0 (NOT BDA_SEG:0x4F0). Single-param `--readDiskByte(--idx)` to
  avoid the two-param cross-product 48 GB OOM. Commit `8c407d9` bundles V4
  on master.
- **Session 8 (2026-04-14) — V4 architecture.** Abandoned v3 μOp sequencer;
  restored v2 single-cycle with 8 write slots. Ported v3 improvements one at
  a time: Mode 13h, contiguous memory, SP clamp, OF shift-by-CL, `--cycleCount`,
  keyboard CSS, BDA ring buffer. V3 microcode archived to `legacy/v3/`.
- **Session 7 (2026-04-14) — boot crash fixed.** Root cause: unconditional
  0xD6 microcode BIOS handler registration collided with 53 x 0xD6 bytes in
  the kernel. Added `skipMicrocodeBios` flag. SP overflow (20-bit on 640 KB)
  fixed with `& 0xFFFF`. Calcite debugger gained `/watchpoint`.
- **Session 6 (2026-04-13) — batched write slots + PIT fixes.** 32 slots
  activate only on REP string opcodes (~5× CSS growth, HashMap-friendly).
  DF=1 not handled. `pitReload=0` now means 65536. PIT-in-bios_init attempt
  reverted (early-init IRQs clobbered the version string).
- **Session 5 (2026-04-13) — assembly BIOS revival.** Copied old gossamer BIOS
  to `bios/css-emu-bios.asm`. Fixed INT 13h hard-disk probe bug (DL >= 0x80
  must return CF=1). Built `boot-trace.mjs`. Decision: C BIOS is long-term.
- **Session 4 (2026-04-13) — BIOS gaps.** INT 1Ah AH=00h now reads BDA tick
  counter. INT 10h AH=0Eh handles CR/LF/BS/BEL via `--biosAL`. PIT/EOI
  attempt reverted (regression).
- **Session 3 (2026-04-13) — BIOS init stub + handlers.** `bios/init.asm`
  at F000:0000 populates IVT, BDA, VGA splash, JMP FAR to kernel. Added INT
  13h hard-disk probe responses, INT 1Ah, INT 16h shift flags, INT 10h set
  mode. `isHardDisk` guard pattern (DL >= 128) established.
- **Session 2 (2026-04-13) — IRET fix + DOS path rewrite.** Folded IRET
  pops into single retirement uOp to avoid decode pipeline corruption.
  Rewrote `generate-dos.mjs` without `gossamer-dos.asm`. Fixed memory gap at
  kernel relocation target. `compare-dos.mjs` added.
- **Session 1 (2026-04-13) — calcite slot aliasing fix + INT 09h.** Slot
  compactor aliased LoadMem dest with Dispatch dest inside nested dispatch;
  `compact_sub_ops` liveness didn't follow nested fallback_ops. Fixed by
  inlining exception checks as BranchIfZero/Jump chain. `/trace-property`
  and `/dump-ops` endpoints added.
