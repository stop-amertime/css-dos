<script>
  // One cart card: cover art (with placeholder fallback) + name/desc. A
  // cart without a cover (or with a broken cover image) falls back to its
  // display.bullets text card — "NAME with: <list>" on the accent colour.
  // Cover wins when both are declared.
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
    {:else if cart.bullets}
      <div class="cart-cover-text" style:background={cart.accent ?? '#0000AA'}>
        <div class="ct-name">{cart.name}</div>
        <div class="ct-with">with:</div>
        <ul class="ct-list">
          {#each cart.bullets as b}<li>{b}</li>{/each}
        </ul>
      </div>
    {:else}
      <div class="cart-cover-placeholder"><div class="ph-name">{cart.name}</div></div>
    {/if}
  </div>
</div>

<style>
  /* No frame — the boxart is the card. Hard offset shadow, same DOS
     idiom as .custom-panel. */
  .cart-card {
    background: var(--edit-white);
    box-shadow: 4px 4px 0 var(--edit-black);
    cursor: pointer;
    user-select: none;
    display: flex;
    flex-direction: column;
  }
  .cart-card:hover { background: #ddddff; }
  /* Selected: a thick green border so the choice is unmistakable, while the
     box art stays fully legible (no fill). */
  .cart-card.selected {
    outline: 3px solid #1faa1f;
    outline-offset: -2px;
  }

  .cart-cover {
    /* Boxart master ratio: all covers are 700×900 (7:9) portrait */
    aspect-ratio: 7 / 9;
    background: var(--edit-black);
    overflow: hidden;
    position: relative;
    display: flex; align-items: center; justify-content: center;
  }
  .cart-cover img {
    width: 100%; height: 100%;
    /* contain (not cover) so the whole box scan is visible, never cropped.
       Covers are near-3:4 so the letterbox bars against --edit-black are thin. */
    object-fit: contain;
    display: block;
  }
  .cart-cover-placeholder {
    width: 100%; height: 100%;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    font-family: 'WebVGA', monospace; letter-spacing: normal;
    text-align: center;
    padding: 12px;
    gap: 8px;
  }
  .cart-cover-placeholder .ph-name {
    font-size: 28px;
    line-height: 28px;
    letter-spacing: 1px;
    text-transform: uppercase;
    text-wrap: balance;
  }
  .cart-cover-placeholder .ph-sub {
    font-size: 14px;
    line-height: 14px;
    opacity: 0.75;
  }
  /* Custom card — no box art. Dashed border + muted fill, with the "Load your
     own program" prompt living inside the cover. */
  .cart-cover-custom {
    border: 2px dashed #8a8a8a;
    background: #ededed;
    color: #444;
    gap: 10px;
    padding: 16px 14px;
  }
  .cart-cover-custom .ph-glyph {
    font-size: 40px;
    line-height: 1;
    font-weight: bold;
    color: #8a8a8a;
  }
  .cart-cover-custom .ph-name {
    font-size: 17px;
    line-height: 20px;
    color: #222;
    text-transform: none;
    letter-spacing: 0;
  }
  .cart-cover-custom .ph-sub {
    font-size: 12px;
    line-height: 15px;
    color: #555;
  }

  /* Text card — a featured cart with no box art (display.bullets):
     "NAME with: <list>" in white on the cart's accent colour
     (dos-shell: near-black), set in the machine's own font. */
  .cart-cover-text {
    width: 100%; height: 100%;
    display: flex; flex-direction: column;
    padding: 12px 10px;
    gap: 6px;
    font-family: 'WebVGA', monospace;
    color: #fff;
    text-align: left;
  }
  .cart-cover-text .ct-name {
    font-size: 20px;
    line-height: 22px;
    letter-spacing: 1px;
    text-transform: uppercase;
  }
  .cart-cover-text .ct-with { font-size: 12px; line-height: 12px; opacity: 0.8; }
  .cart-cover-text .ct-list {
    list-style: none;
    margin: 0; padding: 0;
    display: flex; flex-direction: column; gap: 3px;
  }
  .cart-cover-text .ct-list li {
    font-size: 10.5px;
    line-height: 12px;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .cart-cover-text .ct-list li::before { content: '> '; opacity: 0.7; }
</style>
