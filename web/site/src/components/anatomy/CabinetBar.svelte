<script>
  // CabinetBar — the whole 309 MB cabinet drawn to scale as a
  // clickable bar, in file order, coloured by section group. The bar
  // is the carousel's map: the current section stays lit, hovering
  // shows a cursor tooltip (title + size), clicking jumps there.
  // Groups can span non-adjacent segments (memory-write and clock
  // each appear twice in the file).
  import '../../styles/_fragments/cabinet-bar.css';
  import { GROUPS, SEGS } from './groups.js';

  let { selected = null, onselect } = $props();
  let hovered = $state(null);
  let tip = $state(null); // cursor position for the tooltip

  const colour = (id) => GROUPS.find((g) => g.id === id).c;
  // A segment dims when some OTHER group is hovered/selected.
  const active = $derived(hovered ?? selected);
  const hoverG = $derived(hovered ? GROUPS.find((g) => g.id === hovered) : null);

  function track(e) { tip = { x: e.clientX, y: e.clientY }; }
</script>

<div class="cab-bar">
  <svg viewBox="0 0 700 124" role="img" onmousemove={track}
       onmouseleave={() => (hovered = null)}
       aria-label="The 309 megabyte cabinet file drawn to scale as a bar. Memory write rules take over half; the CPU is a hairline of about 255 kilobytes.">
    {#each SEGS as s}
      <rect class="seg" class:dim={active && active !== s.g}
            class:sel={selected === s.g}
            x={s.x} y="8" width={s.w} height="44" fill={colour(s.g)}
            role="button" tabindex="-1"
            onclick={() => onselect?.(s.g)}
            onmouseenter={() => (hovered = s.g)}
            onmouseleave={() => (hovered = null)} />
    {/each}
    <rect x="10" y="8" width="680" height="44" fill="none"
          stroke="var(--edit-black)" stroke-width="1.5" pointer-events="none"/>
    <!-- zoom callout for the CPU hairline -->
    <g class="seg cpu-callout" class:dim={active && active !== 'cpu'}
       role="button" tabindex="-1"
       onclick={() => onselect?.('cpu')}
       onmouseenter={() => (hovered = 'cpu')}
       onmouseleave={() => (hovered = null)}>
      <line x1="22" y1="53" x2="22" y2="84" stroke="#aa0000" stroke-width="1"/>
      <line x1="27" y1="53" x2="262" y2="84" stroke="#aa0000" stroke-width="1"/>
      <rect x="22" y="84" width="240" height="30" fill="var(--edit-white)"
            stroke="#aa0000" stroke-width="1.5"/>
      <text x="142" y="103" text-anchor="middle" font-size="13" fill="#aa0000"
            font-family="inherit">the entire CPU &mdash; 255 KB (under 0.1%)</text>
    </g>
  </svg>

  {#if hoverG && tip}
    <div class="cab-tip" style="left:{tip.x + 14}px; top:{tip.y + 16}px">
      <span class="chip" style="background:{hoverG.c}"></span>
      <span>{hoverG.label}</span>
      <span class="sz">{hoverG.size}</span>
    </div>
  {/if}

  <p class="caption">
    The whole 309&nbsp;MB file (a real Sokoban build), to scale, in
    file order &mdash; except the four leftmost slivers, drawn wider
    than truth (each would be under a pixel) so they can be clicked.
  </p>
</div>
