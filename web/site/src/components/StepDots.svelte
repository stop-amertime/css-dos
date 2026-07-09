<script>
  // One component for both the numbered top strip and the sub-page dots.
  // items: [{ label }]; current is 1-based; onjump(i) fires on a clickable
  // dot; disabled(i) optionally greys/blocks a dot.
  let { items, current, onjump, variant = 'sub', disabled = () => false } = $props();
</script>

<ol class={variant === 'strip' ? 'step-strip' : 'subdots'}>
  {#each items as item, i (i)}
    {@const n = i + 1}
    <li
      class:current={n === current}
      class:done={n < current}
      class:disabled={disabled(n)}
      class:clickable={n !== current && !disabled(n)}
      role="button"
      tabindex="0"
      onclick={() => !disabled(n) && onjump?.(n)}
      onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && !disabled(n) && onjump?.(n)}
    >
      {#if variant === 'strip'}
        <span class="num">{n}</span> {item.label}
      {:else}
        <span class="dot"></span> {item.label}
      {/if}
    </li>
  {/each}
</ol>

<style>
  /* ===== Step breadcrumb strip ===== */
  .step-strip {
    display: flex;
    list-style: none;
    background: var(--edit-gray);
    border-bottom: 1px solid var(--edit-black);
    padding: 0;
  }
  .step-strip li {
    flex: 1;
    padding: 4px 8px;
    font-size: 16px;
    line-height: 16px;
    color: var(--edit-black);
    border-right: 1px solid var(--edit-black);
    text-align: center;
    cursor: pointer;
    user-select: none;
    white-space: nowrap;
  }
  .step-strip li:last-child { border-right: none; }
  .step-strip li .num { color: var(--edit-red); margin-right: 4px; }
  /* The current tab is the OPEN folder tab: dialog grey, with a grey
     box-shadow painting over the strip's 1px bottom border so the tab
     visually connects to the band below — you're not on a button,
     you're on the page it opens. Other tabs stay quiet grey (owner
     tried cyan here 2026-07-09 and pulled it: too loud next to the
     open tab). Cyan = clickable survives on the CTAs and subdots. */
  .step-strip li.current {
    background: var(--edit-gray);
    color: var(--edit-black);
    position: relative;
    box-shadow: 0 1px 0 0 var(--edit-gray);
  }
  /* TUI-style angle brackets on the current tab — a cheap, authentic
     touch (BIOS setup / Turbo Vision menu highlight). Pseudo-elements
     so they don't touch the flex layout or push the label. */
  .step-strip li.current::before,
  .step-strip li.current::after {
    color: var(--edit-red);
  }
  .step-strip li.current::before { content: '\2039 '; }
  .step-strip li.current::after { content: ' \203a'; }
  .step-strip li.disabled { cursor: not-allowed; opacity: 0.6; background: var(--edit-gray); }

  /* ===== Sub-page dot indicator ===== */
  .subdots {
    display: flex;
    gap: 8px;
    list-style: none;
    margin: 10px 0;
    padding: 0;
    flex-wrap: wrap;
    justify-content: center;
  }
  .subdots li {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 16px;
    line-height: 16px;
    color: #666;
    cursor: pointer;
    user-select: none;
    padding: 4px 10px 4px 8px;
    border: 1px solid transparent;
  }
  .subdots li .dot {
    width: 10px; height: 10px;
    border: 1px solid var(--edit-black);
    background: var(--edit-white);
    display: inline-block;
  }
  .subdots li.done .dot { background: #666; }
  .subdots li.current {
    color: var(--edit-black);
    border: 1px solid var(--edit-black);
    background: var(--edit-white);
  }
  .subdots li.current .dot { background: var(--edit-cyan); }
  .subdots li + li::before {
    content: '\2192';
    color: #999;
    margin-right: 2px;
  }

  @media (max-width: 900px) {
    /* Strip cells shrink + ellipsize instead of forcing the row wider than
       the viewport (min-width:0 releases the flex min-content floor — this is
       what fixes the horizontal-overflow bug). */
    .step-strip li {
      min-width: 0;
      padding: 4px 4px;
      font-size: 14px;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .subdots {
      gap: 6px;
      margin: 8px 0;
      font-size: 13px;
      line-height: 14px;
    }
    .subdots li { padding: 3px 6px; }
  }
  @media (max-width: 640px) {
    /* Phone: drop the number chips, keep the labels (they wrap fine). */
    .step-strip li { font-size: 13px; padding: 4px 3px; }
    .step-strip li .num { display: none; }
    /* Ten labelled sub-page dots would stack ~250px tall. Collapse to bare
       dots; only the current page keeps its label. */
    .subdots { gap: 2px; }
    .subdots li { padding: 4px 5px; }
    .subdots li:not(.current) { font-size: 0; gap: 0; }
    .subdots li + li::before { content: none; }
  }
</style>
