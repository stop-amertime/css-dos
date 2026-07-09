<script>
  // CabinetBar — the whole 309 MB cabinet drawn to scale as a
  // clickable bar, in file order, coloured by section group; a white
  // full-width topper pinned to the top of the wizard's scroll band so
  // the map stays visible while a section is read. Tall narrow
  // prev/next arrows flank the bar and step the carousel. The three
  // sections too small to see at true scale (utilities / CPU /
  // keyboard — 319 KB together) are a single 2px sliver on the bar;
  // the zoom box below expands them into clickable segments. The
  // current section's title sits in the header row, tied to its
  // segment by a coloured tick; hovering any segment shows a cursor
  // tooltip (title + size), clicking jumps there. Groups can span
  // non-adjacent segments (the clock appears twice in the file).
  // .hint-overlay / .anatomy-pane stay in cabinet-bar.css: they're
  // rendered by About.svelte as siblings of <CabinetBar>, not inside its
  // own template, so they can't become scoped styles of this component.
  import '../../styles/_fragments/cabinet-bar.css';
  import { GROUPS, SEGS, TINY, ZOOM } from './groups.js';
  import IconCursor from '~icons/pixelarticons/cursor-minimal';

  let { selected = null, count = '', hint = false, onselect, onprev, onnext, ondismiss } = $props();
  let hovered = $state(null);
  let tip = $state(null); // cursor position for the tooltip
  let rowW = $state(0), labelW = $state(0); // measured: title row + label

  const colour = (id) => GROUPS.find((g) => g.id === id).c;
  // A segment dims when some OTHER group is hovered/selected.
  const active = $derived(hovered ?? selected);
  const hoverG = $derived(hovered ? GROUPS.find((g) => g.id === hovered) : null);
  const cur = $derived(selected ? GROUPS.find((g) => g.id === selected) : null);
  // Leader tick position: centre of the group's first drawn segment
  // (the sliver for the three zoomed sections), as % of the 700-unit
  // svg width — the svg spans the full row, so % carries over.
  const tickPct = $derived.by(() => {
    if (!selected) return 0;
    if (TINY.includes(selected)) return (11 / 700) * 100;
    const s = SEGS.find((s) => s.g === selected);
    return ((s.x + s.w / 2) / 700) * 100;
  });
  // Centre the title on the tick, clamped inside the row (64px
  // reserved for the count on the right).
  const titleLeft = $derived(
    Math.max(0, Math.min((rowW * tickPct) / 100 - labelW / 2, rowW - labelW - 64)));

  function track(e) { tip = { x: e.clientX, y: e.clientY }; }
</script>

<div class="cab-bar" class:hint-live={hint}>
  <div class="cab-grid">
    <button class="sec-arrow sec-prev" onclick={() => onprev?.()}
            aria-label="Previous section" title="Previous section">&#9668;</button>
    <div class="cab-mid">
      <div class="bar-title" bind:clientWidth={rowW}>
        {#if cur}
          <span class="t-tick" style="left:{tickPct}%; background:{cur.c}"></span>
          <h2 class="t-text" bind:clientWidth={labelW} style="left:{titleLeft}px">
            {cur.label} <span class="sz">{cur.size}</span>
          </h2>
        {:else}
          <h2 class="t-text t-map">The whole 309&nbsp;MB file</h2>
        {/if}
        {#if count}<span class="t-count">{count}</span>{/if}
      </div>

      <svg viewBox="0 0 700 100" role="img" onmousemove={track}
           onmouseleave={() => (hovered = null)}
           aria-label="The 309 megabyte cabinet file drawn to scale as a bar. Memory write rules take over half; the utilities, CPU and keyboard are together a 2 pixel sliver at the left edge, expanded below in a 350 times zoom box.">
        {#each SEGS as s}
          <rect class="seg" class:dim={active && active !== s.g}
                class:sel={selected === s.g}
                x={s.x} y="2" width={s.w} height="44" fill={colour(s.g)}
                role="button" tabindex="-1"
                onclick={() => onselect?.(s.g)}
                onmouseenter={() => (hovered = s.g)}
                onmouseleave={() => (hovered = null)} />
        {/each}
        <!-- utilities + CPU + keyboard: one to-scale sliver (319 KB —
             even 2px flatters it); the zoom box below is the click
             target. Coloured as the CPU, 80% of the sliver's bytes. -->
        <rect class:dim={active && !TINY.includes(active)}
              x="10" y="2" width="2" height="44" fill="#aa0000"
              pointer-events="none" />
        <rect x="10" y="2" width="680" height="44" fill="none"
              stroke="var(--edit-black)" stroke-width="1.5" pointer-events="none"/>
        <!-- zoom box: the sliver expanded ~350× -->
        <line x1="10" y1="46" x2="10" y2="68" stroke="var(--edit-black)" stroke-width="1"/>
        <line x1="12" y1="46" x2="250" y2="68" stroke="var(--edit-black)" stroke-width="1"/>
        {#each ZOOM as z}
          <rect class="seg" class:dim={active && active !== z.g}
                class:sel={selected === z.g}
                x={z.x} y="68" width={z.w} height="26" fill={colour(z.g)}
                role="button" tabindex="-1"
                onclick={() => onselect?.(z.g)}
                onmouseenter={() => (hovered = z.g)}
                onmouseleave={() => (hovered = null)} />
        {/each}
        <rect x="10" y="68" width="240" height="26" fill="none"
              stroke="var(--edit-black)" stroke-width="1.5" pointer-events="none"/>
        <text class="zoom-label" x="258" y="86"
              pointer-events="none">~350&times; zoom &mdash; 0.1% of the file</text>
      </svg>
    </div>
    <button class="sec-arrow sec-next" onclick={() => onnext?.()}
            aria-label="Next section" title="Next section">&#9658;</button>
  </div>

  {#if hoverG && tip}
    <div class="cab-tip" style="left:{tip.x + 14}px; top:{tip.y + 16}px">
      <span class="chip" style="background:{hoverG.c}"></span>
      <span>{hoverG.label}</span>
      <span class="sz">{hoverG.size}</span>
    </div>
  {/if}

  {#if hint}
    <div class="hint-pop" role="dialog" aria-label="How to use the map">
      <button class="hint-x" aria-label="Dismiss" onclick={() => ondismiss?.()}>&times;</button>
      <div class="bar-hint">
        <IconCursor class="bar-hint-icon" aria-hidden="true" />
        <div>
          <div>
            This bar is the map &mdash; <b>click any stripe</b> to find
            out how that part of the file works.
          </div>
          <div class="bar-hint-promise">
            If you enjoy silly code hacks, this is top shelf stuff, I promise.
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .cab-bar {
    /* Pinned to the top of the wizard's scroll band (.wiz-scroll): the
       map stays put while the section text scrolls under it. The
       negative margins cancel .window-body's padding so the topper runs
       edge to edge (values mirror global.css's responsive paddings). */
    position: sticky;
    top: 0;
    z-index: 8;
    margin: -24px -28px 0;
    padding: 10px 12px 8px;
    background: var(--edit-white);
    border-bottom: 1px solid var(--edit-black);
  }

  /* ── Topper layout: [prev arrow] [title + bar] [next arrow] ── */
  .cab-grid {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    gap: 0 12px;
    align-items: stretch;
  }
  .cab-mid { min-width: 0; }
  .cab-mid > svg { width: 100%; height: auto; display: block; }

  /* Carousel arrows: tall (full topper height) but narrow, flanking the
     bar. Flat — they belong to the topper, not floating chrome. */
  .sec-arrow {
    width: 30px;
    font: inherit;
    font-size: 18px;
    color: var(--edit-black);
    background: var(--edit-gray);
    border: 1px solid var(--edit-black);
    cursor: pointer;
    align-self: stretch;
  }
  .sec-arrow:hover { background: var(--edit-yellow); }
  .sec-arrow:active { background: var(--edit-black); color: var(--edit-white); }

  /* Title row: the current section's name + size, centred over its bar
     segment (clamped to the row) and tied to it by a coloured tick;
     "n / N" carousel position at the right. */
  .bar-title {
    position: relative;
    height: 22px;
    margin-bottom: 8px;
  }
  .bar-title .t-text {
    position: absolute;
    top: 0;
    margin: 0;
    font-size: 20px;
    line-height: 22px;
    font-weight: normal;
    letter-spacing: normal;
    white-space: nowrap;
    color: var(--edit-black);
    /* Never collide with the count at the right edge. */
    max-width: calc(100% - 56px);
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .bar-title .t-text .sz { color: var(--edit-red); font-size: 16px; }
  .bar-title .t-map { position: static; }
  .bar-title .t-count {
    position: absolute;
    right: 0;
    top: 4px;
    color: #555;
    font-size: 15px;
    line-height: 16px;
  }
  /* The leader tick: drops from under the title into the segment's top
     edge (same colour, so the join reads as one mark). */
  .bar-title .t-tick {
    position: absolute;
    top: 22px;
    width: 3px;
    height: 12px;
    transform: translateX(-50%);
    z-index: 1;
  }

  .cab-bar .seg { cursor: pointer; outline: none; }
  .cab-bar .dim { opacity: 0.3; }
  .cab-bar rect.seg.sel { stroke: var(--edit-black); stroke-width: 2.5; }
  /* svg text: font-size here is in viewBox units (700-wide), so it
     shrinks with the bar — the phone override keeps it legible. */
  .cab-bar .zoom-label { fill: #555; font-family: inherit; font-size: 13px; }

  /* ── The first-visit hint: a spotlight. The overlay dims the whole
     screen; the bar and the bubble punch through by being children of
     .cab-bar, whose z-index is raised above the page chrome while the
     hint is live. Dismiss = the X, clicking the dim, or using the
     carousel. The overlay itself is rendered by About.svelte as a
     SIBLING of the bar (styled in cabinet-bar.css, not here): Chrome
     clips position:fixed descendants of a sticky element to the sticky
     layer, which butchered the full-screen dim. Sibling at z-index 44,
     topper raised to 45 → the bar and its bubble are the spotlight;
     everything else (page chrome included) dims. ── */
  .cab-bar.hint-live { z-index: 45; }

  .hint-pop {
    position: absolute;
    top: calc(100% + 14px);
    left: 50%;
    transform: translateX(-50%);
    width: 360px;
    max-width: 90vw;
    background: var(--edit-white);
    color: var(--edit-black);
    border: 1px solid var(--edit-black);
    box-shadow: 4px 4px 0 var(--edit-black);
    padding: 12px 30px 12px 12px;
    font-size: 15px;
    line-height: 18px;
  }
  /* The upward arrow — white like the bubble (a rotated square sharing
     its background and border). */
  .hint-pop::before {
    content: '';
    position: absolute;
    top: -7px;
    left: 50%;
    width: 12px;
    height: 12px;
    transform: translateX(-50%) rotate(45deg);
    background: var(--edit-white);
    border-top: 1px solid var(--edit-black);
    border-left: 1px solid var(--edit-black);
  }
  .hint-x {
    position: absolute;
    top: 4px;
    right: 4px;
    width: 20px;
    height: 20px;
    padding: 0;
    border: 1px solid var(--edit-black);
    background: var(--edit-white);
    color: var(--edit-black);
    font: inherit;
    font-size: 14px;
    line-height: 18px;
    cursor: pointer;
  }
  .hint-x:hover { background: var(--edit-black); color: var(--edit-white); }
  .bar-hint {
    display: flex;
    gap: 10px;
    align-items: flex-start;
  }
  .bar-hint-icon {
    width: 20px;
    height: 20px;
    flex: none;
    margin-top: 1px;
    color: var(--edit-blue);
  }
  .bar-hint-promise {
    margin-top: 6px;
    font-size: 13px;
    line-height: 15px;
    color: var(--edit-red);
  }

  /* Cursor tooltip: title + size of the hovered group. */
  .cab-tip {
    position: fixed;
    z-index: 30;
    pointer-events: none;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 5px 10px;
    background: var(--edit-white);
    border: 1px solid var(--edit-black);
    box-shadow: 3px 3px 0 var(--edit-black);
    font-size: 14px;
    line-height: 16px;
    color: var(--edit-black);
    white-space: nowrap;
  }
  .cab-tip .chip {
    flex: none;
    width: 12px;
    height: 12px;
    border: 1px solid var(--edit-black);
  }
  .cab-tip .sz { color: var(--edit-red); }

  @media (max-width: 900px) {
    /* window-body padding is 16px 14px at this width. */
    .cab-bar { margin: -16px -14px 0; padding: 8px 8px 6px; }
    .sec-arrow { width: 24px; font-size: 16px; }
  }

  @media (max-width: 640px) {
    /* Phone: tighter chrome so the pinned map eats less of the screen
       (window-body padding is 12px 10px here). */
    .cab-bar { margin: -12px -10px 0; padding: 6px 6px 5px; }
    .cab-grid { gap: 0 6px; }
    .sec-arrow { width: 20px; font-size: 14px; }
    .bar-title { height: 18px; margin-bottom: 6px; }
    .bar-title .t-text { font-size: 16px; line-height: 18px; }
    .bar-title .t-text .sz { font-size: 13px; }
    .bar-title .t-count { top: 2px; font-size: 13px; }
    .bar-title .t-tick { top: 18px; height: 9px; }
    .cab-bar .zoom-label { font-size: 22px; }
  }
</style>
