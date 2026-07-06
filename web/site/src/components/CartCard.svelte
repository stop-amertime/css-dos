<script>
  // One cart card: cover art (with placeholder fallback) + name/desc. A
  // cart with display.bullets instead of a cover renders as a text card —
  // "NAME with: <list>" on the cart's accent colour.
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
    {:else if cart.bullets}
      <div class="cart-cover-text" style:background={cart.accent ?? '#0000AA'}>
        <div class="ct-name">{cart.name}</div>
        <div class="ct-with">with:</div>
        <ul class="ct-list">
          {#each cart.bullets as b}<li>{b}</li>{/each}
        </ul>
      </div>
    {:else if cart.cover && !broken}
      <img src={cart.cover} alt={cart.name} onerror={() => (broken = true)} />
    {:else}
      <div class="cart-cover-placeholder"><div class="ph-name">{cart.name}</div></div>
    {/if}
  </div>
</div>
