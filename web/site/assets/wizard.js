// wizard.js — visual chrome on top of build.js.
//
// This file owns:
//   * Step navigation (the 3-step strip + Back/Next buttons + arrow keys),
//     including two independent sub-page systems (Learn's 5 pages, Build's
//     3: pick a program / configure & build / cabinet ready).
//   * The visible cart-card grid: rendered from window.CARTS, mirrors
//     selection into the hidden #cart-list radio group that build.js owns.
//   * The spec-table mirror of the advanced controls (memory / preset /
//     video), plus the boot-mode radio (program vs. DOS shell), which
//     drives the hidden #run-cmd field build.js reads at submit time.
//   * Progress-bar + stage mirror: observes #stages mutations build.js
//     emits, walks the bar fill and advances to the "cabinet ready"
//     sub-page on success.
//   * The "Save cabinet.css" button → proxies to the hidden #download <a>.
//
// All real work — fetching /_carts.json, building cabinets, paginating the
// source viewer, talking to the calcite bridge — still lives in build.js.

(function () {
  'use strict';

  const TOTAL_STEPS = 3;
  const LEARN_STEP = 1;   // step 1 holds the 3 Learn sub-pages
  const BUILD_STEP = 2;   // step 2 holds the 3 Build sub-pages
  const PLAY_STEP  = 3;
  const LEARN_SUBPAGES = 5;
  const BUILD_PICK_SUB   = 1;  // pick a program
  const BUILD_CONFIG_SUB = 2;  // configure + build button
  const BUILD_RESULT_SUB = 3;  // cabinet ready (only reachable once built)
  let step = 1;
  let sub = 1;            // active Learn sub-page (1..LEARN_SUBPAGES)
  let buildSub = 1;       // active Build sub-page (1..3)
  let buildDone = false;
  let buildInFlight = false;

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));

  const wizWindow  = $('.window.wizard');
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
    if (step === BUILD_STEP) renderBuildSub();
    // Only the Play step gets the wide dialog; Learn/Build stay reading-width.
    wizWindow.classList.toggle('play-wide', step === PLAY_STEP);
    document.title = `CSS-DOS — ${STEP_TITLES[step - 1]}`;
    // Back is disabled only at the very start (Learn sub-page 1).
    prevBtn.disabled = (step === LEARN_STEP && sub === 1);
    updateNextGating();
    nextBtn.innerHTML = step === TOTAL_STEPS
      ? '<span class="hot">R</span>estart'
      : '<span class="hot">N</span>ext &raquo;';
    statusMsg.textContent = `Step ${step}/${TOTAL_STEPS}`;
    writeHash(step);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  // Show Learn sub-page `sub`; update dots + Back-button gating.
  function renderSub() {
    sub = Math.max(1, Math.min(LEARN_SUBPAGES, sub));
    $$('.subpage[data-subpage]').forEach((el) => {
      el.hidden = Number(el.dataset.subpage) !== sub;
    });
    $$('#learn-subdots li').forEach((li) => {
      const j = Number(li.dataset.subjump);
      li.classList.toggle('current', j === sub);
      li.classList.toggle('done', j < sub);
    });
    prevBtn.disabled = (step === LEARN_STEP && sub === 1);
  }

  // Show Build sub-page `buildSub`; update dots. The "Cabinet ready" dot
  // only appears once a build exists — no jumping ahead to a page with
  // nothing on it.
  function renderBuildSub() {
    buildSub = Math.max(1, Math.min(BUILD_RESULT_SUB, buildSub));
    if (buildSub === BUILD_RESULT_SUB && !buildDone) buildSub = BUILD_CONFIG_SUB;
    $$('.subpage[data-build-subpage]').forEach((el) => {
      el.hidden = Number(el.dataset.buildSubpage) !== buildSub;
    });
    $$('#build-subdots li').forEach((li) => {
      const j = Number(li.dataset.subjump);
      li.hidden = (j === BUILD_RESULT_SUB && !buildDone);
      li.classList.toggle('current', j === buildSub);
      li.classList.toggle('done', j < buildSub);
    });
    updateNextGating();
  }

  // A program is "picked" exactly when build.js's own #start button would
  // allow a build — that's the one place build.js already tracks "do we
  // have bytes to build from" (built-in cart selected, or a custom file/
  // folder actually chosen). Reusing it means this can't drift out of sync
  // with build.js across its several independent selection paths.
  function cartPicked() {
    return !startBtn.disabled;
  }

  // build.js flips #start.disabled asynchronously (after its cart-file
  // fetch resolves), well after the cart-list `change` event that triggers
  // it — a plain post-selection call to updateNextGating() would read the
  // stale (still-disabled) value. Observing the attribute directly catches
  // the moment it actually changes, regardless of how long the fetch took.
  new MutationObserver(updateNextGating)
    .observe(startBtn, { attributes: true, attributeFilter: ['disabled'] });

  // Next is disabled (with an explanatory tooltip) whenever the current
  // page has nothing to advance to yet: Build sub-page 1 with no cart
  // picked, or the Build step overall before a cabinet exists.
  function updateNextGating() {
    if (step === BUILD_STEP && buildSub === BUILD_PICK_SUB && !cartPicked()) {
      nextBtn.disabled = true;
      nextBtn.title = 'Select a program first';
    } else if (step === BUILD_STEP && buildSub === BUILD_CONFIG_SUB && !buildDone) {
      nextBtn.disabled = true;
      nextBtn.title = 'Build the cabinet first';
    } else {
      nextBtn.disabled = false;
      nextBtn.title = '';
    }
  }

  // Forward one logical page: within Learn, advance sub-page; within Build,
  // advance sub-page; at the last sub-page of either, cross to the next step.
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
    if (step === BUILD_STEP && buildSub < BUILD_CONFIG_SUB) {
      if (!cartPicked()) return; // gated — nextBtn is disabled, but belt & braces
      buildSub += 1;
      renderBuildSub();
      window.scrollTo({ top: 0, behavior: 'instant' });
      return;
    }
    if (step === BUILD_STEP && buildSub === BUILD_CONFIG_SUB && !buildDone) {
      return; // gated — build the cabinet first
    }
    setStep(step + 1);
  }

  // Backward one logical page: within Build/Play, step back; entering Learn
  // from Build lands on the last sub-page; within Learn/Build, retreat
  // sub-page.
  function goPrev() {
    if (step === LEARN_STEP) {
      if (sub > 1) { sub -= 1; renderSub(); window.scrollTo({ top: 0, behavior: 'instant' }); }
      return;
    }
    if (step === BUILD_STEP) {
      if (buildSub > 1) {
        buildSub -= 1;
        renderBuildSub();
        window.scrollTo({ top: 0, behavior: 'instant' });
        return;
      }
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

  // Sub-dot clicks — jump between Build sub-pages. Forward jumps respect
  // the same gates as Next (can't skip to Configure with no cart picked,
  // can't skip to Cabinet ready with no build).
  $$('#build-subdots li').forEach((li) => {
    li.addEventListener('click', () => {
      const j = Number(li.dataset.subjump);
      if (j > buildSub) {
        if (j >= BUILD_CONFIG_SUB && !cartPicked()) return;
        if (j >= BUILD_RESULT_SUB && !buildDone) return;
      }
      buildSub = j;
      renderBuildSub();
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
  const cartDetail = $('#cart-detail');

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

      // No per-card name/desc text any more — the cover (box art) speaks for
      // itself, and the selected cart's name + description live in the
      // #cart-detail box below the grid (see selectCartCard).

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

  // The Custom card has no box art. Since the cards no longer carry name/desc
  // text below them, the custom card puts its name + blurb inside the cover
  // area itself — dashed border, muted fill (styled in wizard.css).
  function makeCustomCover(meta) {
    const wrap = document.createElement('div');
    wrap.className = 'cart-cover-placeholder cart-cover-custom';
    wrap.innerHTML = `
      <div class="ph-glyph">+</div>
      <div class="ph-name">${escapeHtml(meta.name)}</div>
      <div class="ph-sub">${escapeHtml(meta.desc || '')}</div>
    `;
    return wrap;
  }

  function selectCartCard(id) {
    if (buildInFlight) return;
    const meta = (window.CARTS || []).find((c) => c.id === id);
    const isCustom = !!meta?.custom;

    // Update visible state: outline the selected card.
    $$('.cart-card').forEach((c) => c.classList.toggle('selected', c.dataset.cartId === id));

    // Populate the detail box (name as a header + description). The custom
    // card carries its own text inside the card, so hide the box for it.
    if (cartDetail) {
      cartDetail.hidden = isCustom;
      if (!isCustom) {
        const nameEl = cartDetail.querySelector('.cart-detail-name');
        const descEl = cartDetail.querySelector('.cart-detail-desc');
        if (nameEl) nameEl.textContent = meta?.name || id;
        if (descEl) descEl.textContent = meta?.desc || '';
      }
    }

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
      if (buildSub === BUILD_RESULT_SUB) buildSub = BUILD_CONFIG_SUB;
      renderBuildSub();
    } else {
      $('#build-hint').textContent = 'Ready to build.';
      updateNextGating();
    }
  }

  function presetLabel(p) {
    return {
      'dos-corduroy': 'Corduroy + DOS',
      'dos-muslin':   'Muslin + DOS',
      'hack':         'hack (no BIOS, no DOS)',
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
    // Mirror the detail box. Custom card (empty id) carries its own text, so
    // hide the box for it.
    if (cartDetail) {
      cartDetail.hidden = !id;
      if (id) {
        const nameEl = cartDetail.querySelector('.cart-detail-name');
        const descEl = cartDetail.querySelector('.cart-detail-desc');
        if (nameEl) nameEl.textContent = meta?.name || id;
        if (descEl) descEl.textContent = meta?.desc || '';
      }
    }
    if (id) $('#build-hint').textContent = 'Ready to build.';
    updateNextGating();
  });

  // Custom file/folder pick is a third path (independent of the cart-list
  // radio) that flips build.js's #start.disabled — re-check the gate here
  // too so Next unlocks the moment a file is actually chosen.
  $('#com-file')?.addEventListener('change', updateNextGating);
  $('#dir-file')?.addEventListener('change', updateNextGating);

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
    const isShell = (document.querySelector('#boot-mode-group input:checked')?.value) === 'shell';
    $('#spec-run').textContent = isHack
      ? 'n/a (hack: bare .com)'
      : isShell
      ? 'DOS shell (COMMAND.COM)'
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
    // A new cart always starts in "boot into the program" mode — simplest
    // and least surprising, and it sidesteps having to guess whether a
    // stale captured default from the *previous* cart is still valid.
    const programRadio = document.querySelector('#boot-mode-group input[value="program"]');
    if (programRadio) programRadio.checked = true;
    [0, 100, 500, 1500].forEach((ms) => setTimeout(captureBootModeDefault, ms));
  });

  // ── Boot-mode radio ─────────────────────────────────────────────────
  //
  // #run-cmd is still the field build.js reads at submit time, but it's
  // never shown — this 2-option radio drives it instead. "The program"
  // restores whatever build.js/program.json set as the default run
  // command (captured below, right after each cart load); "DOS shell"
  // clears it to boot to a bare COMMAND.COM prompt.
  let runCmdDefault = '';
  const runCmdField = $('#run-cmd');

  function captureBootModeDefault() {
    if (!runCmdField) return;
    runCmdDefault = runCmdField.value;
  }

  $$('#boot-mode-group input').forEach((r) => {
    r.addEventListener('change', () => {
      if (!runCmdField) return;
      runCmdField.value = (r.value === 'shell') ? '' : runCmdDefault;
      runCmdField.dispatchEvent(new Event('input', { bubbles: true }));
    });
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
      updateNextGating();
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
    // Advance to the "Cabinet ready" sub-page (reveals the block, updates
    // the sub-dots, and re-checks Next's gate) if still on Build.
    if (step === BUILD_STEP) {
      buildSub = BUILD_RESULT_SUB;
      renderBuildSub();
    }
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
    updateNextGating();
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

  // ── Hash routing ────────────────────────────────────────────────────
  // The wizard is a single page; the URL hash is the "route" so a refresh
  // (or a shared link) lands back on the same step instead of resetting to
  // About. #games is kept as a historical alias for #build.
  const HASH_TO_STEP = {
    '#about': LEARN_STEP, '#learn': LEARN_STEP,
    '#build': BUILD_STEP, '#games': BUILD_STEP,
    '#play':  PLAY_STEP,
  };
  const STEP_TO_HASH = { [LEARN_STEP]: '#about', [BUILD_STEP]: '#build', [PLAY_STEP]: '#play' };

  // setStep() calls writeHash(); the resulting hashchange must not loop back
  // into setStep(). This flag suppresses that echo.
  let syncingHash = false;
  function writeHash(n) {
    const want = STEP_TO_HASH[n];
    if (!want || location.hash.toLowerCase() === want) return;
    syncingHash = true;
    location.hash = want;
    // hashchange fires async; clear the guard on the next frame.
    setTimeout(() => { syncingHash = false; }, 0);
  }

  // Read the hash and move there, honouring the same gating as a tab click
  // (Play only once a build exists; an ungated forward jump is ignored).
  function applyHash() {
    if (syncingHash) return true;
    const target = HASH_TO_STEP[(location.hash || '').toLowerCase()];
    if (!target) return false;
    if (target === PLAY_STEP && !buildDone) { setStep(BUILD_STEP); return true; }
    setStep(target);
    return true;
  }
  window.addEventListener('hashchange', applyHash);

  // Kick off — honour the hash, else start at Learn sub-page 1.
  if (!applyHash()) setStep(1);
})();
