<script>
  // One component for both the numbered top strip and the sub-page dots.
  // items: [{ label }]; current is 1-based; onjump(i) fires on a clickable
  // dot; disabled(i) optionally greys/blocks a dot; disabledTip is a short
  // "why it's locked" shown as a tooltip on a disabled dot (hover/tap).
  let { items, current, onjump, variant = 'sub', disabled = () => false,
        disabledTip = null } = $props();
</script>

<ol class={variant === 'strip' ? 'step-strip' : 'subdots'}>
  {#each items as item, i (i)}
    {@const n = i + 1}
    <li
      class:current={n === current}
      class:done={n < current}
      class:disabled={disabled(n)}
      class:clickable={n !== current && !disabled(n)}
      data-tip={disabled(n) ? disabledTip : null}
      role="button"
      tabindex="0"
      onclick={() => !disabled(n) && onjump?.(n)}
      onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && !disabled(n) && onjump?.(n)}
    >
      {#if variant === 'strip'}
        <span class="num">{n}</span> <span class="lbl">{item.label}</span>
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
    padding: 5px 8px;
    /* Bigger than body text: the three main tabs are the site's primary
       navigation, so they get headline weight (owner ask, 2026-07-10). */
    font-size: 20px;
    line-height: 20px;
    color: var(--edit-black);
    text-align: center;
    cursor: pointer;
    user-select: none;
    white-space: nowrap;
  }
  .step-strip li .num { color: var(--edit-red); margin-right: 4px; }
  /* The CURRENT tab goes transparent so the band's ▒ texture shows
     through — pressed into the chrome — while the inactive tabs wear a
     DARKER dither of the same weave, sitting further back (owner call
     2026-07-10: all tabs dithered, current lightest, not flat-vs-
     dithered). Cyan stays off the strip — CTAs and subdots only. */
  .step-strip li {
    background: conic-gradient(#666 90deg, #0000 90deg 180deg,
                #666 180deg 270deg, #0000 270deg) 0 0 / 4px 4px,
                var(--edit-gray);
  }
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
  /* Fade the tab's CONTENT, not the li — an opacity on the li would
     drag the tooltip ::after below down with it (child opacity can't
     exceed the parent's). */
  .step-strip li.disabled { cursor: not-allowed; }
  .step-strip li.disabled > span { opacity: 0.6; }
  /* Locked-tab tooltip (same yellow bubble as global .tip-anchor):
     hover/tap/focus on a disabled tab says why it's off. Below the tab
     (above would leave the dialog), right-aligned so the rightmost
     tab's bubble stays inside the window. The li is the positioning
     box; its ≤900px ellipsis clip lives on .lbl, not the li, so the
     bubble never gets cut. */
  .step-strip li { position: relative; }
  .step-strip li.disabled[data-tip]::after {
    content: attr(data-tip);
    position: absolute;
    top: calc(100% + 6px);
    right: 4px;
    background: var(--edit-yellow);
    color: var(--edit-black);
    border: 1px solid var(--edit-black);
    box-shadow: 4px 4px 0 var(--edit-black);
    padding: 4px 8px;
    font-size: 14px;
    line-height: 16px;
    white-space: nowrap;
    z-index: 30;
    display: none;
    pointer-events: none;
  }
  .step-strip li.disabled[data-tip]:hover::after,
  .step-strip li.disabled[data-tip]:active::after,
  .step-strip li.disabled[data-tip]:focus::after { display: block; }

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
    /* Black, not dimmed grey — #666 was illegible on the dithered
       band. The white current chip still marks the selection. */
    color: var(--edit-black);
    cursor: pointer;
    user-select: none;
    padding: 4px 10px 4px 8px;
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .subdots li .dot { flex: none; }
  /* Flat squares — no outline, no shadow (clutter at 10px). The
     current chip below keeps its blocky shadow; it's button-sized. */
  .subdots li .dot {
    width: 10px; height: 10px;
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
      font-size: 17px;
    }
    /* Ellipsize the label span, NOT the li — overflow:hidden on the li
       would clip the locked-tab tooltip ::after. */
    .step-strip li .lbl {
      display: inline-block;
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      vertical-align: bottom;
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
    .step-strip li { font-size: 16px; padding: 4px 3px; }
    .step-strip li .num { display: none; }
    /* Ten labelled sub-page dots would stack ~250px tall. Collapse to bare
       dots; only the current page keeps its label. */
    .subdots { gap: 2px; }
    .subdots li { padding: 4px 5px; }
    .subdots li:not(.current) { font-size: 0; gap: 0; }
    .subdots li + li::before { content: none; }
  }
</style>
