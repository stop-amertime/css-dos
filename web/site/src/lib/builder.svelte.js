// Build state + actions. Wraps the browser builder in reactive $state so
// the UI binds to it directly - no hidden DOM surface, no MutationObserver.
// The manifest construction mirrors the old build.js exactly so cabinet
// output stays byte-identical.
import { buildCabinetInBrowser } from '/browser-builder/main.mjs';
import { saveCabinet, getCabinet, purgeCabinets } from '/browser-builder/storage.mjs';
import { mergeManifest } from './manifest.js';

// The built cabinet persists in Cache Storage until the next build starts
// (purgeCabinets() in build()). Cache Storage is the cabinet's ONLY home:
// the bridge worker reads it from there when a viewer connects (which is
// also what lets a reloaded tab recover - F5, Vite HMR, a discarded mobile
// tab), and the restore probe below re-unlocks Play. The build just writes
// the cache and broadcasts 'cabinet-updated'.

const bridgeBus = typeof window !== 'undefined'
  ? new BroadcastChannel('cssdos-bridge')
  : null;

const PRESET_LABELS = {
  'dos-corduroy': 'DOS + Corduroy BIOS',
  'dos-muslin': 'DOS + Muslin BIOS',
  hack: 'hack (.com, no DOS)',
};

// Derive an on-floppy name from a folder file's relative path. Strip the
// user-picked root folder, keep one subdir level (mkfat12 supports
// DATA\FILE.DAT but not deeper), flatten anything deeper.
function relativeCartName(file) {
  const parts = (file.webkitRelativePath || file.name).split('/').filter(Boolean);
  const inside = parts.length > 1 ? parts.slice(1) : parts;
  return inside.length === 1 ? inside[0] : inside[0] + '\\' + inside[inside.length - 1];
}

const firstRunnable = (names) => names.find((n) => /\.(com|exe)$/i.test(n));
const stripExt = (name) => name.replace(/\.(com|exe)$/i, '').toUpperCase();

class Build {
  // source: 'file' | 'folder' | 'cart' | null
  source = $state(null);
  file = $state(null);        // File (single .com/.exe)
  folderFiles = $state(null); // FileList
  cart = $state(null);        // { name, files:[{name,bytes}], program }
  serverCarts = $state([]);   // [{ name, files, program }] from /carts/index.json
  selectedId = $state(null);  // card id highlighted in the grid ('custom' for the upload card)

  options = $state({
    preset: 'dos-corduroy',
    memory: '',               // '' = auto-fit
    textVga: true,
    gfx: true,
    cgaGfx: false,
    writable: false,          // disk.writable - session-writable floppy
    runCommand: '',
    bootMode: 'program',      // 'program' | 'shell'
    eagerCompile: false,
  });

  status = $state('Ready.');
  busy = $state(false);
  done = $state(false);
  failed = $state(false);   // last build threw - keeps the progress panel up
  buildError = $state('');  // the message shown next to the failed bar
  restored = $state(false); // a cabinet from a previous page lifetime is playable
  progressLog = $state('');
  progressStages = $state(0);
  cabinetBlob = $state(null);
  diskBytes = $state(null);
  #blobUrl = null;

  get isDos() { return this.options.preset !== 'hack'; }
  get hasSource() { return this.source !== null; }
  get canBuild() { return this.hasSource && !this.busy; }

  // Landing grid: a cart opts in by declaring display.cover (boxart) OR
  // display.bullets (cover-less text card) in its program.json.
  // name/description come from the same program.json - no second frontend
  // manifest. The synthetic "custom" upload card is appended and renders
  // as an ordinary grid cell (CartCard's cart.custom branch).
  get featuredCarts() {
    const carts = this.serverCarts
      .filter((c) => c.program?.display?.cover || c.program?.display?.bullets)
      .map((c) => ({
        id: c.name,
        name: c.program.name || c.name,
        desc: c.program.description || '',
        cover: c.program.display.cover ? `/assets/boxart/${c.program.display.cover}` : null,
        bullets: c.program.display.bullets || null,
        accent: c.program.display.accent || null,
        recommended: c.program.display.recommended === true,
      }));
    carts.push({ id: 'custom', name: 'Custom Program', custom: true });
    return carts;
  }

  get selectedDetail() {
    return this.featuredCarts.find((c) => c.id === this.selectedId) || null;
  }

  get sizeLabel() {
    if (!this.cabinetBlob) return '-';
    return `Cabinet: ${(this.cabinetBlob.size / 1024 / 1024).toFixed(1)} MB`;
  }
  // Bare "320 MB" for the compact download line.
  get sizeMB() {
    if (!this.cabinetBlob) return '';
    return `${Math.round(this.cabinetBlob.size / 1024 / 1024)} MB`;
  }
  get floppyName() {
    const id = this.source === 'cart' ? this.cart?.name : 'CABINET';
    return (id || 'CABINET').slice(0, 8).toUpperCase();
  }

  // Spec-table values, derived from current options.
  get specMemory() { return this.options.memory ? `${this.options.memory} conventional` : 'auto-fit'; }
  get specPreset() { return PRESET_LABELS[this.options.preset] || this.options.preset; }
  get specVideo() {
    const v = [];
    if (this.options.textVga) v.push('Text');
    if (this.options.gfx) v.push('Mode 13h');
    if (this.options.cgaGfx) v.push('CGA Mode 4/6');
    return v.join(' + ') || '(none)';
  }
  get specRun() {
    if (!this.isDos) return 'n/a (hack: bare .com)';
    return this.options.runCommand.trim() || 'auto (from program.json)';
  }
  get specDisk() {
    if (!this.isDos) return 'none (hack: bare .com)';
    return this.options.writable ? 'floppy, writable (this session)' : 'floppy, read-only';
  }

  async loadServerCarts() {
    try {
      const res = await fetch('/carts/index.json', { cache: 'no-store' });
      if (res.ok) this.serverCarts = await res.json();
    } catch (e) {
      console.warn('[build] /carts/index.json fetch failed:', e);
    }
  }

  // Suggest a Run command from the picked program's name, only if blank.
  #suggestRunCommand() {
    if (this.options.runCommand.trim() !== '') return;
    let runnable = null;
    if (this.source === 'file' && this.file) runnable = this.file.name;
    else if (this.source === 'folder') runnable = firstRunnable([...(this.folderFiles || [])].map((f) => f.name));
    else if (this.source === 'cart' && this.cart) runnable = firstRunnable(this.cart.files.map((f) => f.name));
    if (runnable) this.options.runCommand = stripExt(runnable);
  }

  // Apply a parsed program.json to the options. Anything unspecified is
  // left as-is so the user's manual edits survive re-application.
  applyProgramJson(program) {
    if (!program) return;
    if (typeof program.preset === 'string') this.options.preset = program.preset;
    const mem = program.memory ?? {};
    if (mem.conventional !== undefined) {
      this.options.memory = mem.conventional === 'autofit' ? '' : (mem.conventional ?? '');
    }
    if (typeof mem.textVga === 'boolean') this.options.textVga = mem.textVga;
    if (typeof mem.gfx === 'boolean') this.options.gfx = mem.gfx;
    if (typeof mem.cgaGfx === 'boolean') this.options.cgaGfx = mem.cgaGfx;
    // Unlike the fields above this one RESETS when unspecified: a stale
    // `true` leaking from a previously-picked cart quietly balloons the
    // next cabinet by hundreds of MB.
    this.options.writable = program.disk?.writable === true;
    if (typeof program.boot?.runCommand === 'string') {
      this.options.runCommand = program.boot.runCommand;
      this.options.bootMode = program.boot.runCommand ? 'program' : 'shell';
    } else {
      this.options.runCommand = '';
      this.#suggestRunCommand();
    }
  }

  async selectCart(id) {
    const meta = this.serverCarts.find((c) => c.name === id);
    if (!meta) return;
    this.status = `Loading cart "${id}"…`;
    const files = await Promise.all(meta.files.map(async (rel) => {
      const url = `/carts/${encodeURIComponent(id)}/${rel.split('/').map(encodeURIComponent).join('/')}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`fetch ${url} failed: ${res.status}`);
      const bytes = new Uint8Array(await res.arrayBuffer());
      // Browser builder accepts one subdir level; join with backslash to
      // match the FAT path.
      return { name: rel.includes('/') ? rel.replace('/', '\\') : rel, bytes };
    }));
    this.source = 'cart';
    this.file = null;
    this.folderFiles = null;
    this.cart = { name: id, files, program: meta.program };
    this.selectedId = id;
    this.#invalidateBuild();
    this.applyProgramJson(meta.program);
    this.status = `Loaded "${meta.program?.name ?? id}". Tweak options or Build.`;
  }

  pickFile(file) {
    if (!file) return;
    this.source = 'file';
    this.file = file;
    this.folderFiles = null;
    this.cart = null;
    this.#invalidateBuild();
    this.options.runCommand = '';
    this.options.writable = false;
    this.#suggestRunCommand();
    this.status = `File loaded: ${file.name}`;
  }

  pickFolder(fileList) {
    if (!fileList?.length) return;
    this.source = 'folder';
    this.file = null;
    this.folderFiles = fileList;
    this.cart = null;
    this.#invalidateBuild();
    const pj = [...fileList].find((f) => f.name === 'program.json');
    if (pj) {
      pj.text().then((t) => {
        try { this.applyProgramJson(JSON.parse(t)); }
        catch (e) { console.warn('[build] folder program.json parse failed:', e); }
      });
    } else {
      this.options.runCommand = '';
      this.options.writable = false;
      this.#suggestRunCommand();
    }
    this.status = `Folder loaded: ${fileList.length} files.`;
  }

  // Boot-mode radio: 'program' restores the cart's default run command,
  // 'shell' blanks it (drop to the DOS prompt). Mirrors the old wizard.js
  // behaviour of toggling #run-cmd between the stored default and empty.
  setBootMode(mode) {
    this.options.bootMode = mode;
    if (mode === 'shell') {
      this.options.runCommand = '';
    } else {
      const stored = this.cart?.program?.boot?.runCommand;
      if (stored) this.options.runCommand = stored;
      else this.#suggestRunCommand();
    }
  }

  selectCustom() {
    // Custom card selected but no file yet - clear cart state, keep pickers.
    this.cart = null;
    this.selectedId = 'custom';
    if (this.source === 'cart') { this.source = null; this.#invalidateBuild(); }
    this.status = 'Custom: pick a file or folder.';
  }

  #invalidateBuild() {
    if (this.done) {
      this.done = false;
      this.cabinetBlob = null;
    }
    this.failed = false;
    this.buildError = '';
  }

  async runBuild() {
    let cartFiles = [];
    let cartProgram = null;
    if (this.source === 'file') {
      cartFiles = [{ name: this.file.name, bytes: new Uint8Array(await this.file.arrayBuffer()) }];
    } else if (this.source === 'folder') {
      const list = [...this.folderFiles];
      cartFiles = await Promise.all(
        list.filter((f) => f.name !== 'program.json').map(async (f) => ({
          name: relativeCartName(f), bytes: new Uint8Array(await f.arrayBuffer()),
        })),
      );
      const pj = list.find((f) => f.name === 'program.json');
      if (pj) { try { cartProgram = JSON.parse(await pj.text()); } catch {} }
    } else if (this.source === 'cart' && this.cart) {
      cartFiles = this.cart.files.map((f) => ({ name: f.name, bytes: f.bytes }));
      cartProgram = this.cart.program;
    } else {
      return;
    }

    this.busy = true;
    this.done = false;
    this.failed = false;
    this.buildError = '';
    this.restored = false; // the purge below evicts any previous cabinet
    this.status = 'Building…';
    this.progressLog = '';
    this.progressStages = 0;
    await purgeCabinets();

    const { preset } = this.options;
    const runCommand = this.options.runCommand.trim();
    const memoryOverride = {};
    if (this.options.memory) memoryOverride.conventional = this.options.memory;
    if (this.isDos) {
      memoryOverride.textVga = this.options.textVga;
      memoryOverride.gfx = this.options.gfx;
      memoryOverride.cgaGfx = this.options.cgaGfx;
    }
    // Form overrides win over the cart's program.json. disk.writable is
    // always stated for DOS carts (the checkbox can turn a cart's default
    // off as well as on); hack carts must not get a disk object at all.
    const extraManifest = mergeManifest(cartProgram ?? {}, {
      ...(Object.keys(memoryOverride).length ? { memory: memoryOverride } : {}),
      ...(this.isDos ? { disk: { writable: this.options.writable } } : {}),
    });
    // preset + runCommand are passed as their own params; strip to avoid
    // double-binding.
    delete extraManifest.preset;
    if (extraManifest.boot) delete extraManifest.boot.runCommand;

    let blob, diskBytes = null;
    try {
      const built = await buildCabinetInBrowser({
        preset,
        files: cartFiles,
        runCommand: this.isDos ? runCommand : undefined,
        manifest: extraManifest,
        onProgress: ({ message }) => {
          this.progressLog += message + '\n';
          this.progressStages += 1;
        },
      });
      blob = built.blob;
      diskBytes = built.diskBytes;
    } catch (err) {
      this.progressLog += 'Error: ' + err.message + '\n';
      this.failed = true;
      this.buildError = err.message;
      this.status = 'Build failed.';
      this.busy = false;
      return;
    }

    if (this.#blobUrl) URL.revokeObjectURL(this.#blobUrl);
    this.#blobUrl = URL.createObjectURL(blob);
    this.cabinetBlob = blob;
    this.diskBytes = diskBytes;
    this.done = true;
    this.status = `Cabinet ready (${(blob.size / 1024 / 1024).toFixed(1)} MB).`;

    // Let the browser paint before the background parse/compile kicks off.
    await new Promise((resolve) => {
      let done = false;
      const once = () => { if (!done) { done = true; resolve(); } };
      requestAnimationFrame(() => requestAnimationFrame(once));
      setTimeout(once, 100);
    });

    try {
      await saveCabinet(blob);
      bridgeBus?.postMessage({ type: 'cabinet-updated', eager: this.options.eagerCompile });
    } catch (e) {
      console.warn('[build] saveCabinet failed:', e);
      this.status = 'Cabinet built, but caching it failed - the player cannot run it.';
    }
    this.busy = false;
  }

  download() {
    if (!this.#blobUrl) return;
    const id = this.source === 'cart' ? this.cart?.name : '';
    const a = document.createElement('a');
    a.href = this.#blobUrl;
    a.download = id ? `${id}-cabinet.css` : 'cabinet.css';
    a.click();
    this.status = `Saved ${a.download}.`;
  }
}

export const build = new Build();

// Restore probe: a cabinet left by a previous page lifetime unlocks Play
// without a rebuild (the bridge reads the cache itself when a viewer
// connects; this only flips the UI state). Metadata comes from the cached
// response's headers - the blob is never materialised here.
if (typeof window !== 'undefined') {
  getCabinet().then((hit) => {
    if (!hit || build.busy || build.done) return;
    build.restored = true;
    const mb = Number(hit.headers.get('Content-Length') || 0) / 1024 / 1024;
    build.status = mb >= 0.1
      ? `Restored your last cabinet (${mb.toFixed(1)} MB).`
      : 'Restored your last cabinet.';
    window.dispatchEvent(new CustomEvent('cssdos-cabinet-restored'));
  }).catch(() => {});
}
