## 2026-04-28 — 3 word-slot scheme

Kiln moves from **6 byte-slots → 3 word-slots** for memory writes.
Each slot carries `--_slotKWidth` (1 or 2): width=2 packs addr/addr+1
byte pair into one slot whose `--memValK` holds the un-split 16-bit
word. INT/IRQ frames (FLAGS+CS+IP = 3 words) fit new 3-slot worst
case exactly. `--applySlot` becomes 6-arg (loOff, hiOff, val,
width): aligned-word, byte, odd-addressed straddle splices.

Calcite recogniser (`packed_broadcast_write.rs` + parser fast-path)
updated to 6-arg shape; `CompiledPackedBroadcastWrite` gains
`width_slot`; `compile.rs`/`eval.rs` apply 1- or 2-byte writes per
port per tick.

| Cart    | 6-slot   | 3-slot   | Δ      |
|---------|---------:|---------:|-------:|
| dos-smoke (test) | 152.6 MB | 139.9 MB | −8.3% |
| zork1   | 299.6 MB | 274.7 MB | −8.3% |
| doom8088 | 341.7 MB | 316.9 MB | −7.3% |

Doom8088 stage bench:

| Stage         | 6-slot     | 3-slot     | Δ        |
|---------------|-----------:|-----------:|---------:|
| text_drdos    |  1 110 ms  |  1 083 ms  | −2.4%    |
| text_doom     |  3 751 ms  |  3 635 ms  | −3.1%    |
| title         |  9 524 ms  |  9 284 ms  | −2.5%    |
| menu          | 10 304 ms  | 10 024 ms  | −2.7%    |
| loading       | 13 655 ms  | 13 319 ms  | −2.5%    |
| **ingame**    | **90 995** | **85 323** | **−6.2%** |
| ticksToInGame | 35 000 000 | 35 000 000 | identical |
| cyclesToInGame| 397 458 534| 397 458 534| identical |

Same cycle/tick counts → CPU work identical; savings = per-tick CSS
eval. Level-load (loading→ingame, 29.5 M ticks): 77.3 s → 72.0 s =
−6.9%. Zork1 5M-tick: ~3% per-tick speedup, no per-cycle regression,
20% faster compile.
