<script>
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

<style>
  /* cart grid — PC-box ratio, big title, small desc. Default 3×2; the grid
     is width-capped so the boxes never balloon on a wide window, and centred
     in the available space. */
  .cart-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
    max-width: 540px;   /* 3 boxes × ~168px + gaps — a sane ceiling */
    margin: 0 auto;
  }

  /* Wide "load your own" bar — replaces the old sixth-cell custom card.
     Same width cap as the grid, same dashed language as CartCard's cover. */
  .cart-wide-custom {
    max-width: 540px;
    margin: 12px auto 0;
    border: 2px dashed #8a8a8a;
    background: #ededed;
    color: #444;
    cursor: pointer;
    user-select: none;
    display: flex; align-items: center;
    gap: 14px;
    padding: 12px 18px;
  }
  .cart-wide-custom:hover { background: #ddddff; }
  .cart-wide-custom.selected { outline: 3px solid #1faa1f; outline-offset: -2px; }
  .cart-wide-custom .ph-glyph {
    font-size: 34px;
    line-height: 1;
    font-weight: bold;
    color: #8a8a8a;
  }
  .cart-wide-custom .ph-name { font-size: 17px; line-height: 20px; color: #222; }
  .cart-wide-custom .ph-sub { font-size: 12px; line-height: 15px; color: #555; margin-top: 3px; }

  @media (max-width: 560px) {
    .cart-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }
  @media (max-width: 380px) {
    .cart-grid { grid-template-columns: minmax(0, 1fr); }
  }
</style>
