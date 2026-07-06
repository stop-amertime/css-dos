<script>
  import '../styles/_fragments/cart-grid.css';
  import { build } from '../lib/builder.svelte.js';
  import { nav } from '../lib/router.svelte.js';
  import CartCard from './CartCard.svelte';

  // Picking a cart is the whole decision on this page — go straight to
  // the configure sub-page once its files are in. Custom stays: it
  // needs the upload panel first.
  async function pick(id) {
    if (id === 'custom') { build.selectCustom(); return; }
    await build.selectCart(id);
    if (nav.buildSub === 1) nav.next();
  }
</script>

<div class="cart-grid">
  {#each build.featuredCarts.filter((c) => !c.custom) as cart (cart.id)}
    <CartCard {cart} selected={build.selectedId === cart.id} onpick={pick} />
  {/each}
</div>

<!-- The custom card is a full-width bar under the grid, not a sixth
     box — "pick a box above, or bring your own". -->
<div
  class="cart-wide-custom"
  class:selected={build.selectedId === 'custom'}
  role="button"
  tabindex="0"
  onclick={() => pick('custom')}
  onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && pick('custom')}
>
  <div class="ph-glyph">+</div>
  <div>
    <div class="ph-name">&hellip;or load your own program</div>
    <div class="ph-sub">Upload a single .COM or .EXE &mdash; or a whole folder, mounted as a floppy.</div>
  </div>
</div>
