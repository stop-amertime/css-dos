## 2026-04-29 — bridge: hash-gated emit + 30Hz sampler

**Problem.** Web bridge claimed 20 fps (TARGET_MS=50, BMP/batch).
User-perceived rate doom8088 gameplay = ~1-2 fps. The other 18
paints/s were duplicates (~5-10 ms each: BMP alloc + transferable
post + browser BMP-decode + DOM put).

**Fix** (`web/shim/calcite-bridge.js` v41):

- Decouple paint cadence from tick loop. New setInterval at
  FRAME_SAMPLER_HZ=30 calls `maybeEmitFrame` independently of batches.
- Hash-gate emit. `maybeEmitFrame` computes FNV-1a over sparse 1KB
  rgba subsample, short-circuits when unchanged.
- Drop produced-frame adaptive batch sizing (didn't help). Fixed
  TARGET_MS=33ms, simple 0.5×/2×.

**Results** (doom8088, 60s LEFT, fusion OFF):

```
simulatedFps = 34.2  (vs native 35Hz)
vramFps      = 1.6   (cabinet's true visible-frame rate)
paintFps     = 2.1   (was 19.5 pre-hash-gate — 9× fewer dups)
```

Each gametic only renders one column strip; full visible frame builds
over many gametics → ~600 ms per fully-painted screen.
