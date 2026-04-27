# Known Bugs & Findings

Bugs that have been found and fixed, plus patterns to watch for. These are
detailed enough that a future agent hitting a similar bug can recognize it.

## Fixed bugs

### kiln D0 ROL/ROR missing → libc memcmp returns garbage (2026-04-26)

**Symptom:** Doom8088 reports `W_GetNumForName: DPPISTOL not found` on
the very first WAD lump lookup. Smoke programs (zork, montezuma)
unaffected. Looks like WAD loading broke or `repe cmpsw` is wrong —
both red herrings.

**Root cause:** `kiln/patterns/shift.mjs::emitShift_D0` (group `D0 /r`,
shift/rotate r/m8 by 1) implemented SHL (reg=4), SHR (5), SAR (7), RCL
(2), RCR (3) — but not ROL (0) or ROR (1). They fell through to
`else: var(--__1${regName})`, a no-op. The companion `emitShift_D1`
(word version) had all 7 cases.

Watcom's libc memcmp (linked into Doom8088 and Prince of Persia) ends
with `lahf; ror ah, 1; and ax, 0xa000; xor ax, 0x2000` to convert the
post-cmpsw flags into a -1/0/+1 result. With ROR a no-op, AH stayed at
the lahf value (0x46 for ZF=1), the and/xor sequence yielded AX=0x6000
instead of 0, every memcmp reported "not equal" even when bytes
matched, and any libc string/memory comparison silently lied.

**Fix:** added ROL+ROR to `emitShift_D0`'s result and flags
dispatches, mirroring `emitShift_D1`. Reorganised the dispatch into a
small `RESULTS` table keyed by reg field so all seven cases live in
one obvious place.

**How to reproduce / verify:** the smallest test is `lahf; ror ah, 1`
right after `repe cmpsw` of two equal byte sequences and check whether
the subsequent `and/xor` yields 0. If `--ROR ah, 1` is a no-op,
that whole sequence yields 0x6000.

**Pattern to watch for:**

- *Always test the suspected primitive in isolation before
  binary-patching the caller.* I spent hours patching DOOM.EXE's
  memcmp to use a manual byte loop on the assumption `repe cmpsw` was
  broken. A 30-line repe-cmpsw `.COM` test would have ruled cmpsw out
  in two minutes — the bug was 4 instructions later in the lahf/ror
  conversion.
- *Treat instruction-emitter dispatch tables with skepticism.* Ours
  are written as long if-chain expressions; a missing case is silent
  and looks like the register just doesn't change. Scan the chain for
  every `--reg: N` from 0..7 (or every relevant value) when adding
  new instructions. The fix here was to factor the seven cases into a
  table so a missing one is visually obvious.

### FAT12 cluster count exceeds 4085 → DOS detects FAT16 (2026-04-25)

**Symptom:** Any cart whose disk had more than 4085 data clusters hung
boot at **CS:IP=0x0105:0x1730**, partway through loading ANSI.SYS. DOS
issued one INT 13h AL=1 read for the first sector of ANSI.SYS (LBA 133
on the default layout), then never issued another disk read. The kernel
sat in a loop inside the INT 13h handler return path.

**Root cause:** `tools/mkfat12.mjs` hardcoded `sectorsPerCluster = 1`
and sized `FAT_SECTORS` based on content clusters, not whole-disk
clusters. On a 2.88 MB disk (5760 sectors) that meant `totalSectors −
dataStart ≈ 5743` clusters. EDR-DOS's `medchk` / mount path computes
`dataClusters = (totalSectors − dataStart) / spc` and treats anything
over 4085 as FAT16. Our 12-bit FAT entries (low 3 bytes = F0 FF FF…)
were then interpreted as 16-bit entries, so the first file's cluster
chain looked valid for one sector and then walked into junk. DOS's
`track_rw` aborted silently and the boot loop stalled.

**Fix:** `mkfat12.mjs` now picks `sectorsPerCluster` iteratively:
starts at 1, doubles until `floor((totalSectors − dataStart) / SPC) ≤
4084`. Hard cap at 128 (throws if the disk really would need FAT16).
File allocation is now in cluster units (`CLUSTER_BYTES = SECTOR_SIZE
* SPC`), and the `clusterOffset(c)` helper computes the byte offset
correctly for any SPC. zork1 default (720 sectors): unchanged (SPC=1,
703 clusters). 2.88 MB disks: SPC=2, ~2866 clusters.

**How to reproduce / verify:** build the same cart at total sectors
4102 vs 4103. At 4102 (= 4085 data clusters) the cabinet boots. At
4103 (= 4086 data clusters) it hangs at 0x0105:0x1730 with LBA frozen
at the first sector of the first multi-sector file it tries to load.

**Pattern to watch for:** BPB values interpreted slightly differently
by DOS than the builder assumes. `sectorsPerCluster` and `fatSectors`
both affect where DOS thinks the cluster table ends, and thus whether
it picks FAT12 or FAT16 interpretation. **Always treat the builder's
FAT layout as something DOS will independently re-derive, not as
authoritative.** If DOS's derivation disagrees with ours, the filesystem
looks corrupted to DOS. Same risk territory for FAT16→FAT32 (65525
clusters) and for `MAXCLUS` in the kernel disk driver.

### Segment override prefix decode / IP advancement (2026-04-13)

**Symptom:** `DS: PUSH word [BP+0x1E]` (3E FF 76 1E) advanced IP by 5 instead of 4.

**Root cause:** `emitRegisterDispatch` wrapped the entire IP dispatch in
`calc(... + var(--prefixLen))`. For multi-uOp instructions with inner conditional
holds (`else: var(--__1IP)`), the wrapper made IP drift by prefixLen during
mid-instruction cycles.

**Fix:** Removed the wrapper. Each emitter now explicitly includes
`+ var(--prefixLen)` in its advance expressions. Changed all 126 IP entries.

**Pattern to watch for:** Any "outer wrapper" that adds something to every
branch of an IP dispatch will break multi-uOp instructions that hold IP.

### REP MOVSB rewind off-by-one (2026-04-13)

**Symptom:** REP MOVSB executed only 1 iteration. IP rewound to one byte
before the prefix instead of to the prefix byte itself.

**Root cause:** `repIP()` used `calc(var(--__1IP) - var(--prefixLen))` for
rewind. After removing the outer wrapper (above), this became `IP - prefixLen`
instead of `IP`.

**Fix:** Changed rewind to `var(--__1IP)`.

### SHR/SHL/SAR OF flag for shift-by-CL (2026-04-13)

**Symptom:** SHR AX, CL with AX=0x8008 CL=4 produced OF=0, reference had OF=1.

**Root cause:** Shift-by-CL flag functions didn't compute OF. The preserve
mask (3856) included OF from previous flags, which was stale.

**Fix:** Added OF computation. Changed preserve mask to 1808 to exclude OF.

### Folded IRET decode pipeline corruption (2026-04-13)

**Symptom:** After INT 16h returned correctly, execution resumed at
CS=0xF000 (BIOS ROM) instead of CS=0 (the program's segment).

**Root cause:** Multi-uOp IRET sequence (pop IP -> pop CS -> pop FLAGS)
corrupted the decode pipeline because popping IP changed `--__1IP` on the
next tick, causing `--opcode` to fetch from the wrong address.

**Fix:** Collapsed all IRET pops into a single retirement uOp. IRET is
read-only (stack pops via `--read2`), so all pops fit in one uOp.

**Pattern to watch for:** Any multi-uOp sequence that modifies IP or CS
mid-instruction will corrupt the decode pipeline on subsequent uOps.

### Calcite slot aliasing in branching code (2026-04-13)

**Symptom:** `--readMem(1052)` returned 0 instead of 30 when called from
inside a branching `if(style())` expression.

**Root cause:** Slot compactor (`compact_sub_ops`) aliased a `LoadMem`
destination slot with a `Dispatch` destination slot inside nested dispatch
tables. The `compute_liveness_into` function didn't examine slots referenced
by nested dispatch tables' `fallback_ops`.

**Fix:** Changed `compile_near_identity_dispatch` to inline exception checks
as a `BranchIfZero/Jump` chain instead of creating nested Dispatch tables.

**Pattern to watch for:** Any calcite compilation involving nested dispatches
inside branching code (compound `and` conditions in `if(style())`).

### Memory gap in conventional RAM (2026-04-13)

**Symptom:** Kernel crashed after relocating itself to ~0x60440.

**Root cause:** `dosMemoryZones` split conventional memory into two zones
(0-0x30000 and 0x86000-0xA0000) with an unmapped gap. The kernel's relocated
code spanned both zones.

**Fix:** Single contiguous 0-0xA0000 zone.

## Active bug

### Seg-override memory write address (instruction 3740)

**Symptom:** `CS: POP [0x8633]` (2E 8F 06 33 86) — high byte of POP'd word
written with 0xF0 instead of 0x00.

**Status:** Not yet investigated. Likely same class as the prefixLen wrapper
bug but in memory write address computation rather than IP.

**How to reproduce:**
```sh
node builder/build.mjs ../calcite/programs/bootle.com -o /tmp/bootle.css
node tests/harness/pipeline.mjs fulldiff /tmp/bootle.css --max-ticks=5000
```
