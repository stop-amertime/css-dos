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
  {#each build.featuredCarts as cart (cart.id)}
    <CartCard {cart} selected={build.selectedId === cart.id} onpick={pick} />
  {/each}
</div>
