// web/site/public/sw.js — served at /sw.js (Vite publicDir). The old
// duplicate at web/site/sw.js was removed 2026-07-04: edits there were
// dead, public/ is what dev and dist actually serve.
// Service worker for the CSS-DOS web version.
//
// Two jobs:
//
// 1. /cabinet.css — serve from Cache Storage. The browser-side builder
//    writes into this cache; the player reads a fixed URL.
//
// 2. /_screen/framebuffer, /_screen/holdlamp and /_kbd — the
//    calcite-bridge pipeline. Frames (and hold-lamp dots) arrive from
//    the bridge worker over the 'cssdos-bridge' BroadcastChannel; each
//    open stream response holds its own channel subscription and feeds
//    the bytes into a multipart/x-mixed-replace body. /_kbd
//    submissions are rebroadcast on the same channel. This lets
//    player/calcite.html be a pure HTML+CSS runner: its <img> tags
//    pull live streams with no page-side JS.
//
// Deliberately stateless: this SW holds no cross-request state. The
// browser idle-kills service workers and restarts them with empty
// module globals, and the old MessagePort design (bridge registers a
// port, SW keeps it) needed a whole recovery handshake to survive
// that. A broadcast channel needs none: a fresh instance subscribes
// per stream and rebroadcasts keys as they come.
//
// The cache name must match web/browser-builder/storage.mjs.

const CACHE_NAME = 'cssdos-cabinets-v2';
const LEGACY_CACHE_NAMES = ['cssdos-cabinets-v1'];
const CABINET_URL = '/cabinet.css';
const STREAM_URL = '/_screen/framebuffer';
const LAMP_URL = '/_screen/holdlamp';
const KBD_URL = '/_kbd';

// Origin-wide bus shared with the bridge worker (frames, viewer
// signals, keyboard) — must match web/shim/calcite-bridge.js.
const CHANNEL_NAME = 'cssdos-bridge';

// One channel object for one-shot broadcasts (viewer signals, keys).
// Per-instance and rebuilt for free on SW restart — not handshake
// state. BroadcastChannel never delivers a message back to the object
// that sent it, so frame messages don't echo here.
const ctl = new BroadcastChannel(CHANNEL_NAME);

// Open framebuffer streams in THIS instance — only used to tell the
// bridge when the last viewer left. Reconstructible: if the browser
// kills this instance, the streams die with it.
let activeStreams = 0;

// Multipart boundary — must match the Content-Type header below.
const BOUNDARY = 'cssdoscalciteframe';
const ENC = new TextEncoder();

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    await Promise.all(
      LEGACY_CACHE_NAMES.map((name) => caches.delete(name).catch(() => false))
    );
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname === CABINET_URL) {
    event.respondWith(handleCabinet());
    return;
  }
  if (url.pathname === STREAM_URL) {
    event.respondWith(handleStream());
    return;
  }
  if (url.pathname === LAMP_URL) {
    event.respondWith(handleLamp());
    return;
  }
  if (url.pathname === KBD_URL) {
    event.respondWith(handleKbd(url));
    return;
  }
});

async function handleCabinet() {
  // Cabinets are stored chunked (body-less index + ?part=N entries —
  // see web/browser-builder/storage.mjs, whose scheme this mirrors;
  // classic SW scripts can't import the module). Reassembling as a
  // Blob-of-blobs references the cached parts without copying.
  const cache = await caches.open(CACHE_NAME);
  const index = await cache.match(CABINET_URL);
  if (index) {
    const parts = Number(index.headers.get('X-Cabinet-Parts') || '0');
    if (!parts) return index; // pre-chunking single-entry cabinet
    const blobs = [];
    let complete = true;
    for (let i = 0; i < parts; i++) {
      const p = await cache.match(`${CABINET_URL}?part=${i}`);
      if (!p) { complete = false; break; }
      blobs.push(await p.blob());
    }
    if (complete) {
      return new Response(new Blob(blobs, { type: 'text/css' }), {
        status: 200,
        headers: { 'Content-Type': 'text/css' },
      });
    }
  }
  return new Response('/* CSS-DOS: no cabinet in cache */\n', {
    status: 200,
    headers: { 'Content-Type': 'text/css' },
  });
}

// Shared multipart machinery: subscribe to one broadcast message type
// and feed each payload's bytes into a multipart/x-mixed-replace body.
// Each stream owns its own channel subscription; fan-out to multiple
// viewers is the broadcast itself, not a shared controller set.
function multipartStream(msgType, onOpen, onClose) {
  let sub = null;
  const stream = new ReadableStream({
    start(controller) {
      // Opening delimiter — Firefox likes a leading boundary before the
      // first part. Chrome accepts either way.
      controller.enqueue(ENC.encode(`--${BOUNDARY}\r\n`));
      sub = new BroadcastChannel(CHANNEL_NAME);
      sub.onmessage = (ev) => {
        const m = ev.data;
        if (!m || m.type !== msgType || !m.bytes) return;
        const bytes = new Uint8Array(m.bytes);
        const header = ENC.encode(
          `Content-Type: ${m.mime || 'image/bmp'}\r\n` +
          `Content-Length: ${bytes.byteLength}\r\n\r\n`
        );
        try {
          controller.enqueue(header);
          controller.enqueue(bytes);
          // Terminate THIS part with the next delimiter right away.
          // Chrome's multipart parser only paints a part once it sees
          // the following boundary (Content-Length is not enough), so
          // trailing the delimiter makes every frame render on arrival.
          // With leading boundaries instead, each frame showed only
          // when the NEXT one arrived — invisible at the screen's
          // 30 Hz, but the hold lamp (rare frames) lagged one toggle.
          controller.enqueue(ENC.encode(`\r\n--${BOUNDARY}\r\n`));
        } catch {
          // Controller closed underneath us (client disconnected).
          sub.close();
          sub = null;
        }
      };
      if (onOpen) onOpen();
    },
    cancel() {
      // Client closed the img connection (navigation, tab close).
      if (sub) { sub.close(); sub = null; }
      if (onClose) onClose();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': `multipart/x-mixed-replace; boundary=${BOUNDARY}`,
      'Cache-Control': 'no-store',
      // The dev server sets COEP: require-corp for SAB. SW-constructed
      // responses must explicitly carry a CORP header or they get
      // rejected by the embedder's COEP check.
      'Cross-Origin-Resource-Policy': 'same-origin',
    },
  });
}

function handleStream() {
  return multipartStream('frame',
    () => {
      activeStreams++;
      // New viewer — tell the bridge to (compile if needed and) start.
      // Idempotent bridge-side: a second viewer on a running machine is
      // a no-op via the running-guard.
      ctl.postMessage({ type: 'viewer-connected' });
    },
    () => {
      activeStreams = Math.max(0, activeStreams - 1);
      if (activeStreams === 0) {
        ctl.postMessage({ type: 'viewer-disconnected' });
      }
    });
}

function handleLamp() {
  // The player's hold-mode lamp <img>: the bridge broadcasts a tiny
  // solid-colour BMP whenever the --kbdHold wire changes. Lamp viewers
  // don't count toward activeStreams — a lamp alone must not keep the
  // engine running. On open, ask the bridge to (re-)send the current
  // state so the lamp is right immediately.
  return multipartStream('lamp',
    () => { ctl.postMessage({ type: 'lamp-viewer' }); },
    null);
}

function handleKbd(url) {
  // Two forms:
  //
  // /_kbd?key=kb-X — the player keyboard's GET form. `key` is the
  // clicked key; the bridge treats kb-hold as the hold-mode toggle
  // and everything else as a keypress pulse.
  //
  // /_kbd?class=kb-X — legacy single-key link form (experiments, old
  // pages): pulse the (active, kb-X) pseudo-class edge.
  //
  // Either way the cabinet's own `&:has(...) { --keyboard: V }` rules
  // produce the value via calcite's input-edge recogniser; the host
  // only flips the gates. Rebroadcast unconditionally — no port to be
  // missing, so no key is ever lost to an SW restart.
  const key = url.searchParams.get('key');
  const klass = url.searchParams.get('class');
  if (key) {
    ctl.postMessage({ type: 'kbd-event', key });
  } else if (klass) {
    ctl.postMessage({ type: 'kbd-active', selector: klass });
  }
  // 204 No Content — the target iframe won't re-render, page stays put.
  return new Response(null, {
    status: 204,
    headers: { 'Cross-Origin-Resource-Policy': 'same-origin' },
  });
}
