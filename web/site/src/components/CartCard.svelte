<script>
  // One cart card: cover art (with placeholder fallback) + name/desc. The
  // custom card shows a "?" glyph instead of box art.
  let { cart, selected, onpick } = $props();
  let broken = $state(false);
</script>

<div
  class="cart-card"
  class:cart-card-custom={cart.custom}
  class:selected
  role="button"
  tabindex="0"
  onclick={() => onpick(cart.id)}
  onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && onpick(cart.id)}
>
  <div class="cart-cover">
    {#if cart.custom}
      <div class="cart-cover-placeholder cart-cover-custom">
        <div class="ph-glyph">+</div>
        <div class="ph-name">Load your own program</div>
        <div class="ph-sub">A single .COM or .EXE, or a whole folder mounted as a floppy.</div>
      </div>
    {:else if cart.cover && !broken}
      <img src={cart.cover} alt={cart.name} onerror={() => (broken = true)} />
    {:else}
      <div class="cart-cover-placeholder"><div class="ph-name">{cart.name}</div></div>
    {/if}
  </div>
</div>
