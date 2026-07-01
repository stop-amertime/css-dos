<script>
  import '../styles/_fragments/cart-grid.css';
  import { build } from '../lib/builder.svelte.js';
  import CartCard from './CartCard.svelte';

  function pick(id) {
    if (id === 'custom') build.selectCustom();
    else build.selectCart(id);
  }
</script>

<div class="cart-grid">
  {#each build.featuredCarts as cart (cart.id)}
    <CartCard {cart} selected={build.selectedId === cart.id} onpick={pick} />
  {/each}
</div>
