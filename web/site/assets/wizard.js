// wizard.js — visual chrome on top of build.js.
//
// This file owns:
//   * Step navigation (the 4-step strip + Back/Next buttons + arrow keys).
//   * The visible cart-card grid: rendered from window.CARTS, mirrors
//     selection into the hidden #cart-list radio group that build.js owns.
//   * The spec-table mirror of the advanced controls (memory / preset /
//     video / run command).
//   * Progress-bar + stage mirror: observes #stages mutations build.js
//     emits, walks the bar fill and reveals #block-source on success.
//   * The "Save cabinet.css" button → proxies to the hidden #download <a>.
//
// All real work — fetching /_carts.json, building cabinets, paginating the
// source viewer, talking to the calcite bridge — still lives in build.js.

(function () {
  'use strict';

  const TOTAL_STEPS = 3;
  const LEARN_STEP = 1;   // step 1 holds the 3 Learn sub-pages
  const BUILD_STEP = 2;
  const PLAY_STEP  = 3;
  const LEARN_SUBPAGES = 4;
  let step = 1;
  let sub = 1;            // active Learn sub-page (1..LEARN_SUBPAGES)
  let buildDone = false;
  let buildInFlight = false;

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));

  const wizWindow  = $('.window.wizard');
  const wizCounter = $('#wiz-counter');
  const prevBtn    = $('#prev');
  const nextBtn    = $('#next');
  const statusMsg  = $('#status-msg');
  const startBtn   = $('#start');

  const STEP_TITLES = ['About', 'Build cabinet', 'Play'];

  // ── Step navigation ─────────────────────────────────────────────────

  function setStep(n) {
    step = Math.max(1, Math.min(TOTAL_STEPS, n));
    $$('.step').forEach((el) => {
      // Parked sections (no data-step) stay hidden always.
      const s = Number(el.dataset.step);
      el.hidden = !s || s !== step;
    });
    $$('.step-strip li').forEach((li) => {
      const j = Number(li.dataset.jump);
      li.classList.toggle('current', j === step);
      li.classList.toggle('done', j < step);
      li.classList.toggle('disabled', j === PLAY_STEP && !buildDone);
    });
    if (step === LEARN_STEP) renderSub();
    // Only the Play step gets the wide dialog; Learn/Build stay reading-width.
    wizWindow.classList.toggle('play-wide', step === PLAY_STEP);
    document.title = `CSS-DOS — ${STEP_TITLES[step - 1]}`;
    // Three step-dots: mark current + completed.
    wizCounter.querySelectorAll('li').forEach((li) => {
      const j = Number(li.dataset.jump);
      li.classList.toggle('current', j === step);
      li.classList.toggle('done', j < step);
    });
    // Back is disabled only at the very start (Learn sub-page 1).
    prevBtn.disabled = (step === LEARN_STEP && sub === 1);
    // Gate: Play requires a finished build.
    nextBtn.disabled = (step === BUILD_STEP && !buildDone);
    nextBtn.innerHTML = step === TOTAL_STEPS
      ? '<span class="hot">R</span>estart'
      : '<span class="hot">N</span>ext &raquo;';
    statusMsg.textContent = `Step ${step}/${TOTAL_STEPS}`;
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  // Show Learn sub-page `sub`; update dots + Back-button gating.
  function renderSub() {
    sub = Math.max(1, Math.min(LEARN_SUBPAGES, sub));
    $$('.subpage').forEach((el) => {
      el.hidden = Number(el.dataset.subpage) !== sub;
    });
    $$('#learn-subdots li').forEach((li) => {
      const j = Number(li.dataset.subjump);
      li.classList.toggle('current', j === sub);
      li.classList.toggle('done', j < sub);
    });
    prevBtn.disabled = (step === LEARN_STEP && sub === 1);
  }

  // Forward one logical page: within Learn, advance sub-page; at the last
  // sub-page, cross into Build.
  function goNext() {
    if (step === TOTAL_STEPS) {
      // Restart: rewind the wizard without tearing down build.js (that
      // would evict the just-built cabinet). Land back on Learn sub-page 1.
      sub = 1;
      setStep(LEARN_STEP);
      return;
    }
    if (step === LEARN_STEP && sub < LEARN_SUBPAGES) {
      sub += 1;
      renderSub();
      window.scrollTo({ top: 0, behavior: 'instant' });
      return;
    }
    setStep(step + 1);
  }

  // Backward one logical page: within Build/Play, step back; entering Learn
  // from Build lands on the last sub-page; within Learn, retreat sub-page.
  function goPrev() {
    if (step === LEARN_STEP) {
      if (sub > 1) { sub -= 1; renderSub(); window.scrollTo({ top: 0, behavior: 'instant' }); }
      return;
    }
    if (step === BUILD_STEP) {
      sub = LEARN_SUBPAGES;          // Build → Learn lands on last sub-page
      setStep(LEARN_STEP);
      return;
    }
    setStep(step - 1);
  }

  prevBtn.addEventListener('click', goPrev);
  nextBtn.addEventListener('click', goNext);

  // Sub-dot clicks — jump between Learn sub-pages.
  $$('#learn-subdots li').forEach((li) => {
    li.addEventListener('click', () => {
      sub = Number(li.dataset.subjump);
      renderSub();
      window.scrollTo({ top: 0, behavior: 'instant' });
    });
  });

  // Shared jump logic for the top step-strip and the bottom step-dots.
  function jumpToStep(j) {
    if (j === step) return;
    // Allow jumping back freely; forward to Build always, Play only if built.
    if (j < step) { setStep(j); return; }
    if (j === BUILD_STEP) { setStep(j); return; }
    if (j === PLAY_STEP && buildDone) { setStep(j); return; }
  }

  $$('.step-strip li').forEach((li) => {
    li.addEventListener('click', () => {
      if (li.classList.contains('disabled')) return;
      jumpToStep(Number(li.dataset.jump));
    });
  });
  $$('#wiz-counter li').forEach((li) => {
    li.addEventListener('click', () => jumpToStep(Number(li.dataset.jump)));
  });

  document.addEventListener('keydown', (e) => {
    // e.target on a document-level keydown can be the document itself (no
    // .matches), or a form control. Skip when the focus is in a typeable
    // surface so the user can still type into #run-cmd / #page-jump etc.
    if (e.target?.matches?.('input, textarea, select, [contenteditable]')) return;
    if (e.key === 'ArrowRight' && !nextBtn.disabled) { e.preventDefault(); nextBtn.click(); }
    if (e.key === 'ArrowLeft'  && !prevBtn.disabled) { e.preventDefault(); prevBtn.click(); }
    if (e.key === 'Escape'     && !prevBtn.disabled) { e.preventDefault(); prevBtn.click(); }
  });

  // ── Cart-card grid ──────────────────────────────────────────────────
  //
  // build.js populates #cart-list with one <label class="radio"> per cart
  // it sees in /_carts.json. We watch for that to happen, then render a
  // visible card grid from window.CARTS for cosmetics. Cards that exist on
  // the server but not in window.CARTS get a generic placeholder. Cards
  // that exist in window.CARTS but not on the server are skipped.
  //
  // Clicks on a card programmatically check the matching #cart-list radio
  // and fire a `change` event so build.js does the rest.

  const cartGrid = $('#cart-grid');
  const cartSelected = $('#cart-selected');

  function renderCartGrid(serverCarts) {
    // serverCarts: [{ name, files, program }] from build.js's fetch.
    const manifest = (window.CARTS || []);
    cartGrid.innerHTML = '';

    // Order: manifest order, only the ones the server actually has.
    // Carts under carts/ but absent from window.CARTS (e.g. doom8088-cga4,
    // test-carts, vsync-poll, rogue36) are intentionally NOT shown on the
    // release landing page — they're dev/regression variants. They remain
    // available via /build.html, which lists every directory under carts/.
    const serverIds = new Set(serverCarts.map((c) => c.name));
    const ordered = [];
    for (const c of manifest) {
      // The synthetic "custom" card isn't a server cart — always include it.
      if (c.custom) { ordered.push({ meta: c, server: null }); continue; }
      if (serverIds.has(c.id)) ordered.push({ meta: c, server: serverCarts.find((s) => s.name === c.id) });
    }

    for (const { meta, server } of ordered) {
      const card = document.createElement('div');
      card.className = 'cart-card' + (meta.custom ? ' cart-card-custom' : '');
      card.dataset.cartId = meta.id;

      const cover = document.createElement('div');
      cover.className = 'cart-cover';
      if (meta.custom) {
        cover.appendChild(makeCustomCover(meta));
      } else if (meta.cover) {
        const img = document.createElement('img');
        img.src = meta.cover;
        img.alt = meta.name;
        img.onerror = () => {
          cover.innerHTML = '';
          cover.appendChild(makePlaceholder(meta));
        };
        cover.appendChild(img);
      } else {
        cover.appendChild(makePlaceholder(meta));
      }
      card.appendChild(cover);

      const body = document.createElement('div');
      body.className = 'cart-body';
      body.innerHTML = `
        <div class="cart-name">${escapeHtml(meta.name)}</div>
        <div class="cart-desc">${escapeHtml(meta.desc || '')}</div>
      `;
      card.appendChild(body);

      card.addEventListener('click', () => selectCartCard(meta.id));
      cartGrid.appendChild(card);
    }
  }

  function makePlaceholder(meta) {
    const wrap = document.createElement('div');
    wrap.className = 'cart-cover-placeholder';
    const [fg, bg] = meta.placeholderPalette || ['#ffffff', '#0000aa'];
    wrap.style.background = bg;
    wrap.style.color = fg;
    wrap.innerHTML = `<div class="ph-name">${escapeHtml(meta.name)}</div>`;
    return wrap;
  }

  // The Custom card's cover: a big question mark on the palette colour.
  function makeCustomCover(meta) {
    const wrap = document.createElement('div');
    wrap.className = 'cart-cover-placeholder cart-cover-custom';
    const [fg, bg] = meta.placeholderPalette || ['#ffffff', '#aa0000'];
    wrap.style.background = bg;
    wrap.style.color = fg;
    wrap.innerHTML = `<div class="ph-glyph">?</div>`;
    return wrap;
  }

  function selectCartCard(id) {
    if (buildInFlight) return;
    const meta = (window.CARTS || []).find((c) => c.id === id);
    const isCustom = !!meta?.custom;

    // Update visible state.
    $$('.cart-card').forEach((c) => c.classList.toggle('selected', c.dataset.cartId === id));
    cartSelected.textContent = meta?.name || id;

    // Show the custom upload panel only when the Custom card is selected.
    $('#custom-panel').hidden = !isCustom;

    // Fire change on the hidden radio build.js owns. Built-in carts have a
    // radio keyed by id; the Custom card maps to the empty-value "(custom)"
    // radio build.js already provides for file/folder uploads.
    const value = isCustom ? '' : id;
    const radio = document.querySelector(`#cart-list input[name="cart"][value="${cssEscape(value)}"]`);
    if (radio) {
      radio.checked = true;
      radio.dispatchEvent(new Event('change', { bubbles: true }));
    }

    // A new selection invalidates the previous build.
    if (buildDone) {
      buildDone = false;
      $('#block-source').hidden = true;
      $('#build-progress-wrap').hidden = true;
      resetProgressUI();
      $('#build-hint').textContent = 'Selection changed — rebuild.';
      nextBtn.disabled = true;
    } else {
      $('#build-hint').textContent = 'Ready to build.';
    }
  }

  function presetLabel(p) {
    return {
      'dos-corduroy': 'DOS + Corduroy BIOS',
      'dos-muslin':   'DOS + Muslin BIOS',
      'hack':         'hack (.com, no DOS)',
    }[p] || p;
  }

  // CSS.escape polyfill for older Chromes — needed when cart ids contain
  // hyphens (e.g. "prince-of-persia"), which the attribute selector
  // tolerates, but in case of stranger characters.
  function cssEscape(s) {
    if (window.CSS && CSS.escape) return CSS.escape(s);
    return String(s).replace(/[^a-zA-Z0-9_-]/g, (c) => `\\${c}`);
  }

  // Watch #cart-list for the moment build.js finishes populating it.
  // The very first batch of children (more than just the (custom) entry
  // build.html ships with) is our cue to render the visible grid.
  const cartList = $('#cart-list');
  let gridRendered = false;
  async function tryRenderGrid() {
    if (gridRendered) return;
    // Pull the same /_carts.json build.js does so we have server metadata
    // (program.json contents per cart) for the spec-table preview, then
    // intersect with #cart-list children so we don't render a card before
    // build.js has wired its change handler.
    let serverCarts = [];
    try {
      const res = await fetch('/_carts.json', { cache: 'no-store' });
      if (res.ok) serverCarts = await res.json();
    } catch (e) {
      console.warn('[wizard] /_carts.json fetch failed:', e);
    }
    if (!serverCarts.length) return;
    const inputs = cartList.querySelectorAll('input[name="cart"][value]:not([value=""])');
    if (!inputs.length) return; // build.js hasn't populated yet
    gridRendered = true;
    renderCartGrid(serverCarts);
  }
  // Try once immediately (build.js may have already run), then via observer.
  setTimeout(tryRenderGrid, 0);
  new MutationObserver(tryRenderGrid).observe(cartList, { childList: true });

  // Reflect build.js's selection (in case the user uses keyboard nav on
  // the hidden radios, or build.js auto-selects on load) back into the
  // visible cards.
  cartList.addEventListener('change', (ev) => {
    if (ev.target?.name !== 'cart') return;
    const id = ev.target.value;
    // Empty value = the Custom card (file/folder upload).
    const cardId = id || 'custom';
    $$('.cart-card').forEach((c) => c.classList.toggle('selected', c.dataset.cartId === cardId));
    $('#custom-panel').hidden = !!id;
    const meta = (window.CARTS || []).find((c) => c.id === cardId);
    cartSelected.textContent = meta?.name || id || '(none)';
    if (id) $('#build-hint').textContent = 'Ready to build.';
  });

  // ── Spec table mirror ───────────────────────────────────────────────

  function refreshSpecTable() {
    const mem = document.querySelector('#memory-group input:checked');
    if (mem) {
      $('#spec-mem').textContent = mem.value
        ? `${mem.value} conventional`
        : 'auto-fit';
    }
    const preset = document.querySelector('#preset-group input:checked');
    if (preset) $('#spec-preset').textContent = presetLabel(preset.value);

    const vid = [];
    if ($('#mem-textVga')?.checked) vid.push('Text');
    if ($('#mem-gfx')?.checked) vid.push('Mode 13h');
    if ($('#mem-cgaGfx')?.checked) vid.push('CGA 0x04');
    $('#spec-video').textContent = vid.join(' + ') || '(none)';

    const run = ($('#run-cmd')?.value || '').trim();
    const isHack = (document.querySelector('#preset-group input:checked')?.value) === 'hack';
    $('#spec-run').textContent = isHack
      ? 'n/a (hack: bare .com)'
      : (run || 'auto (from program.json)');
  }

  document.addEventListener('change', (e) => {
    if (e.target.matches('#memory-group input, #preset-group input, #mem-textVga, #mem-gfx, #mem-cgaGfx')) {
      refreshSpecTable();
    }
  });
  document.addEventListener('input', (e) => {
    if (e.target?.id === 'run-cmd') refreshSpecTable();
  });
  refreshSpecTable();

  // build.js mutates the same controls when it applies program.json. The
  // DOM `change` event doesn't fire for programmatic .checked assignments,
  // so observe the inputs and refresh on attribute mutation.
  const formControls = [
    '#memory-group input', '#preset-group input',
    '#mem-textVga', '#mem-gfx', '#mem-cgaGfx',
  ].flatMap((s) => $$(s));
  const formObserver = new MutationObserver(() => refreshSpecTable());
  for (const el of formControls) {
    formObserver.observe(el, { attributes: true, attributeFilter: ['checked'] });
  }
  // The Run field doesn't fire input/change events when build.js sets
  // .value directly during selectCart's async fetch chain. We can't easily
  // observe an HTMLInputElement.value assignment, so poll a few times
  // after the cart-list change event: 0/100/500ms covers immediate apply,
  // single-roundtrip cart loads, and slower ones.
  cartList.addEventListener('change', () => {
    [0, 100, 500, 1500].forEach((ms) => setTimeout(refreshSpecTable, ms));
  });

  // ── Build progress mirror ───────────────────────────────────────────
  //
  // build.js appends one <li> to #stages per onProgress callback. We use
  // that as our pacing source: count of li's vs total expected steps. The
  // browser builder emits ~6-8 stages; we don't know the exact count
  // in advance, so we use an exponential easing toward 95% and snap to
  // 100% when build.js un-hides #result.

  const stages = $('#stages');
  const progressWrap = $('#build-progress-wrap');
  const barFill = $('#build-bar-fill');
  const pctEl   = $('#build-pct');
  const sizeEl  = $('#build-size');
  const buildHint = $('#build-hint');
  const blockSource = $('#block-source');
  const resultMarker = $('#result'); // hidden surface build.js un-hides

  function resetProgressUI() {
    barFill.style.width = '0%';
    pctEl.textContent = '0%';
    sizeEl.textContent = '';
  }

  // Watch #stages for additions. Each new <li> = one stage completed.
  let stageCount = 0;
  new MutationObserver((muts) => {
    let added = 0;
    for (const m of muts) added += m.addedNodes.length;
    if (!added) return;
    stageCount += added;
    // Exponential ease toward 95%: each stage closes ~30% of remaining gap.
    const cur = parseFloat(barFill.style.width) || 0;
    const target = cur + (95 - cur) * 0.30;
    barFill.style.width = target + '%';
    pctEl.textContent = Math.floor(target) + '%';

    // Surface errors immediately.
    const last = stages.lastElementChild;
    if (last?.classList.contains('stage-error')) {
      barFill.style.width = '100%';
      barFill.style.background = 'var(--edit-red)';
      pctEl.textContent = 'ERR';
      buildHint.textContent = 'Build failed — see log.';
      buildInFlight = false;
      startBtn.disabled = false;
    }
  }).observe(stages, { childList: true });

  // Watch #result for un-hide — build.js's "we're done" signal.
  new MutationObserver(() => {
    if (resultMarker.hidden) return;
    // build.js sets #size's textContent like "Cabinet: 332.4 MB"
    const sizeText = $('#size')?.textContent || '';
    // Snap progress to 100%.
    barFill.style.width = '100%';
    pctEl.textContent = '100%';
    sizeEl.textContent = sizeText.replace(/^Cabinet:\s*/, '');
    // Reveal the result block on the wizard.
    blockSource.hidden = false;
    // Populate floppy label.
    const id = (document.querySelector('#cart-list input[name="cart"]:checked')?.value) || 'CABINET';
    $('#floppy-name').textContent = id.slice(0, 8).toUpperCase();
    buildDone = true;
    buildInFlight = false;
    buildHint.textContent = 'Done. Next: choose how to play.';
    statusMsg.textContent = 'Cabinet built.';
    // Re-evaluate step-strip gating so the Play step unlocks.
    $$('.step-strip li').forEach((li) => {
      const j = Number(li.dataset.jump);
      li.classList.toggle('disabled', j === PLAY_STEP && !buildDone);
    });
    if (step === BUILD_STEP) nextBtn.disabled = false;
  }).observe(resultMarker, { attributes: true, attributeFilter: ['hidden'] });

  // Show progress block + lock UI when the user clicks Build.
  startBtn.addEventListener('click', () => {
    buildInFlight = true;
    buildDone = false;
    progressWrap.hidden = false;
    blockSource.hidden = true;
    resetProgressUI();
    barFill.style.background = '';
    stageCount = 0;
    buildHint.textContent = 'Building…';
    statusMsg.textContent = 'Building…';
    nextBtn.disabled = true;
  });

  // ── Save button → proxy to the hidden #download <a> ────────────────

  $('#save-css').addEventListener('click', (e) => {
    e.preventDefault();
    const dl = $('#download');
    if (!dl || !dl.href || dl.href.endsWith('#')) {
      statusMsg.textContent = 'Nothing to save yet — build a cabinet first.';
      return;
    }
    // Honour the cart-id-based filename if we know it.
    const id = (document.querySelector('#cart-list input[name="cart"]:checked')?.value) || '';
    dl.download = id ? `${id}-cabinet.css` : 'cabinet.css';
    dl.click();
    statusMsg.textContent = `Saved ${dl.download}.`;
  });

  // ── helpers ─────────────────────────────────────────────────────────

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // ── #games deep-link ────────────────────────────────────────────────
  // /index.html#games (or a /games link that resolves here) jumps straight
  // to the Build step, skipping the Learn explanation.
  function applyHash() {
    if ((location.hash || '').toLowerCase() === '#games') {
      setStep(BUILD_STEP);
      return true;
    }
    return false;
  }
  window.addEventListener('hashchange', applyHash);

  // Kick off — honour #games, else start at Learn sub-page 1.
  if (!applyHash()) setStep(1);
})();
