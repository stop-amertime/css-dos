// web/site/assets/build.js
// Build UI logic: cart picker + file picker → form → build → save → play.
// Also drives the paginated source viewer.

import { buildCabinetInBrowser } from '/browser-builder/main.mjs';
import { saveCabinet, purgeCabinets } from '/browser-builder/storage.mjs';

// Cabinets are ephemeral — evict on tab unload so nothing persists across
// browser sessions. `pagehide` fires for both close and bfcache transitions;
// the purge itself is fire-and-forget (Cache Storage handles the abort).
window.addEventListener('pagehide', () => { purgeCabinets(); });

const $ = (id) => document.getElementById(id);

// ── Form helpers (radio groups + status line) ────────────────────────────────

function radioValue(name) {
  const el = document.querySelector(`input[name="${name}"]:checked`);
  return el ? el.value : '';
}
function setRadioValue(name, value) {
  const el = document.querySelector(`input[name="${name}"][value="${value}"]`);
  if (el) el.checked = true;
}
function setStatus(msg) {
  const el = $('status-msg');
  if (el) el.textContent = msg;
}

// ── Source state: where the bytes for the next build come from ───────────────
//   'file'   — single .com/.exe via #com-file
//   'folder' — webkitdirectory upload via #dir-file
//   'cart'   — a built-in cart from /carts/<name>/, fetched server-side
//   null     — nothing picked yet
let activeSource = null;
// When activeSource === 'cart', this holds { name, files: [{name,bytes}],
// program: <parsed program.json or null> }.
let activeCart = null;

// For folder uploads, derive the on-floppy name from webkitRelativePath.
// We strip the user-picked folder (first segment) and keep ONE level of
// subdirectory — mkfat12 supports DATA\FILE.DAT but not deeper nesting.
// Deeper paths are flattened into the first subdir to avoid silent data loss.
function relativeCartName(file) {
  const rel = file.webkitRelativePath || file.name;
  const parts = rel.split('/').filter(Boolean);
  const inside = parts.length > 1 ? parts.slice(1) : parts;
  if (inside.length === 1) return inside[0];
  return inside[0] + '\\' + inside[inside.length - 1];
}

// Show/hide the rows that only matter for DOS presets (Run command, Video
// memory). Hack carts run a bare .COM at 0x100 with no shell.
function refreshDosOnlyRows() {
  const isDos = radioValue('preset') !== 'hack';
  $('run-cmd-row').hidden = !isDos;
  const videoRow = $('video-row');
  if (videoRow) videoRow.hidden = !isDos;
}

// Suggest a default Run command for the current source if the field is
// blank. We don't overwrite what the user typed.
function suggestDefaultRunCommand() {
  const field = $('run-cmd');
  if (!field || field.value.trim() !== '') return;
  let runnable = null;
  if (activeSource === 'file') {
    const f = $('com-file').files[0];
    if (f) runnable = f.name;
  } else if (activeSource === 'folder') {
    for (const f of $('dir-file').files || []) {
      const u = f.name.toUpperCase();
      if (u.endsWith('.COM') || u.endsWith('.EXE')) { runnable = f.name; break; }
    }
  } else if (activeSource === 'cart' && activeCart) {
    for (const f of activeCart.files) {
      const u = f.name.toUpperCase();
      if (u.endsWith('.COM') || u.endsWith('.EXE')) { runnable = f.name; break; }
    }
  }
  if (runnable) {
    field.value = runnable.replace(/\.(com|exe)$/i, '').toUpperCase();
  }
}

// ── Cart picker — fetch /_carts.json, render radios, prefill form ────────────

async function loadCartList() {
  let carts = [];
  try {
    const res = await fetch('/_carts.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    carts = await res.json();
  } catch (e) {
    console.warn('[build] failed to fetch /_carts.json:', e);
    return;
  }
  const list = $('cart-list');
  // Sort: carts with a program.json first (alpha), then those without.
  carts.sort((a, b) => {
    const ap = a.program ? 0 : 1, bp = b.program ? 0 : 1;
    if (ap !== bp) return ap - bp;
    return a.name.localeCompare(b.name);
  });
  for (const c of carts) {
    const lab = document.createElement('label');
    lab.className = 'radio';
    const displayName = c.program?.name || c.name;
    lab.innerHTML =
      `<input type="radio" name="cart" value="${c.name}">` +
      `<span class="marker"></span>` +
      `<span class="label-text">${escapeHtml(displayName)}</span>` +
      (c.program?.name && c.program.name !== c.name
        ? `<span class="label-desc">${escapeHtml(c.name)}</span>`
        : '');
    list.appendChild(lab);
  }
  // Wire change handler: any radio in the cart-list group.
  list.addEventListener('change', async (ev) => {
    if (ev.target?.name !== 'cart') return;
    const name = ev.target.value;
    if (!name) {
      // (custom) selected — clear cart state, leave file/folder pickers untouched.
      activeCart = null;
      if (activeSource === 'cart') {
        activeSource = null;
        $('file-name').textContent = 'No file selected';
        $('start').disabled = true;
      }
      refreshDosOnlyRows();
      setStatus('Custom: pick a file or folder.');
      return;
    }
    await selectCart(name, carts);
  });
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function selectCart(name, carts) {
  const meta = carts.find(c => c.name === name);
  if (!meta) return;
  setStatus(`Loading cart "${name}"...`);
  // Fetch every file the cart lists.
  const fetched = await Promise.all(
    meta.files.map(async (rel) => {
      const url = `/carts/${encodeURIComponent(name)}/${rel.split('/').map(encodeURIComponent).join('/')}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`fetch ${url} failed: ${res.status}`);
      const buf = new Uint8Array(await res.arrayBuffer());
      // Browser builder accepts at most one subdir level — same as
      // relativeCartName above. Use backslash join to match the FAT path.
      const onDisk = rel.includes('/') ? rel.replace('/', '\\') : rel;
      return { name: onDisk, bytes: buf };
    }),
  );
  activeSource = 'cart';
  activeCart = { name, files: fetched, program: meta.program };
  // Clear the manual pickers so we don't accidentally read them on Build.
  $('com-file').value = '';
  $('dir-file').value = '';
  $('file-name').textContent = `${name} (${fetched.length} file${fetched.length === 1 ? '' : 's'})`;
  $('start').disabled = false;
  // Apply program.json defaults to the form.
  applyProgramJsonToForm(meta.program);
  setStatus(`Loaded "${meta.program?.name ?? name}". Tweak options or Build.`);
}

// Map a parsed program.json's fields onto the form controls. Anything
// the cart doesn't specify is left at the form's current value, so the
// user's manual edits (e.g. switching preset) survive a re-application.
function applyProgramJsonToForm(program) {
  if (!program) return;
  if (typeof program.preset === 'string') {
    setRadioValue('preset', program.preset);
  }
  const mem = program.memory ?? {};
  if (mem.conventional !== undefined) {
    // "autofit" or unspecified → "" (auto-fit radio).
    const v = mem.conventional === 'autofit' ? '' : (mem.conventional ?? '');
    setRadioValue('memory', v);
  }
  if (typeof mem.textVga === 'boolean') $('mem-textVga').checked = mem.textVga;
  if (typeof mem.gfx     === 'boolean') $('mem-gfx').checked     = mem.gfx;
  if (typeof mem.cgaGfx  === 'boolean') $('mem-cgaGfx').checked  = mem.cgaGfx;
  refreshDosOnlyRows();
  // boot.runCommand drops verbatim into the Run field. Empty string means
  // "drop to bare prompt"; we render that as a blank field so the user can
  // see they're getting a prompt.
  if (typeof program.boot?.runCommand === 'string') {
    $('run-cmd').value = program.boot.runCommand;
  } else {
    $('run-cmd').value = '';
    suggestDefaultRunCommand();
  }
}

// ── File / folder pickers ────────────────────────────────────────────────────

$('com-file').addEventListener('change', () => {
  const file = $('com-file').files[0];
  if (!file) return;
  $('dir-file').value = '';
  activeSource = 'file';
  activeCart = null;
  setRadioValue('cart', '');
  $('file-name').textContent = file.name;
  $('start').disabled = false;
  refreshDosOnlyRows();
  // Custom file uploads don't carry a program.json, so seed the Run
  // field from the file name. The user can override before clicking Build.
  $('run-cmd').value = '';
  suggestDefaultRunCommand();
  setStatus(`File loaded: ${file.name}`);
});

$('dir-file').addEventListener('change', () => {
  const files = $('dir-file').files;
  if (!files || files.length === 0) return;
  $('com-file').value = '';
  activeSource = 'folder';
  activeCart = null;
  setRadioValue('cart', '');
  $('file-name').textContent = `${files.length} file${files.length === 1 ? '' : 's'} from folder`;
  $('start').disabled = false;
  refreshDosOnlyRows();
  // If the user dropped a folder containing a program.json, absorb it —
  // matches the cart-picker flow.
  const pj = [...files].find(f => f.name === 'program.json');
  if (pj) {
    pj.text().then(t => {
      try { applyProgramJsonToForm(JSON.parse(t)); }
      catch (e) { console.warn('[build] folder program.json parse failed:', e); }
    });
  } else {
    $('run-cmd').value = '';
    suggestDefaultRunCommand();
  }
  setStatus(`Folder loaded: ${files.length} files.`);
});

// Re-render dependent UI when preset radio changes.
document.querySelectorAll('input[name="preset"]').forEach(r => {
  r.addEventListener('change', refreshDosOnlyRows);
});

refreshDosOnlyRows();
loadCartList();

// Split-mode reload button.
const splitReload = document.getElementById('split-reload');
if (splitReload) {
  splitReload.addEventListener('click', () => {
    const frame = document.getElementById('split-frame');
    frame.src = '/player/calcite.html?t=' + Date.now();
  });
}

// ── Build button ─────────────────────────────────────────────────────────────

$('start').addEventListener('click', async () => {
  // Collect files from whichever source was last picked.
  let cartFiles = []; // [{ name, bytes }]
  let cartProgram = null;
  if (activeSource === 'file') {
    const f = $('com-file').files[0];
    if (!f) { alert('Pick a file or folder first.'); return; }
    cartFiles = [{ name: f.name, bytes: new Uint8Array(await f.arrayBuffer()) }];
  } else if (activeSource === 'folder') {
    const list = $('dir-file').files;
    if (!list || list.length === 0) { alert('Pick a file or folder first.'); return; }
    cartFiles = await Promise.all(
      [...list]
        .filter(f => f.name !== 'program.json')
        .map(async f => ({
          name: relativeCartName(f),
          bytes: new Uint8Array(await f.arrayBuffer()),
        })),
    );
    const pj = [...list].find(f => f.name === 'program.json');
    if (pj) {
      try { cartProgram = JSON.parse(await pj.text()); }
      catch (e) { console.warn('[build] folder program.json parse failed:', e); }
    }
  } else if (activeSource === 'cart' && activeCart) {
    cartFiles = activeCart.files.map(f => ({ name: f.name, bytes: f.bytes }));
    cartProgram = activeCart.program;
  } else {
    alert('Pick a cart, file, or folder first.');
    return;
  }

  // Disable build button while running.
  $('start').disabled = true;
  setStatus('Building...');

  // Evict any cabinet left over from a previous build before we start — if
  // this build fails partway the player tab must not pick up stale bytes.
  await purgeCabinets();

  // Show progress section, clear old state.
  $('progress').hidden = false;
  $('result').hidden = true;
  $('source-viewer').hidden = true;
  const stages = $('stages');
  stages.innerHTML = '';
  $('log').textContent = '';

  const preset = radioValue('preset');
  // The Run field is the literal command line CONFIG.SYS hands to
  // COMMAND.COM via /K. Empty = bare prompt. The cart never runs as the
  // shell directly — that path was deleted on 2026-04-27.
  const runCommand = ($('run-cmd')?.value || '').trim();
  const memorySel = radioValue('memory');
  const isDos = preset !== 'hack';
  const memoryOverride = {};
  if (memorySel) memoryOverride.conventional = memorySel;
  if (isDos) {
    memoryOverride.textVga = $('mem-textVga').checked;
    memoryOverride.gfx     = $('mem-gfx').checked;
    memoryOverride.cgaGfx  = $('mem-cgaGfx').checked;
  }
  // Build extraManifest by deep-merging cart program.json under the form's
  // explicit overrides — so the form always wins over what the cart says.
  // The browser builder will deep-merge this on top of the preset.
  const extraManifest = mergeManifest(cartProgram ?? {}, {
    ...(Object.keys(memoryOverride).length ? { memory: memoryOverride } : {}),
  });
  // buildCabinetInBrowser uses its own params for `preset` and `runCommand`,
  // so strip those from extraManifest to avoid double-binding.
  delete extraManifest.preset;
  if (extraManifest.boot) {
    delete extraManifest.boot.runCommand;
  }

  let blob;
  let diskBytes = null;
  try {
    const built = await buildCabinetInBrowser({
      preset,
      files: cartFiles,
      runCommand: isDos ? runCommand : undefined,
      manifest: extraManifest,
      onProgress: ({ stage, message }) => {
        const li = document.createElement('li');
        li.textContent = message;
        const prev = stages.querySelector('li.in-progress');
        if (prev) {
          prev.classList.remove('in-progress');
          prev.classList.add('done');
        }
        if (stage !== 'done') li.classList.add('in-progress');
        else li.classList.add('done');
        stages.appendChild(li);
        $('log').textContent += message + '\n';
      },
    });
    blob = built.blob;
    diskBytes = built.diskBytes;
  } catch (err) {
    const li = document.createElement('li');
    li.textContent = 'Error: ' + err.message;
    li.classList.add('stage-error');
    stages.appendChild(li);
    $('log').textContent += 'Error: ' + err.message + '\n';
    $('start').disabled = false;
    setStatus('Build failed.');
    return;
  }

  // Show result section.
  $('result').hidden = false;
  $('size').textContent = `Cabinet: ${(blob.size / 1024 / 1024).toFixed(1)} MB`;
  setStatus(`Cabinet ready (${(blob.size / 1024 / 1024).toFixed(1)} MB).`);

  // Download link: revoke old blob URL to avoid memory leak on rebuild.
  if (window._prevBlobUrl) URL.revokeObjectURL(window._prevBlobUrl);
  window._prevBlobUrl = URL.createObjectURL(blob);
  const dl = $('download');
  dl.href = window._prevBlobUrl;

  setupSourceViewer(blob);

  // Let the browser paint before kicking off the background parse/compile.
  await new Promise((resolve) => {
    let done = false;
    const once = () => { if (!done) { done = true; resolve(); } };
    requestAnimationFrame(() => requestAnimationFrame(once));
    setTimeout(once, 100);
  });

  // Hand the cabinet blob directly to the bridge worker.
  const eager = $('eager-compile').checked;
  try {
    if (window.__calciteBridge) {
      window.__calciteBridge.postMessage({
        type: eager ? 'cabinet-blob' : 'cabinet-blob-lazy',
        blob,
        diskBytes,
      });
    }
  } catch (e) {
    console.warn('[build] failed to post cabinet blob to bridge:', e);
  }

  saveCabinet(blob).catch((e) =>
    console.warn('[build] saveCabinet failed:', e)
  );

  if (document.body.classList.contains('split')) {
    const frame = document.getElementById('split-frame');
    frame.src = '/player/calcite.html?t=' + Date.now();
  }

  $('start').disabled = false;
});

// ── Manifest deep-merge (b wins) ─────────────────────────────────────────────
// Same shape as builder/lib/config.mjs's deepMerge, kept here so we don't
// have to plumb config.mjs through the asset pipeline.
function mergeManifest(a, b) {
  if (b === null) return null;
  if (Array.isArray(b) || typeof b !== 'object') return b;
  const out = { ...(a ?? {}) };
  for (const k of Object.keys(b)) {
    const av = out[k], bv = b[k];
    if (bv && typeof bv === 'object' && !Array.isArray(bv) && av && typeof av === 'object' && !Array.isArray(av)) {
      out[k] = mergeManifest(av, bv);
    } else {
      out[k] = bv;
    }
  }
  return out;
}

// ── Paginated source viewer ──────────────────────────────────────────────────
// Cabinets are 100+ MB. Prism on a single 50KB page can still lock the main
// thread for seconds because cabinet CSS has pathologically long lines
// (packed-cell dispatch tables). So we paginate by LINE COUNT, not bytes.
//
// Page offsets are discovered lazily: page 1 starts at byte 0; the start
// of page N is found by streaming forward from the last known offset,
// counting newlines, and caching the result.

const LINES_PER_PAGE = 200;

async function setupSourceViewer(blob) {
  const code = $('source-code');
  const pageNumEl = $('page-num');
  const pageTotalEl = $('page-total');
  const pageBytesEl = $('page-bytes');
  const jump = $('page-jump');
  const prevBtn = $('page-prev');
  const nextBtn = $('page-next');

  $('source-viewer').hidden = false;

  const pageStarts = [0];
  let exactPageCount = null;
  let currentPage = 1;

  function estimateTotalPages() {
    if (exactPageCount != null) return exactPageCount;
    const est = Math.max(1, Math.ceil(blob.size / (LINES_PER_PAGE * 40)));
    return Math.max(est, pageStarts.length);
  }

  async function ensurePage(targetPage) {
    if (targetPage < pageStarts.length) return;
    if (exactPageCount != null) return;

    const CHUNK = 256 * 1024;
    let offset = pageStarts[pageStarts.length - 1];
    let linesSinceLastMark = 0;

    while (pageStarts.length <= targetPage && offset < blob.size) {
      const end = Math.min(offset + CHUNK, blob.size);
      const slice = blob.slice(offset, end);
      const buf = new Uint8Array(await slice.arrayBuffer());
      for (let i = 0; i < buf.length; i++) {
        if (buf[i] === 0x0A) {
          linesSinceLastMark++;
          if (linesSinceLastMark === LINES_PER_PAGE) {
            pageStarts.push(offset + i + 1);
            linesSinceLastMark = 0;
            if (pageStarts.length > targetPage) break;
          }
        }
      }
      offset = end;
    }

    if (offset >= blob.size) {
      exactPageCount = pageStarts.length;
      pageStarts.push(blob.size);
    }
  }

  async function renderPage(n) {
    await ensurePage(n);
    if (exactPageCount != null && n > exactPageCount) n = exactPageCount;
    currentPage = n;

    const startByte = pageStarts[n - 1];
    const endByte = pageStarts[n] != null ? pageStarts[n] : blob.size;
    const slice = blob.slice(startByte, endByte);
    const text = await slice.text();

    code.textContent = text;
    if (window.Prism) window.Prism.highlightElement(code);
    $('source-pre').scrollTop = 0;
    window.scrollTo({ top: $('source-viewer').offsetTop });

    const total = estimateTotalPages();
    pageNumEl.textContent = String(n);
    pageTotalEl.textContent = exactPageCount != null ? String(total) : `~${total}`;
    jump.value = n;
    jump.max = total;
    pageBytesEl.textContent =
      `${(endByte - startByte).toLocaleString()} bytes · lines ` +
      `${((n - 1) * LINES_PER_PAGE + 1).toLocaleString()}–` +
      `${((n - 1) * LINES_PER_PAGE + text.split('\n').length).toLocaleString()}`;

    prevBtn.disabled = n <= 1;
    nextBtn.disabled = exactPageCount != null && n >= exactPageCount;
  }

  prevBtn.onclick = () => { if (currentPage > 1) renderPage(currentPage - 1); };
  nextBtn.onclick = () => {
    if (exactPageCount == null || currentPage < exactPageCount) {
      renderPage(currentPage + 1);
    }
  };
  jump.onchange = () => {
    const v = Math.max(1, parseInt(jump.value, 10) || 1);
    renderPage(v);
  };

  await renderPage(1);
}
