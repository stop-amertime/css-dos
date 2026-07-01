<script>
  import '../styles/_fragments/step-dots.css';
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
      onclick={() => !disabled(n) && onjump?.(n)}
    >
      {#if variant === 'strip'}
        <span class="num">{n}</span> {item.label}
      {:else}
        <span class="dot"></span> {item.label}
      {/if}
    </li>
  {/each}
</ol>
