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
    /* Transparent: the strip sits on .wiz-head's ▒-textured band —
       no hairline borders (band edges are texture changes now). */
    background: none;
    padding: 0;
  }
  .step-strip li {
    flex: 1;
    padding: 4px 8px;
    font-size: 16px;
    line-height: 16px;
    color: var(--edit-black);
    text-align: center;
    cursor: pointer;
    user-select: none;
    white-space: nowrap;
  }
  .step-strip li .num { color: var(--edit-red); margin-right: 4px; }
  /* Inactive tabs are flat grey buttons; the CURRENT tab goes
     transparent so the band's ▒ texture shows through — pressed into
     the chrome, while the others sit raised. (Owner swapped this from
     the inverse: a flat current tab didn't line up with the band.)
     Cyan stays off the strip — CTAs and subdots only. */
  .step-strip li { background: var(--edit-gray); }
  .step-strip li.current {
    background: none;
    color: var(--edit-black);
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
    /* Squash before wrapping: items shrink + ellipsize on one row
       (nowrap) rather than dropping a lone label to a second line. */
    flex-wrap: nowrap;
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
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .subdots li .dot { flex: none; }
  /* Dots and the current chip carry blocky mini-shadows, not 1px
     outlines — hairlines read hi-res (owner rule, 2026-07-09). */
  .subdots li .dot {
    width: 10px; height: 10px;
    box-shadow: 2px 2px 0 var(--edit-black);
    background: var(--edit-white);
    display: inline-block;
  }
  .subdots li.done .dot { background: #666; }
  .subdots li.current {
    color: var(--edit-black);
    box-shadow: 2px 2px 0 var(--edit-black);
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
