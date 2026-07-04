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
// 2. /_stream/fb and /_kbd — the calcite-bridge pipeline. When a page
//    registers a MessagePort with us ({type:'register-calcite-bridge'}),
//    we route /_stream/fb fetches into a multipart/x-mixed-replace
//    response whose body is fed by BMP frames that arrive over the
//    port, and we forward /_kbd?key=... submissions to the bridge.
//    This lets player/calcite.html be a pure HTML+CSS runner: the
//    <img src="/_stream/fb"> pulls a live stream with no page-side JS.
//
// The cache name must match web/browser-builder/storage.mjs.

const CACHE_NAME = 'cssdos-cabinets-v2';
const LEGACY_CACHE_NAMES = ['cssdos-cabinets-v1'];
const CABINET_URL = '/cabinet.css';
const STREAM_URL = '/_stream/fb';
const KBD_URL = '/_kbd';

// The single bridge MessagePort. Only one tab can be the bridge at a
// time; if a second registers, it replaces the first. The previous
// bridge's streams will then starve (fine — its frames stop arriving).
let bridgePort = null;

// Active stream responses. Each entry is a ReadableStream default
// controller that we push multipart parts into. When a frame arrives
// from the bridge we fan it out to every active controller.
const streamControllers = new Set();

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

// Messages from any client page. The bridge tab sends us a MessagePort
// at registration; subsequent frames flow over that port.
self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || !data.type) return;
  if (data.type === 'register-calcite-bridge' && event.ports && event.ports[0]) {
    if (bridgePort) {
      try { bridgePort.close(); } catch {}
    }
    bridgePort = event.ports[0];
    bridgePort.onmessage = handleBridgeMessage;
    bridgePort.postMessage({ type: 'sw-ready' });
    // If a viewer is already waiting on an open stream (we were
    // idle-restarted mid-session and just got re-handed the port),
    // kick the engine now — the stream's own viewer-connected went to
    // the dead instance.
    if (streamControllers.size > 0) {
      bridgePort.postMessage({ type: 'viewer-connected' });
    }
  }
});

// The browser idle-kills service workers and restarts them with EMPTY
// module state — bridgePort is null in the new instance, and the boot
// shim only hands its port over once, at page load. Without recovery,
// any /_stream/fb opened after an idle restart hangs forever (the
// player shows its loading text and nothing else arrives). Ask every
// window we control to re-register; calcite-bridge-boot.js answers
// with a fresh MessageChannel.
function requestBridgePort() {
  self.clients.matchAll({ type: 'window' }).then((clients) => {
    for (const c of clients) {
      try { c.postMessage({ type: 'cssdos-need-bridge' }); } catch {}
    }
  });
}

function handleBridgeMessage(ev) {
  const m = ev.data;
  if (!m || !m.type) return;
  if (m.type === 'frame' && m.bytes) {
    broadcastFrame(m.bytes, m.mime || 'image/bmp');
  }
}

function broadcastFrame(frameBuffer, mime) {
  if (streamControllers.size === 0) return;
  const bytes = new Uint8Array(frameBuffer);
  const header = ENC.encode(
    `--${BOUNDARY}\r\n` +
    `Content-Type: ${mime}\r\n` +
    `Content-Length: ${bytes.byteLength}\r\n\r\n`
  );
  const trailer = ENC.encode(`\r\n`);
  for (const controller of streamControllers) {
    try {
      controller.enqueue(header);
      controller.enqueue(bytes);
      controller.enqueue(trailer);
    } catch (e) {
      // Controller closed underneath us (client disconnected).
      streamControllers.delete(controller);
    }
  }
}

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
  if (url.pathname === KBD_URL) {
    event.respondWith(handleKbd(url));
    return;
  }
});

async function handleCabinet() {
  const cache = await caches.open(CACHE_NAME);
  const hit = await cache.match(CABINET_URL);
  if (hit) return hit;
  return new Response('/* CSS-DOS: no cabinet in cache */\n', {
    status: 200,
    headers: { 'Content-Type': 'text/css' },
  });
}

function handleStream() {
  let streamController = null;
  const stream = new ReadableStream({
    start(controller) {
      streamController = controller;
      // Opening preamble — Firefox likes a leading boundary before the
      // first part. Chrome accepts either way.
      controller.enqueue(ENC.encode(`--${BOUNDARY}\r\n`));
      streamControllers.add(controller);
      // New viewer connected — tell the bridge to reset the cabinet
      // and start running from scratch. Each /_stream/fb fetch is
      // treated as "restart the machine, I want to watch it boot".
      if (bridgePort) {
        bridgePort.postMessage({ type: 'viewer-connected' });
      } else {
        // Idle-restarted instance with no port: recover it. The
        // register handler fires viewer-connected for us once the
        // page re-hands the port over.
        requestBridgePort();
      }
    },
    cancel() {
      // Client closed the img connection (navigation, tab close).
      // Remove the controller immediately and let the bridge know
      // there's no one watching so it can pause.
      if (streamController) streamControllers.delete(streamController);
      if (streamControllers.size === 0 && bridgePort) {
        bridgePort.postMessage({ type: 'viewer-disconnected' });
      }
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

function handleKbd(url) {
  // /_kbd?class=kb-X — pulse the (active, kb-X) pseudo-class edge
  // through calcite. The cabinet's own
  // `&:has(#kb-X:active) { --keyboard: V }` rule produces the value
  // via calcite's input-edge recogniser; the host only flips the gate.
  const klass = url.searchParams.get('class');
  if (klass && bridgePort) {
    bridgePort.postMessage({ type: 'kbd-active', selector: klass });
  } else if (klass) {
    // Idle-restarted instance: this key is lost, but recover the port
    // so the next one lands.
    requestBridgePort();
  }
  // 204 No Content — the target iframe won't re-render, page stays put.
  return new Response(null, {
    status: 204,
    headers: { 'Cross-Origin-Resource-Policy': 'same-origin' },
  });
}
