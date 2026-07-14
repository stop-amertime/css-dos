// On-page health: can this browser run the player, and what is the
// engine doing right now? Play.svelte renders both - console-only
// errors are invisible on mobile, which made failures undiagnosable.
//
// Two layers:
// 1. Static capability probe (computed once at load): secure context,
//    service workers, WASM. Any failure here means the player cannot
//    work on this browser/host. NOTE deliberately absent:
//    crossOriginIsolated/SharedArrayBuffer - the engine is
//    single-threaded wasm over postMessage and runs fine without
//    isolation (verified end-to-end 2026-07-04, see logbook).
// 2. Live bridge status: the boot shim announces its phase via the
//    'cssdos-bridge-state' window event; the bridge worker posts
//    'status' messages (compiling / ready / running / *error*).

const inBrowser = typeof window !== 'undefined';

const cap = {
  secure: inBrowser && window.isSecureContext,
  sw: inBrowser && 'serviceWorker' in navigator,
  wasm: typeof WebAssembly !== 'undefined',
  deviceMemory: inBrowser ? navigator.deviceMemory : undefined,
};

const hardFailures = [];
if (!cap.sw) {
  hardFailures.push(cap.secure
    ? 'This browser has no service worker support (some private/incognito modes disable it). The player streams its screen through a service worker.'
    : 'This page is not served over HTTPS, so service workers are disabled - the player cannot stream frames. Open the site via its https:// address.');
}
if (!cap.wasm) {
  hardFailures.push('This browser has no WebAssembly support, so the Calcite engine cannot run.');
}

const softWarnings = [];
if (!hardFailures.length && cap.deviceMemory && cap.deviceMemory <= 2) {
  softWarnings.push(`This device reports ~${cap.deviceMemory} GB of RAM - large programs (Doom) may crash the tab. Small carts should still work.`);
}

// Bridge status lines that mean something went wrong (calcite-bridge.js
// postStatus vocabulary - keep in sync with web/shim/calcite-bridge.js).
const ERROR_STATUS = /^(boot failed|compile error|engine error|keyboard input broken)/;

class Health {
  capabilities = cap;
  hardFailures = hardFailures;
  softWarnings = softWarnings;
  canRun = hardFailures.length === 0;
  engineStatus = $state('engine starting…');
  engineError = $state('');

  #attached = null;

  constructor() {
    if (!inBrowser || !this.canRun) return;
    window.addEventListener('cssdos-bridge-state', (ev) => this.#onBridgeState(ev.detail));
    if (window.__calciteBridgeState) this.#onBridgeState(window.__calciteBridgeState);
    else if (window.__calciteBridge) this.#attach(window.__calciteBridge);
  }

  #onBridgeState({ phase, error }) {
    if (phase === 'spawned') {
      this.#attach(window.__calciteBridge);
    } else {
      this.engineError = `The engine failed to start: ${error}. Try reloading; if it persists, this browser can’t run the player.`;
    }
  }

  #attach(bridge) {
    if (!bridge || this.#attached === bridge) return;
    this.#attached = bridge;
    bridge.addEventListener('message', (ev) => {
      const d = ev.data;
      if (!d || d.type !== 'status') return;
      this.engineStatus = d.message;
      if (ERROR_STATUS.test(d.message)) this.engineError = d.message;
    });
    bridge.addEventListener('error', (ev) => {
      this.engineError = 'engine crashed: ' + (ev.message || 'unknown error');
    });
  }
}

export const health = new Health();
