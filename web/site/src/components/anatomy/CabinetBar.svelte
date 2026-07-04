<script>
  // CabinetBar — the whole 309 MB cabinet drawn to scale as a
  // clickable bar, in file order, coloured by section group; sticky
  // at the top of the wizard's scroll band so the map stays visible
  // while a section is read. The three sections too small to see at
  // true scale (utilities / CPU / keyboard — 319 KB together) are a
  // single 2px sliver on the bar; the zoom box below expands them
  // into clickable segments. The current section's title sits in the
  // header row, tied to its segment by a coloured tick; hovering any
  // segment shows a cursor tooltip (title + size), clicking jumps
  // there. Groups can span non-adjacent segments (the clock appears
  // twice in the file).
  import '../../styles/_fragments/cabinet-bar.css';
  import { GROUPS, SEGS, TINY, ZOOM } from './groups.js';

  let { selected = null, count = '', onselect } = $props();
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

<div class="cab-bar">
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

  {#if hoverG && tip}
    <div class="cab-tip" style="left:{tip.x + 14}px; top:{tip.y + 16}px">
      <span class="chip" style="background:{hoverG.c}"></span>
      <span>{hoverG.label}</span>
      <span class="sz">{hoverG.size}</span>
    </div>
  {/if}
</div>
