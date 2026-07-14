<script>
  import { build } from '../lib/builder.svelte.js';
  import { nav } from '../lib/router.svelte.js';
  import CartCard from './CartCard.svelte';

  // Picking a cart is the whole decision on this page - go straight to
  // the configure sub-page once its files are in. Custom stays: it
  // needs the upload panel first.
  async function pick(id) {
    if (id === 'custom') { build.selectCustom(); return; }
    await build.selectCart(id);
    if (nav.buildSub === 1) nav.next();
  }
</script>

<!-- The synthetic "custom" cart renders as a grid cell like the rest -
     CartCard's cart.custom branch draws the dashed "+ Load your own
     program" cover (was a separate full-width bar until 2026-07-13,
     owner call). -->
<div class="cart-grid">
  {#each build.featuredCarts as cart (cart.id)}
    <CartCard {cart} selected={build.selectedId === cart.id} onpick={pick} />
  {/each}
</div>

<style>
  /* cart grid - PC-box ratio, big title, small desc. Default 3×2; the grid
     is width-capped so the boxes never balloon on a wide window, and centred
     in the available space. */
  .cart-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
    max-width: 680px;   /* 3 boxes × ~219px + gaps (was 540 - owner asked for bigger carts, still 3 abreast) */
    margin: 0 auto;
  }

  @media (max-width: 560px) {
    .cart-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }
  @media (max-width: 380px) {
    .cart-grid { grid-template-columns: minmax(0, 1fr); }
  }
</style>
