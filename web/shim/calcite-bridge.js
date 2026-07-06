// web/shim/calcite-bridge.js
// The calcite bridge: a dedicated module worker spawned by the site
// page on load. Hosts the calcite WASM engine against the cached
// cabinet, assembles each frame as a BMP, and broadcasts the bytes on
// the 'cssdos-bridge' BroadcastChannel; the service worker feeds them
// into any active /_screen/framebuffer multipart responses.
//
// This is the "output device" side of /player/calcite.html: when that
// page opens, its <img> fetches /_screen/framebuffer.
//
// The cabinet itself lives in Cache Storage (written there by the
// builder) — the bridge reads it from the cache when a viewer connects
// or a 'cabinet-updated' broadcast asks for an eager compile. One
// store, one path: a fresh page load and a mid-session build compile
// through the same code.
//
// Lifetime: tied to the page that spawned the bridge. Close that tab
// and this worker dies; the runner freezes on its last frame.
//
// `video-modes.mjs` is sibling shim code (CSS-DOS adapter that maps
// raw VRAM bytes + BDA mode byte to pixels). The wasm module is reached
// via `/calcite/pkg/` from the dev-server alias `/calcite/` →
// `../calcite/web/`.

import { pickMode, decodeCga4, decodeCga2, rasteriseText, modeName } from '/shim/video-modes.mjs';
import { getCabinetBlob } from '/browser-builder/storage.mjs';

// Silence the calcite WASM's info/log/debug chatter (it emits a handful of
// lines per parse/compile + periodic informational logs). We keep warn/error
// so genuine problems still surface. Done at module top so it applies before
// the WASM init below can fire any of its startup messages.
{
  const noop = () => {};
  console.log = noop;
  console.info = noop;
  console.debug = noop;
}

let initCalcite, CalciteEngine;

let engine = null;
let fontAtlas = null;
let running = false;      // tick loop gate — true only while a viewer is watching
let bootPromise;          // assigned below once boot() is kicked off
let viewerWaiting = false; // a viewer fetched the framebuffer before compile finished

// The origin-wide bridge bus, shared with the service worker (which
// subscribes per open framebuffer stream and rebroadcasts /_kbd hits)
// and the builder page (which broadcasts 'cabinet-updated'). One
// object suffices: BroadcastChannel never delivers a message back to
// the object that sent it, so our frame posts don't echo into our own
// handler. Name must match web/site/public/sw.js.
const bus = new BroadcastChannel('cssdos-bridge');

// True after a 'cabinet-updated' broadcast until the new cabinet is
// compiled — the next viewer-connected recompiles from the cache.
let cabinetPending = false;
// In-flight compile promise, so simultaneous viewer-connected /
// cabinet-updated triggers share one compile instead of racing.
let compileInFlight = null;

// Single-bridge arbitration (matches the old SW-port replacement
// semantics: last bridge wins). Every bridge announces itself once at
// boot; since a broadcast never reaches its own sender, anyone who
// hears an announcement is an older bridge — it mutes for good.
let muted = false;
bus.postMessage({ type: 'bridge-takeover' });


// Batch pacing — start small (200 cycles) and let the EMA grow
// batchCount until each tick hits ~TARGET_MS. For dense cabinets the
// steady state is a few thousand cycles per batch; for sparse ones it
// walks up to MAX. Hardcoding a large MIN starves the adapter and forces
// hundreds of milliseconds per batch on any cabinet calcite finds expensive.
// Fixed-cadence batch sizing.
// We sample the framebuffer at 30Hz (matches doom8088's native gametic
// rate; faster sampling sees the same partial-frame state). Batches
// target the same 33ms wall budget so each batch produces ~one sample's
// worth of work and input latency stays bounded.
//
// No adaptive feedback: the cabinet's wall-fps is governed by how
// expensive its rendering is, not by anything we can tune in the
// bridge. Adaptive sizing added mechanism without a win.
const TARGET_MS = 33;            // ≈ 30Hz; ~33ms input latency ceiling
const EMA_ALPHA = 0.3;
const MIN_BATCH = 50;
const MAX_BATCH = 200_000;
let batchCount = 200;
let batchMsEma = TARGET_MS;
// Keyboard input queue, drained by the tickLoop.
//
// Why a queue. Two presses arriving within the press-hold window can't
// be merged into one held key — the cabinet's edge detector only fires
// `_kbdPress` on a 0→non-zero transition. So if the user mashes LEFT
// at 5/sec, presses overlap, the second click writes 0x4B00 again
// while the first is still held, the cabinet sees no edge, and the
// click is lost. Result: long hold instead of N taps.
//
// Fix: buffer presses; the tickLoop walks each through the cycle
// {hold N batches at value, gap M batches at 0} so every press
// produces a real 0→N→0 transition. KEY_HOLD_BATCHES is the press
// hold; KEY_GAP_BATCHES is the trailing 0-tick gap before the next
// queued press fires (must be ≥ 1 so the edge detector resets).
//
// Queue entries are {op, sel} objects:
//   {op:'pulse', sel:'kb-x'}   — momentary press. The drainer walks it
//     through set_pseudo_class_active('active','kb-x',true) → hold N
//     batches → (...false) → gap M batches.
//   {op:'latch', sel:'kb-x'}   — hold the key: ('checked','kb-x-hold',
//     true), then a gap. No release is scheduled — the key stays down
//     until an unlatch op.
//   {op:'unlatch', sel:'kb-x'} — release a held key: ('checked',
//     'kb-x-hold', false), then a gap.
// The gaps guarantee every make/break lands on its own tick so the
// cabinet's 0 ↔ non-zero edge detector sees each transition.
//
// The cabinet's `&:has(#SEL:active) { --PROP: V }` and
// `&:has(#SEL-hold:checked) { --PROP: V }` rules produce V via calcite's
// input-edge recogniser; the host only flips the gates. (calcite's old
// `set_keyboard` host API is gone — it was an x86-aware side-channel,
// retired with the keyboard rework.)
//
// Driven off tickLoop instead of setTimeout because build.html is a
// background tab and Chrome throttles setTimeout there to ~1 Hz.
const keyQueue = [];
let currentHoldBatches = 0;     // > 0 while a press is being held
let currentGapBatches = 0;      // > 0 during the trailing 0-tick gap
let currentActiveSelector = ''; // non-empty while pulsing a pseudo-class edge
const KEY_HOLD_BATCHES = 8;
const KEY_GAP_BATCHES = 2;
// Hold-latch state. The player's per-key "pin" checkboxes are the source
// of truth: every key submission carries the checked-pin set (held=...),
// and we reconcile the engine's latch to it. The cabinet has a single
// --keyboard wire (one key down at a time — see kiln/template.mjs
// emitKeyboardRules), so at most one key is latched; while it is, plain
// key pulses are dropped (they'd be edge-invisible to the machine, and
// overlapping active edges are exactly the case where calcite's
// summed-edges apply could diverge from Chrome's cascade).
let latchTarget = '';           // key id whose pin latch is applied/queued
// Trace toggle. Off by default — Playwright tests flip it on via the
// 'kbd-trace' message type. Logs on (a) message receipt, (b) drainer
// dispatch, (c) drainer release. Lets you measure click→engine.set_pseudo_class_active
// latency separate from any cabinet-side delay.
//
// Trace output goes to console.log (visible in DevTools / page-attached
// consoles) AND to a BroadcastChannel so Playwright tests at the page
// level can capture it without walking the iframe → worker tree.
let kbdTraceEnabled = false;
let kbdTraceChannel = null;
// When non-zero, the tickLoop uses engine.run_batch_watched(batchCount,
// watchChunkTicks) so registered watches actually poll. Set by the
// bench harness via 'set-watch-chunk-ticks'. Zero = disabled (player
// path, no watches → run_batch_silent).
let watchChunkTicks = 0;
function kbdTrace(msg) {
  console.log(msg);
  if (!kbdTraceChannel) {
    try { kbdTraceChannel = new BroadcastChannel('cssdos-kbd-trace'); } catch {}
  }
  if (kbdTraceChannel) {
    try { kbdTraceChannel.postMessage(msg); } catch {}
  }
}

// Wrapper around engine.set_pseudo_class_active that reports the first
// failure instead of swallowing it. A bare `try{}catch{}` here once hid
// a missing-API regression for two weeks (the player keyboard was dead
// while the bench, which injects keys via watch actions, stayed green).
let pseudoActiveErrorLogged = false;
function setPseudoActive(pseudo, selector, value) {
  try {
    engine.set_pseudo_class_active(pseudo, selector, value);
  } catch (e) {
    if (!pseudoActiveErrorLogged) {
      pseudoActiveErrorLogged = true;
      console.error('[calcite-bridge] set_pseudo_class_active failed — keyboard input is broken:', e);
      postStatus('keyboard input broken: ' + (e?.message || e));
    }
  }
}

// ---------- Bootstrap ----------

// Cache-busting canary — bump this when you change this file so you can
// confirm the browser is serving the new version (it appears in the
// status line and the bridge-info reply).
const BRIDGE_VERSION = 'bridge-2';

async function boot() {
  postStatus(`bridge boot ${BRIDGE_VERSION}`);
  // 1. Load WASM — dynamic import from the same path calcite-worker.js
  //    uses, so any module-caching the browser does applies here too.
  const mod = await import('/calcite/pkg/calcite_wasm.js');
  initCalcite = mod.default;
  CalciteEngine = mod.CalciteEngine;
  await initCalcite();
  // 2. Try to grab the VGA font for text modes. (Before cabinet
  //    compile so it overlaps with any in-flight build.)
  try {
    const fr = await fetch('/player/fonts/vga-8x16.bin');
    if (fr.ok) {
      const buf = new Uint8Array(await fr.arrayBuffer());
      if (buf.length === 4096) fontAtlas = buf;
    }
  } catch {}
  postStatus('waiting for a cabinet to be built...');
}

// Parse + compile raw cabinet bytes into a CalciteEngine. The ArrayBuffer
// comes from reading the cached cabinet response (compileCabinetFromCache
// below) — all off the main thread, no JS-string intermediate.
//
// The cabinet self-describes its rom-disk: disk bytes are embedded in the
// cabinet's `--readDiskByte` flat dispatch and calcite recognises the
// `--readMem` window pattern at compile time, installing a fast-path
// descriptor on State automatically. No separate disk-bytes payload is
// needed (engine.set_disk_image was removed in calcite v30).
async function compileCabinetBytes(arrayBuffer) {
  if (engine && typeof engine.free === 'function') {
    try { engine.free(); } catch {}
  }
  engine = null;
  const bytes = new Uint8Array(arrayBuffer);
  postStatus('compiling cabinet (' + (bytes.length / 1024 / 1024).toFixed(1) + ' MB)...');
  const t0 = performance.now();
  engine = CalciteEngine.new_from_bytes(bytes);
  const compileMs = performance.now() - t0;
  // Diagnostic readouts the harness can verify post-compile. Older calcite-wasm
  // builds don't expose these getters; guard with `?.()` so the bridge stays
  // backwards-compatible.
  const portCount = engine.packed_broadcast_port_count
    ? engine.packed_broadcast_port_count() | 0
    : -1;
  const opCount = engine.compiled_op_count
    ? engine.compiled_op_count() | 0
    : -1;
  const slotCount = engine.compiled_slot_count
    ? engine.compiled_slot_count() | 0
    : -1;
  // Surface to the page via console.warn (console.info is silenced above).
  // The harness scrapes these for cabinet-shape verification.
  console.warn(`[bridge] compiled: ports=${portCount} ops=${opCount} slots=${slotCount} compileMs=${Math.round(compileMs)}`);
  postStatus(`cabinet compiled in ${(compileMs / 1000).toFixed(1)}s (ready)`);
  // Publish the compile time on the bench-stats channel so harnesses can
  // record it without parsing the status text.
  try {
    if (benchChannel) {
      benchChannel.postMessage({
        type: 'compile-done',
        compileMs,
        cabinetBytes: bytes.length,
        packedBroadcastPortCount: portCount,
        compiledOpCount: opCount,
        compiledSlotCount: slotCount,
      });
    }
  } catch {}
  // If a viewer fetched the framebuffer while we were compiling, fire
  // the start sequence now. The viewer-connected handler that ran
  // during compile joined the in-flight compile; this hook is the one
  // place a compile-then-run starts.
  if (viewerWaiting && engine) {
    startRunning();
  }
}

// Read the cabinet from Cache Storage and compile it. The single entry
// point for every compile trigger — first viewer after a page load
// (rehydration), viewer after a lazy build, eager build, viewer racing
// an in-flight compile — they all share one promise.
function compileCabinetFromCache() {
  if (!compileInFlight) {
    compileInFlight = (async () => {
      try {
        await bootPromise;
        const blob = await getCabinetBlob();
        if (!blob) {
          postStatus('no cabinet in Cache Storage — build one first');
          return;
        }
        cabinetPending = false;
        const buf = await blob.arrayBuffer();
        await compileCabinetBytes(buf);
      } finally {
        compileInFlight = null;
      }
    })();
  }
  return compileInFlight;
}

// Reset engine state to power-on, start the tick loop, mark the bridge
// as actively running. Idempotent — calling twice is harmless.
//
// `preserveWatches`: when true, skip the engine.reset() inside
// resetMachine(). engine.reset() drops every registered watch (see
// calcite-wasm reset()), so the bench path — which registers watches
// BEFORE starting — must not reset, or the watch registry is empty
// and run_batch_watched degrades to run_batch_silent (no stage
// detection, run never halts). The engine is already at power-on
// immediately post-compile (new_from_bytes; nothing has ticked), so
// for the bench entry the reset is redundant anyway.
// Idempotent: the iframe player's framebuffer viewer-connected and
// the profile's bench-run can both call this. Whichever is first
// does the reset+start; the second is a no-op (running-guard) so it
// can't double-reset and wipe watches the profile registered after
// `running-started`. After a real start we broadcast `running-started`
// on cssdos-bridge-stats — the bench page waits for that before
// registering watches, guaranteeing the (single) reset already happened.
function startRunning(preserveWatches = false) {
  if (running) {
    // Expected whenever a second caller races a live run (another
    // framebuffer viewer, bench-run vs viewer-connected). Debug-level:
    // at status level it stuck in the player's status bar looking
    // like an error.
    postDebug('startRunning called while already running — no-op');
    return;
  }
  postStatus(preserveWatches
    ? 'startRunning: starting tickloop (watches preserved)'
    : 'startRunning: resetting + starting tickloop');
  resetMachine(preserveWatches);
  if (engine) {
    running = true;
    tickLoop();
    startFrameSampler();
    // Broadcast so bench harness profiles can wait for the engine to
    // actually be running before registering watches (otherwise the
    // engine.reset() inside resetMachine() wipes any watches the host
    // registered between compile-done and the first viewer-connected).
    try {
      if (benchChannel) benchChannel.postMessage({ type: 'running-started' });
    } catch {}
  }
}


// Reset the machine to its power-on state. Called on every viewer
// connection — the engine is already compiled, so this only resets
// runtime state via engine.reset(). Cheap. The CPU restarts at the
// reset vector; BIOS splash plays; boot proceeds.
function resetMachine(preserveWatches = false) {
  if (!engine) return;
  // engine.reset() also clears the watch registry. The bench path
  // registers watches before starting and must keep them, so skip the
  // reset there (engine is already pristine post-compile).
  if (!preserveWatches) engine.reset();
  // Reset pacing so the adapter relearns for the new run.
  batchCount = MIN_BATCH;
  batchMsEma = TARGET_MS;
  keyQueue.length = 0;
  currentHoldBatches = 0;
  currentGapBatches = 0;
  currentActiveSelector = '';
  // engine.reset() rebuilds State from scratch (pseudo_active empties),
  // so any latched pin is already gone engine-side; drop our mirror.
  // The page's pin checkboxes may still be checked — the next key press
  // resubmits the held set and the latch is re-applied.
  latchTarget = '';
  // Tear down the existing stats interval so no stale stats sample
  // (with the previous run's cycleCount) leaks through to a viewer
  // that reconnects on top of an existing bridge. startStatsInterval
  // below re-arms it; the first sample post-reset reflects fresh
  // (cycleCount=0) state.
  if (statsIntervalId) {
    clearInterval(statsIntervalId);
    statsIntervalId = null;
    frameCount = 0;
    lastReportFrames = 0;
  }
  stopFrameSampler();
  postStatus('machine reset; running');
  startStatsInterval();
}

function postStatus(msg) {
  // Status updates go to the tab that spawned us (build.html)
  // for debugging; they aren't surfaced to the calcite.html runner.
  self.postMessage({ type: 'status', message: msg });
}

// Verbose per-frame / per-mode-change diagnostics. Sent as type:'debug' so
// the boot shim keeps them out of the console unless verbose logging is on
// (?bridgeDebug or localStorage cssdos-bridge-debug). Keeps the console
// clean during compile + play without losing the traces when you want them.
function postDebug(msg) {
  self.postMessage({ type: 'debug', message: msg });
}

// ---------- Tick loop ----------

function tickLoop() {
  if (!running || !engine) return;
  // Drain the key queue. Each press follows the cycle:
  // hold (KEY_HOLD_BATCHES at value) → gap (KEY_GAP_BATCHES at 0).
  // The trailing gap guarantees the next queued press, even if it's
  // the same key, produces a fresh 0→N edge that the CSS edge detector
  // can fire `_kbdPress` for.
  if (currentHoldBatches > 0) {
    currentHoldBatches--;
    if (currentHoldBatches === 0) {
      if (currentActiveSelector) {
        setPseudoActive('active', currentActiveSelector, false);
        currentActiveSelector = '';
      }
      currentGapBatches = KEY_GAP_BATCHES;
      if (kbdTraceEnabled) kbdTrace(`[kbd-trace] release wallMs=${performance.now().toFixed(1)}`);
    }
  } else if (currentGapBatches > 0) {
    currentGapBatches--;
  } else if (keyQueue.length > 0) {
    const { op, sel } = keyQueue.shift();
    if (op === 'latch' || op === 'unlatch') {
      // Pin latch: flip the 'checked' pseudo-class of the key's pin
      // element. No hold countdown — a latch stays until unlatched.
      // The trailing gap keeps the next op's edge on its own tick.
      setPseudoActive('checked', sel + '-hold', op === 'latch');
      currentGapBatches = KEY_GAP_BATCHES;
      if (kbdTraceEnabled) kbdTrace(`[kbd-trace] ${op} checked=${sel}-hold wallMs=${performance.now().toFixed(1)} qlen=${keyQueue.length}`);
    } else {
      setPseudoActive('active', sel, true);
      currentActiveSelector = sel;
      currentHoldBatches = KEY_HOLD_BATCHES;
      if (kbdTraceEnabled) {
        const cyc = (engine.get_state_var ? engine.get_state_var('cycleCount') : 0) >>> 0;
        const tickN = (engine.get_tick ? engine.get_tick() : 0) >>> 0;
        kbdTrace(`[kbd-trace] dispatch active=${sel} wallMs=${performance.now().toFixed(1)} cycle=${cyc} tick=${tickN} qlen=${keyQueue.length}`);
      }
    }
  }
  const batchStart = performance.now();
  try {
    // run_batch_silent skips the per-batch state-var diff + JSON
    // serialization that tick_batch does. The bridge doesn't read the
    // JSON; we observe state via direct get_state_var / read_*
    // calls below.
    if (watchChunkTicks > 0 && engine.run_batch_watched) {
      // Bench-harness path: watch registry polls every watchChunkTicks
      // engine ticks. Halts the loop if a watch's halt action fires.
      // The wasm impl uses an internal monotonic watch_clock starting
      // at 0 (not state.frame_counter) so Stride{every} watches fire
      // at clean boundaries regardless of when watches got registered.
      const halted = engine.run_batch_watched(batchCount, watchChunkTicks);
      if (halted) {
        running = false;
        postStatus('watch-halted');
      }
    } else if (engine.run_batch_silent) {
      engine.run_batch_silent(batchCount);
    } else {
      engine.tick_batch(batchCount);
    }
  } catch (e) {
    postStatus('engine error: ' + (e.message || String(e)));
    running = false;
    return;
  }
  const batchDt = performance.now() - batchStart;
  batchMsEma = batchMsEma * (1 - EMA_ALPHA) + batchDt * EMA_ALPHA;
  // Walk batchCount toward the count that lands TARGET_MS per batch.
  // Clamped 0.5×/2× per loop so it converges over a few batches without
  // overshooting on a one-off slow batch.
  const ratio = Math.max(0.5, Math.min(2.0, TARGET_MS / batchMsEma));
  batchCount = Math.max(MIN_BATCH, Math.min(MAX_BATCH, Math.round(batchCount * ratio)));

  // Yield back to the event loop so bus messages (kbd input) get
  // drained promptly. We use MessageChannel here rather than
  // setTimeout because build.html is a background tab while the
  // user watches calcite.html in the foreground, and Chrome
  // throttles setTimeout in background-tab-owned workers to ~1 Hz.
  // MessageChannel posts are macrotasks that are not subject to that
  // throttle, so the tick loop runs at full speed regardless of
  // which tab is in front.
  tickChannel.port1.postMessage(0);
}

const tickChannel = new MessageChannel();
tickChannel.port2.onmessage = () => tickLoop();

// 60Hz framebuffer sampler — independent of the tick loop. Reads the
// current framebuffer, hashes a sparse subsample, and emits a BMP only
// when the hash changes. Decouples paint cadence from batch cadence
// (the engine is free to use big batches when nothing visible is
// happening; the sampler still catches frames at up to 60Hz when they
// appear).
//
// Why setInterval not setTimeout chain: Chrome throttles setInterval to
// ~1Hz in background tabs, but the bridge worker lives in build.html
// (background). MessageChannel-pumped tick loop bypasses that for tick
// work. The sampler is paint-only and CAN run slow when backgrounded
// — that's actually fine (no point painting an invisible tab at 60Hz).
const FRAME_SAMPLER_HZ = 30;
let frameSamplerId = null;
function startFrameSampler() {
  if (frameSamplerId) return;
  frameSamplerId = setInterval(() => {
    if (!running || !engine) return;
    try { maybeEmitFrame(); } catch {}
  }, Math.round(1000 / FRAME_SAMPLER_HZ));
}
function stopFrameSampler() {
  if (frameSamplerId) { clearInterval(frameSamplerId); frameSamplerId = null; }
}

// ---------- Framebuffer extraction + BMP emit ----------
//
// No OffscreenCanvas, no convertToBlob. We build a BMP frame in-memory
// by writing a BITMAPV4HEADER (top-down via negative height, BI_BITFIELDS
// with RGBA channel masks) directly over the RGBA bytes. Chrome decodes
// this natively in <img>. The only per-frame work is a single Uint8Array
// allocation + one .set() of the pixels.
//
// Why not JPEG/WebP: encoding cost (~20-30 ms) was dominating the pipeline.
// BMP costs ~0 ms to "encode"; the trade is wire size (~256 KB/frame for
// 320x200, ~2 MB for 640x400 text-through-font). The SW→<img> path is
// entirely in-process so wire size is cheap.
//
// Header layout (122 bytes total):
//   [0..14)   BITMAPFILEHEADER      "BM" + file size + pixel offset
//   [14..122) BITMAPV4HEADER       size, geometry, bitfield masks, colourspace

const BMP_HEADER_SIZE = 14 + 108; // fileheader + V4
let bmpCachedHeader = null;
let bmpCachedGeom = { w: 0, h: 0 };

function buildBmpHeader(w, h) {
  if (bmpCachedHeader && bmpCachedGeom.w === w && bmpCachedGeom.h === h) {
    return bmpCachedHeader;
  }
  const pixelBytes = w * h * 4;
  const fileSize = BMP_HEADER_SIZE + pixelBytes;
  const buf = new ArrayBuffer(BMP_HEADER_SIZE);
  const dv = new DataView(buf);
  // BITMAPFILEHEADER
  dv.setUint8(0, 0x42); dv.setUint8(1, 0x4D);         // 'BM'
  dv.setUint32(2, fileSize, true);                     // bfSize
  dv.setUint32(6, 0, true);                            // reserved
  dv.setUint32(10, BMP_HEADER_SIZE, true);             // bfOffBits
  // BITMAPV4HEADER
  dv.setUint32(14, 108, true);                         // biSize
  dv.setInt32(18, w, true);                            // biWidth
  dv.setInt32(22, -h, true);                           // biHeight (negative = top-down)
  dv.setUint16(26, 1, true);                           // biPlanes
  dv.setUint16(28, 32, true);                          // biBitCount
  dv.setUint32(30, 3, true);                           // biCompression = BI_BITFIELDS
  dv.setUint32(34, pixelBytes, true);                  // biSizeImage
  dv.setInt32(38, 2835, true);                         // biXPelsPerMeter (72 dpi)
  dv.setInt32(42, 2835, true);                         // biYPelsPerMeter
  dv.setUint32(46, 0, true);                           // biClrUsed
  dv.setUint32(50, 0, true);                           // biClrImportant
  // Channel masks: little-endian RGBA-in-memory ⇒ byte 0 = R, byte 1 = G, etc.
  dv.setUint32(54, 0x000000FF, true);                  // R mask
  dv.setUint32(58, 0x0000FF00, true);                  // G mask
  dv.setUint32(62, 0x00FF0000, true);                  // B mask
  dv.setUint32(66, 0xFF000000, true);                  // A mask
  dv.setUint32(70, 0x57696E20, true);                  // CSType = 'Win ' (sRGB)
  // Remaining 36 bytes of BITMAPV4HEADER (endpoints + gammas) zeroed by default.
  bmpCachedHeader = new Uint8Array(buf);
  bmpCachedGeom = { w, h };
  return bmpCachedHeader;
}

// Debug ring buffer — accumulates short one-line summaries from
// maybeEmitFrame and flushes them at ~1 Hz via postStatus so you can
// see exactly what the bridge decided each frame without flooding.
let _dbgLast = '';
let _dbgSame = 0;
function dbgFrame(line) {
  if (line === _dbgLast) { _dbgSame++; return; }
  if (_dbgSame > 0) postDebug(`  (repeated ${_dbgSame}x) ${_dbgLast}`);
  _dbgSame = 0;
  _dbgLast = line;
  postDebug(line);
}

// Mode-history log. Whenever the active mode, the last-requested mode
// (0x04F2 shadow, written by corduroy on every INT 10h AH=00h), or the
// CGA palette register (0x04F3 shadow) changes, emit a one-line trace
// with the current cycle count. Lets us see exactly what video state the
// guest program is driving without wiring a full tracer.
let _lastActiveMode = -1;
let _lastReqMode = -1;
let _lastPalReg = -1;
function traceVideoState(activeMode, reqMode, palReg) {
  const cycles = engine.get_state_var('cycleCount') >>> 0;
  if (activeMode !== _lastActiveMode) {
    const name = modeName(activeMode);
    postDebug(`[video @cyc ${cycles.toLocaleString()}] active mode → 0x${activeMode.toString(16).padStart(2,'0')} (${name})`);
    _lastActiveMode = activeMode;
  }
  if (reqMode !== _lastReqMode && reqMode !== 0) {
    const name = modeName(reqMode);
    const remapped = reqMode !== activeMode ? ` — REMAPPED (active=0x${activeMode.toString(16)})` : '';
    postDebug(`[video @cyc ${cycles.toLocaleString()}] requested → 0x${reqMode.toString(16).padStart(2,'0')} (${name})${remapped}`);
    _lastReqMode = reqMode;
  }
  if (palReg !== _lastPalReg) {
    const bg = palReg & 0x0F;
    const intensity = (palReg >> 4) & 1;
    const palSet = (palReg >> 5) & 1;
    postDebug(`[video @cyc ${cycles.toLocaleString()}] pal-reg 0x04F3 → 0x${palReg.toString(16).padStart(2,'0')} (bg=${bg} intensity=${intensity} palette=${palSet})`);
    _lastPalReg = palReg;
  }
}

function maybeEmitFrame() {
  if (muted) return;

  const modeByte = engine.get_video_mode();
  const reqMode = engine.get_requested_video_mode ? engine.get_requested_video_mode() : 0;
  const palReg = engine.read_memory_range(0x04F3, 1)[0] | 0;
  traceVideoState(modeByte, reqMode, palReg);

  const mode = pickMode(modeByte);
  if (!mode) {
    dbgFrame(`frame: mode=0x${modeByte.toString(16)} pickMode=null — skipping`);
    return;
  }
  const w = mode.width, h = mode.height;
  let rgba = null;
  if (mode.kind === 'mode13') {
    rgba = engine.read_framebuffer_rgba(mode.vramAddr, w, h);
    dbgFrame(`frame: mode=0x${modeByte.toString(16)} kind=mode13 ${w}x${h} @0x${mode.vramAddr.toString(16)} rgba[0..4]=${[rgba[0],rgba[1],rgba[2],rgba[3]].join(',')}`);
  } else if (mode.kind === 'cga4') {
    const vram = engine.read_memory_range(mode.vramAddr, 0x4000);
    rgba = new Uint8Array(w * h * 4);
    decodeCga4(vram, palReg, rgba, { mono: !!mode.mono });
    // Count non-zero bytes to tell a "blank VRAM" frame from a "decoder
    // is eating pixels" frame. Also sample a few offsets so we can see
    // whether the game is writing even-plane (0..0x1FFF) vs odd-plane
    // (0x2000..0x3FFF) vs both.
    let nzEven = 0, nzOdd = 0;
    for (let i = 0; i < 0x2000; i++) if (vram[i]) nzEven++;
    for (let i = 0x2000; i < 0x4000; i++) if (vram[i]) nzOdd++;
    dbgFrame(`frame: mode=0x${modeByte.toString(16)} kind=cga4 pal=0x${palReg.toString(16)} nz-even=${nzEven} nz-odd=${nzOdd} vram[0..4]=${Array.from(vram.slice(0,4)).join(',')}`);
  } else if (mode.kind === 'cga2') {
    // CGA 640x200x2 (hires mono): same 16 KB aperture and even/odd plane
    // split as mode 0x04, but 1 bpp and 640 pixels wide.
    const vram = engine.read_memory_range(mode.vramAddr, 0x4000);
    rgba = new Uint8Array(w * h * 4);
    decodeCga2(vram, palReg, rgba);
    dbgFrame(`frame: mode=0x${modeByte.toString(16)} kind=cga2 pal=0x${palReg.toString(16)} vram[0..4]=${Array.from(vram.slice(0,4)).join(',')}`);
  } else if (mode.kind === 'text' && fontAtlas) {
    const vram = engine.read_memory_range(mode.vramAddr, mode.textCols * mode.textRows * 2);
    rgba = new Uint8Array(w * h * 4);
    const cycles = engine.get_state_var('cycleCount') >>> 0;
    const bda = engine.read_memory_range(0x0450, 2);
    rasteriseText(vram, mode.textCols, mode.textRows, rgba, fontAtlas, {
      cycleCount: cycles,
      cursorCol: bda[0],
      cursorRow: bda[1],
      cursorEnabled: true,
      blinkMode: true,
    });
    // Count non-zero, non-space chars in text VRAM so we can tell if
    // the kernel has written anything.
    let nonEmpty = 0;
    for (let i = 0; i < vram.length; i += 2) {
      if (vram[i] !== 0 && vram[i] !== 0x20) nonEmpty++;
    }
    // First row as ASCII (non-printables → '.').
    let row0 = '';
    for (let c = 0; c < mode.textCols && c < 40; c++) {
      const ch = vram[c * 2];
      row0 += (ch >= 0x20 && ch < 0x7F) ? String.fromCharCode(ch) : '.';
    }
    dbgFrame(`frame: mode=0x${modeByte.toString(16)} kind=text ${mode.textCols}x${mode.textRows} chars=${nonEmpty} row0="${row0}"`);
  } else if (mode.kind === 'text' && !fontAtlas) {
    dbgFrame(`frame: mode=0x${modeByte.toString(16)} kind=text — SKIPPED (no fontAtlas)`);
    return;
  } else {
    dbgFrame(`frame: mode=0x${modeByte.toString(16)} kind=${mode.kind} — unhandled, skipping`);
    return;
  }

  // Always emit. The previous hash-based dedup sampled every ~250th byte
  // of rgba, which is unsound: a sprite or cursor change at a non-sampled
  // position produced an identical hash and the frame was dropped. The
  // user saw that as a frozen screen that "unfreezes" only when typing
  // happened to perturb a sampled byte. By the time we reach this point
  // we've already paid the expensive read+palette-resolve cost; the only
  // saving from skipping was a BMP header memcpy + postMessage, ~256 KB
  // at 30 Hz = ~8 MB/s, trivial. Worth it to keep the screen live.

  // Assemble BMP: header + RGBA pixels in one buffer. For text mode we
  // own `rgba` (just allocated); for gfx mode it's a wasm-memory view
  // we must copy out of. Single combined allocation is cleaner.
  const header = buildBmpHeader(w, h);
  const pixelBytes = w * h * 4;
  const fileBytes = new Uint8Array(BMP_HEADER_SIZE + pixelBytes);
  fileBytes.set(header, 0);
  fileBytes.set(rgba, BMP_HEADER_SIZE);

  frameCount++;
  lastFrameBytes = fileBytes.byteLength;
  // Broadcast — every open framebuffer stream's SW subscription gets a
  // copy. BroadcastChannel can't transfer, but the structured clone of
  // a ≤2 MB frame at ≤30 Hz is memcpy noise.
  bus.postMessage({ type: 'frame', bytes: fileBytes.buffer, width: w, height: h, mime: 'image/bmp' });
}

let frameCount = 0;
let lastReportFrames = 0;
let lastFrameBytes = 0;
let statsIntervalId = null;

// Bench-stats channel. Anyone on the same origin can subscribe to
// 'cssdos-bridge-stats' for 1 Hz samples of cycles/frames/batch — the
// bench page uses this. Publishing it unconditionally is cheap (no
// listeners = no-op postMessage).
let benchChannel = null;
try { benchChannel = new BroadcastChannel('cssdos-bridge-stats'); } catch {}
const bridgeStartMs = performance.now();

function startStatsInterval() {
  if (statsIntervalId) return;
  statsIntervalId = setInterval(() => {
    const delta = frameCount - lastReportFrames;
    lastReportFrames = frameCount;
    const cycles = engine ? (engine.get_state_var('cycleCount') >>> 0) : 0;
    // Recurring 1 Hz runtime stats. Sent as type:'stats' (not 'status') so
    // the boot shim can keep it out of the console by default — it was the
    // main source of per-frame log spam. Verbose mode surfaces it.
    self.postMessage({
      type: 'stats',
      message:
        `[${BRIDGE_VERSION}] ${delta} fps | cycles ${cycles.toLocaleString()} ` +
        `| size ${(lastFrameBytes/1024).toFixed(0)}KB ` +
        `| batch ${batchMsEma.toFixed(1)}ms (${batchCount} cyc) ` +
        `| mode=0x${engine ? engine.get_video_mode().toString(16) : '?'}`,
    });
    if (benchChannel) {
      try {
        const ticks = engine && engine.get_tick ? (engine.get_tick() >>> 0) : 0;
        benchChannel.postMessage({
          type: 'bridge-stats',
          wallMs: performance.now() - bridgeStartMs,
          cycles,
          ticks,
          framesEncoded: frameCount,
          lastFrameBytes,
          batchCount,
          batchMsEma,
          fpsWindow: delta,
          videoMode: engine ? engine.get_video_mode() : null,
        });
      } catch {}
    }
  }, 1000);
}

// ---------- Main-thread messages ----------

self.onmessage = (ev) => {
  const d = ev.data;
  if (!d || !d.type) return;
  // Debug peek-mem: read N bytes from a guest linear address. Reply on the
  // transferred MessagePort. Used by Playwright tests to verify keyboard
  // shadow + IRQ state.
  if (d.type === 'peek-mem' && engine && ev.ports && ev.ports[0]) {
    try {
      const bytes = engine.read_memory_range(d.addr | 0, d.len | 0);
      ev.ports[0].postMessage({ ok: true, bytes: Array.from(bytes) });
    } catch (e) {
      ev.ports[0].postMessage({ ok: false, err: String(e) });
    }
    return;
  }
  // Debug peek-var: read a state var by bare name (e.g. 'keyboard').
  // Used by Playwright tests to verify the hold-latch path — --keyboard
  // stays at the key's value while its pin is latched.
  if (d.type === 'peek-var' && engine && ev.ports && ev.ports[0]) {
    try {
      ev.ports[0].postMessage({ ok: true, value: engine.get_state_var(String(d.name)) | 0 });
    } catch (e) {
      ev.ports[0].postMessage({ ok: false, err: String(e) });
    }
    return;
  }
  if (d.type === 'kbd-trace') {
    kbdTraceEnabled = !!d.enabled;
    kbdTrace(`[kbd-trace] toggle enabled=${kbdTraceEnabled}`);
    return;
  }
  // Per-phase compile timing (JSON) recorded by calcite during the engine
  // constructor. Worker console logs don't reach the host page, so this is
  // the only way to see the wasm compile breakdown.
  if (d.type === 'phase-report' && engine && ev.ports && ev.ports[0]) {
    try {
      ev.ports[0].postMessage({ ok: true, report: engine.compile_phase_report() });
    } catch (e) {
      ev.ports[0].postMessage({ ok: false, err: String(e) });
    }
    return;
  }
  if (d.type === 'bridge-info' && ev.ports && ev.ports[0]) {
    ev.ports[0].postMessage({
      ok: true,
      version: BRIDGE_VERSION,
      running,
      watchChunkTicks,
      batchCount,
      batchMsEma,
    });
    return;
  }
  if (d.type === 'peek-state' && engine && ev.ports && ev.ports[0]) {
    try {
      const v = engine.get_state_var(d.name);
      ev.ports[0].postMessage({ ok: true, value: v });
    } catch (e) {
      ev.ports[0].postMessage({ ok: false, err: String(e) });
    }
    return;
  }
  // Snapshot the engine's runtime state for later restore. Returns the
  // raw bytes via the transferred MessagePort. Same-cabinet only; the
  // blob is meaningless against any other cabinet.
  if (d.type === 'snapshot-out' && engine && ev.ports && ev.ports[0]) {
    try {
      const bytes = engine.snapshot();
      const ab = new ArrayBuffer(bytes.length);
      new Uint8Array(ab).set(bytes);
      ev.ports[0].postMessage({ ok: true, bytes: ab }, [ab]);
    } catch (e) {
      ev.ports[0].postMessage({ ok: false, err: String(e) });
    }
    return;
  }
  if (d.type === 'restore-in' && engine && d.bytes && ev.ports && ev.ports[0]) {
    try {
      engine.restore(new Uint8Array(d.bytes));
      ev.ports[0].postMessage({ ok: true });
    } catch (e) {
      ev.ports[0].postMessage({ ok: false, err: String(e) });
    }
    return;
  }
  // Bench-harness watch primitives (calcite-core script layer). Lets
  // tests/bench/profiles/*.mjs register --watch-shaped specs against
  // the engine and drain MeasurementEvents. The player path doesn't
  // touch any of these — they're purely additive.
  if (d.type === 'register-watch' && engine && ev.ports && ev.ports[0]) {
    try {
      const idx = engine.register_watch(d.spec);
      ev.ports[0].postMessage({ ok: true, watchIndex: idx });
    } catch (e) {
      ev.ports[0].postMessage({ ok: false, err: String(e.message || e) });
    }
    return;
  }
  if (d.type === 'clear-watches' && engine && ev.ports && ev.ports[0]) {
    try {
      engine.clear_watches();
      ev.ports[0].postMessage({ ok: true });
    } catch (e) {
      ev.ports[0].postMessage({ ok: false, err: String(e) });
    }
    return;
  }
  if (d.type === 'drain-measurements' && engine && ev.ports && ev.ports[0]) {
    try {
      const json = engine.drain_measurements();
      ev.ports[0].postMessage({ ok: true, events: json });
    } catch (e) {
      ev.ports[0].postMessage({ ok: false, err: String(e) });
    }
    return;
  }
  if (d.type === 'set-watch-chunk-ticks') {
    // When non-zero, the tickLoop uses run_batch_watched(...) instead
    // of run_batch_silent so the watch registry actually polls. Caller
    // typically picks 50_000 (matches the CLI default) or smaller for
    // tighter cond resolution.
    watchChunkTicks = (d.chunkTicks | 0) || 0;
    return;
  }
  if (d.type === 'bench-run' && engine) {
    // Bench-mode entry: skip the viewer-connected dance (no framebuffer
    // is being fetched by the bench page). The caller registered its
    // watches first; engine.reset() would wipe them (calcite-wasm
    // reset() drops the watch registry), leaving run_batch_watched with
    // an empty registry → it degrades to run_batch_silent, no stage is
    // ever detected, and the run never halts. The engine is already at
    // power-on right after compile (new_from_bytes; nothing ticked), so
    // start WITHOUT resetting and keep the watches. startRunning is
    // idempotent — if viewer-connected got here first, the second call
    // is a no-op via the `running` guard.
    startRunning(/* preserveWatches */ true);
    return;
  }
  if (d.type === 'bench-stop') {
    // Stop the tick loop without touching engine state. The bench
    // profile may want to inspect/snapshot before tearing down.
    running = false;
    return;
  }
  if (d.type === 'cabinet-updated') {
    // Direct-port variant of the bus message below, for callers that
    // might fire before this module finishes evaluating: worker
    // postMessage queues until the handler exists; a broadcast sent
    // before the bus subscription would be lost. The bench page uses
    // this.
    onCabinetUpdated(!!d.eager);
    return;
  }
};

// A new cabinet has been written to Cache Storage. Drop the old engine
// so no viewer sees stale state; compile now if asked (eager) or if a
// viewer is already waiting on an open stream, else on the next
// viewer-connected.
function onCabinetUpdated(eager) {
  if (engine && typeof engine.free === 'function') {
    try { engine.free(); } catch {}
  }
  engine = null;
  cabinetPending = true;
  if (eager || viewerWaiting) {
    compileCabinetFromCache().catch((e) => postStatus('compile error: ' + (e.message || e)));
  } else {
    postStatus('cabinet updated (lazy); will compile when player opens');
  }
}

// ---------- Bus messages (SW viewer/keyboard signals, builder pings) ----------

bus.onmessage = (ev) => {
  const mm = ev.data;
  if (!mm || !mm.type) return;
  if (mm.type === 'bridge-takeover') {
    // A newer bridge booted (another site tab, or this page reloaded
    // and respawned before this worker died). It owns the machine now;
    // stop ticking and never emit another frame.
    muted = true;
    running = false;
    postStatus('a newer bridge took over — this one is muted');
    return;
  }
  if (muted) return;
  if (mm.type === 'kbd-active' && engine) {
    // Legacy single-key pulse (/_kbd?class=kb-X). Enqueue; the
    // tickLoop drainer walks each press through its hold/gap cycle
    // so rapid-fire clicks each produce a real edge.
    const sel = String(mm.selector || '');
    if (sel) {
      if (kbdTraceEnabled) kbdTrace(`[kbd-trace] recv active=${sel} wallMs=${performance.now().toFixed(1)} qlen=${keyQueue.length}`);
      if (latchTarget) {
        if (kbdTraceEnabled) kbdTrace(`[kbd-trace] drop active=${sel} (latched=${latchTarget})`);
      } else {
        keyQueue.push({ op: 'pulse', sel });
      }
    }
  } else if (mm.type === 'kbd-event' && engine) {
    // Player keyboard form submission: `key` is the clicked key,
    // `held` is the full checked-pin set. Reconcile the engine's
    // latch to the pins, then handle the click:
    //  - clicked key is pinned → latch it (releasing any other latch)
    //  - latch's pin was unchecked → release it (the click that
    //    carried the uncheck is the apply gesture, not a pulse)
    //  - plain click, nothing latched → normal pulse
    //  - plain click while latched → dropped: the machine's single
    //    --keyboard wire can't see a second key while one is held
    //    (no 0↔non-zero edge), same as in the raw CSS player.
    const key = String(mm.key || '');
    const held = new Set((mm.held || []).map(String));
    if (kbdTraceEnabled) kbdTrace(`[kbd-trace] recv key=${key} held=[${[...held]}] latched=${latchTarget} qlen=${keyQueue.length}`);
    let releasedNow = '';
    if (latchTarget && !held.has(latchTarget)) {
      keyQueue.push({ op: 'unlatch', sel: latchTarget });
      releasedNow = latchTarget;
      latchTarget = '';
    }
    if (key) {
      if (held.has(key)) {
        if (latchTarget !== key) {
          if (latchTarget) keyQueue.push({ op: 'unlatch', sel: latchTarget });
          keyQueue.push({ op: 'latch', sel: key });
          latchTarget = key;
        }
      } else if (key === releasedNow) {
        // Click applied the unpin — swallow the pulse.
      } else if (latchTarget) {
        if (kbdTraceEnabled) kbdTrace(`[kbd-trace] drop key=${key} (latched=${latchTarget})`);
      } else {
        keyQueue.push({ op: 'pulse', sel: key });
      }
    }
  } else if (mm.type === 'cabinet-updated') {
    onCabinetUpdated(!!mm.eager);
  } else if (mm.type === 'viewer-connected') {
    // New viewer opened the framebuffer stream. Compile from the cache
    // if there's no engine yet (covers a fresh page load rehydrating a
    // previous session's cabinet, a lazy build, and a viewer racing an
    // in-flight compile — all one path); the viewerWaiting hook in
    // compileCabinetBytes starts the run when it's ready. With a live
    // engine, reset + tick — Play is instant.
    viewerWaiting = true;
    if (!engine || cabinetPending || compileInFlight) {
      compileCabinetFromCache().catch((e) => postStatus('compile error: ' + (e.message || e)));
    } else {
      startRunning();
    }
  } else if (mm.type === 'viewer-disconnected') {
    // No one watching — stop spinning the CPU. The engine is kept
    // around so a fast reconnect doesn't have to rebuild it, but
    // the next viewer-connected will reset it anyway.
    running = false;
    viewerWaiting = false;
  }
};

// `bootPromise` is set by the boot() invocation below. Module-scoped so
// message handlers can `await bootPromise` before touching the wasm-backed
// CalciteEngine. Without this gate, any cabinet-blob message that arrives
// during the wasm fetch races into `CalciteEngine.new_from_bytes` and
// explodes on `wasm.__wbindgen_malloc undefined`. (See the let at module
// top.)
bootPromise = boot().catch((e) => {
  postStatus('boot failed: ' + (e.message || String(e)));
  // Re-throw so awaiters surface the failure rather than silently
  // running against a broken engine.
  throw e;
});
