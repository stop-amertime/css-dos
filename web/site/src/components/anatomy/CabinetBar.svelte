<script>
  // CabinetBar - the whole 309 MB cabinet drawn to scale as a
  // clickable bar, in file order, coloured by section group; a white
  // full-width topper pinned to the top of the wizard's scroll band so
  // the map stays visible while a section is read. (The carousel is
  // stepped by the wizard's own Back/Next buttons - nav.next()/prev()
  // walk the sections.) The three sections too small to see at true
  // scale (utilities / CPU / keyboard - 319 KB together) are a single
  // 2px sliver on the bar; the zoom box below expands them into
  // clickable segments. The selected segment drops a coloured
  // connector line out of the bar onto the section pane below (title +
  // size live in the pane's header - AboutFileMap.svelte, which also
  // owns the .anatomy-pane styles); hovering any segment shows a
  // cursor tooltip (title + size), clicking jumps there.
  import { GROUPS, SEGS, TINY, ZOOM } from './groups.js';
  import IconCursor from '~icons/pixelarticons/cursor-minimal';

  let { selected = null, hint = false, onselect, ondismiss } = $props();
  let hovered = $state(null);
  let tip = $state(null); // cursor position for the tooltip

  const colour = (id) => GROUPS.find((g) => g.id === id).c;
  // A segment dims when some OTHER group is hovered/selected.
  const active = $derived(hovered ?? selected);
  const hoverG = $derived(hovered ? GROUPS.find((g) => g.id === hovered) : null);
  const cur = $derived(selected ? GROUPS.find((g) => g.id === selected) : null);
  // Connector position: centre of the selected group's drawn segment -
  // the zoom-box segment for the tiny sections (that's the highlighted
  // area the reader sees), the bar segment otherwise. In 700-unit svg
  // x; tickPct carries the same position as a % for the hanging tick.
  const tickX = $derived.by(() => {
    if (!selected) return 0;
    const z = ZOOM.find((z) => z.g === selected);
    if (z) return z.x + z.w / 2;
    const s = SEGS.find((s) => s.g === selected);
    return s.x + s.w / 2;
  });
  const tickPct = $derived((tickX / 700) * 100);
  // The connector starts at the bottom of whichever segment is lit.
  const tickY = $derived(selected && ZOOM.some((z) => z.g === selected) ? 94 : 46);

  function track(e) { tip = { x: e.clientX, y: e.clientY }; }
</script>

<div class="cab-bar">
  <div class="cab-mid">
      <svg viewBox="0 0 700 100" role="img" onmousemove={track}
           onmouseleave={() => (hovered = null)}
           aria-label="The 309 megabyte cabinet file drawn to scale as a bar. Memory write rules take over half; the utilities, CPU and keyboard are together a 2 pixel sliver at the left edge, expanded below in a 350 times zoom box.">
        {#each SEGS as s}
          <rect class="seg" class:dim={active && active !== s.g}
                x={s.x} y="2" width={s.w} height="44" fill={colour(s.g)}
                role="button" tabindex="-1"
                onclick={() => onselect?.(s.g)}
                onmouseenter={() => (hovered = s.g)}
                onmouseleave={() => (hovered = null)} />
        {/each}
        {#if cur}
          <!-- Connector: drops from the lit segment to the svg's bottom
               edge. Painted BEFORE the zoom box so left-side segments'
               lines pass behind it; .drop-tick continues the line below
               the svg onto the section pane's top edge. -->
          <line x1={tickX} y1={tickY} x2={tickX} y2="100"
                stroke={cur.c} stroke-width="5" pointer-events="none"
                vector-effect="non-scaling-stroke" />
        {/if}
        <!-- utilities + CPU + keyboard: one to-scale sliver (319 KB -
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
                x={z.x} y="68" width={z.w} height="26" fill={colour(z.g)}
                role="button" tabindex="-1"
                onclick={() => onselect?.(z.g)}
                onmouseenter={() => (hovered = z.g)}
                onmouseleave={() => (hovered = null)} />
        {/each}
        <rect x="10" y="68" width="240" height="26" fill="none"
              stroke="var(--edit-black)" stroke-width="1.5" pointer-events="none"/>
        <text class="zoom-label" x="258" y="86"
              pointer-events="none">~350&times; zoom - 0.1% of the file</text>
      </svg>
      {#if cur}
        <span class="drop-tick" style="left:{tickPct}%; background:{cur.c}"></span>
      {/if}
  </div>

  {#if hoverG && tip}
    <div class="cab-tip" style="left:{tip.x + 14}px; top:{tip.y + 16}px">
      <span class="chip" style="background:{hoverG.c}"></span>
      <span>{hoverG.label}</span>
      <span class="sz">{hoverG.size}</span>
    </div>
  {/if}

  {#if hint}
    <!-- The "this bar is a map" hint: a yellow HINT note (same dress as
         the Play page's HINTS toast), hanging off the bar it explains. -->
    <div class="window hint-pop" role="dialog" aria-label="How to use the map">
      <div class="title-bar hint-pop-title">
        <span>HINT</span>
        <button class="hint-x" aria-label="Dismiss" onclick={() => ondismiss?.()}>&times;</button>
      </div>
      <div class="window-body">
        <div class="bar-hint">
          <IconCursor class="bar-hint-icon" aria-hidden="true" />
          <div>
            <div>
              This bar is the map - <b>click any stripe</b> to find
              out how that part of the file works.
            </div>
            <div class="bar-hint-promise">
              If you enjoy silly code hacks, this is top shelf stuff, I promise.
            </div>
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .cab-bar {
    /* Since 2026-07-10 the section PANE is the scroll container on
       this subpage (cabinet-bar.css), so the bar never scrolls at all
       and the connector stays joined; sticky remains as a harmless
       belt-and-braces. The negative margins cancel .window-body's
       padding so the topper runs edge to edge (values mirror the
       filemap-only paddings in AboutFileMap.svelte, NOT global.css's
       defaults - this subpage runs tighter chrome). */
    position: sticky;
    top: 0;
    z-index: 8;
    margin: -12px -14px 0;
    padding: 8px 12px 8px;
    background: var(--edit-white);
    border-bottom: 1px solid var(--edit-black);
  }

  .cab-mid { min-width: 0; position: relative; }
  .cab-mid > svg { width: 100%; height: auto; display: block; }

  /* The hanging half of the connector: continues the svg line down
     through the topper's bottom padding + border and across the gap,
     landing on the section pane's top edge (pane margin-top 12px -
     see cabinet-bar.css). When the reader scrolls and the pane slides
     under the sticky topper, the tick stays put, still marking where
     the open section lives on the map. */
  .drop-tick {
    position: absolute;
    top: 100%;
    width: 5px;
    height: 22px;
    transform: translateX(-50%);
    pointer-events: none;
  }

  .cab-bar .seg { cursor: pointer; outline: none; }
  .cab-bar .dim { opacity: 0.3; }
  /* svg text: font-size here is in viewBox units (700-wide), so it
     shrinks with the bar - the phone override keeps it legible. */
  .cab-bar .zoom-label { fill: #555; font-family: inherit; font-size: 13px; }

  /* ── The first-visit hint: a small yellow HINT note (same dress as
     the Play page's HINTS toast - play.css) hanging below the bar,
     with an upward arrow still pointing at the map. Shows on every
     carousel page until the X is clicked; dismissal persists
     (router.svelte.js). ── */
  .hint-pop {
    position: absolute;
    top: calc(100% + 14px);
    left: 50%;
    transform: translateX(-50%);
    z-index: 9;
    width: 380px;
    max-width: 90vw;
    margin: 0;
    background: #ffffcc;   /* a note, not another gray dialog */
    color: var(--edit-black);
    box-shadow: 4px 4px 0 var(--edit-black);
    font-size: 15px;
    line-height: 18px;
  }
  .hint-pop-title {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: #ffffcc;
    text-align: left;
    /* Bold word, no rule under it - matches the Play toast's title
       (owner ask, 2026-07-20). */
    font-weight: bold;
    border-bottom: none;
  }
  /* The upward arrow - yellow like the note (a rotated square sharing
     its background). */
  .hint-pop::before {
    content: '';
    position: absolute;
    top: -7px;
    left: 50%;
    width: 12px;
    height: 12px;
    transform: translateX(-50%) rotate(45deg);
    background: #ffffcc;
  }
  .hint-pop .window-body { padding: 10px 12px; }
  .hint-x {
    background: none;
    border: none;
    padding: 0 6px;
    font: inherit;
    /* Big and bold - the dismiss affordance was easy to miss at 16px. */
    font-size: 20px;
    font-weight: bold;
    line-height: 16px;
    color: var(--edit-black);
    cursor: pointer;
  }
  .hint-x:hover { background: var(--edit-black); color: #ffffcc; }
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
    /* filemap window-body padding stays 12px 14px at this width. */
    .cab-bar { margin: -12px -14px 0; padding: 8px 8px 6px; }
    .drop-tick { height: 20px; }
  }

  @media (max-width: 640px) {
    /* Phone: tighter chrome so the pinned map eats less of the screen
       (filemap window-body padding is 8px here). */
    .cab-bar { margin: -8px -8px 0; padding: 6px 6px 5px; }
    .drop-tick { height: 19px; }
    .cab-bar .zoom-label { font-size: 22px; }
  }
</style>
