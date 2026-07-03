<script>
  // CabinetBar — the whole 309 MB cabinet drawn to scale as a
  // clickable bar, in file order, coloured by story group. Clicking a
  // segment (or a legend row) opens that group's story; hovering
  // highlights every segment of the group, including non-adjacent
  // ones (memory-write and clock each appear twice in the file).
  import '../../styles/_fragments/cabinet-bar.css';
  import { GROUPS, SEGS } from './groups.js';

  let { selected = null, onselect } = $props();
  let hovered = $state(null);

  const colour = (id) => GROUPS.find((g) => g.id === id).c;
  // A segment dims when some OTHER group is hovered/selected.
  const active = $derived(hovered ?? selected);
</script>

<div class="cab-bar">
  <svg viewBox="0 0 700 124" role="img"
       aria-label="The 309 megabyte cabinet file drawn to scale as a bar. Memory write rules take over half; the CPU is a hairline of about 320 kilobytes.">
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
      <line x1="15" y1="53" x2="15" y2="84" stroke="#aa0000" stroke-width="1"/>
      <line x1="20" y1="53" x2="255" y2="84" stroke="#aa0000" stroke-width="1"/>
      <rect x="15" y="84" width="240" height="30" fill="var(--edit-white)"
            stroke="#aa0000" stroke-width="1.5"/>
      <text x="135" y="103" text-anchor="middle" font-size="13" fill="#aa0000"
            font-family="inherit">the entire CPU &mdash; ~320 KB (0.1%)</text>
    </g>
  </svg>

  <div class="cab-legend">
    {#each GROUPS as g}
      <button class="cab-leg-row" class:sel={selected === g.id}
              onclick={() => onselect?.(g.id)}
              onmouseenter={() => (hovered = g.id)}
              onmouseleave={() => (hovered = null)}>
        <span class="chip" style="background:{g.c}"></span>
        <span>{g.label}</span>
        <span class="sz">{g.size}</span>
      </button>
    {/each}
  </div>

  <p class="caption">
    To scale &mdash; except the header, CPU and keyboard slivers, drawn
    wider than truth (each would be under a pixel) so they can be
    clicked at all.
  </p>
</div>
