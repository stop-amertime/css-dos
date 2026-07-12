<script>
  // Problem heading as a DOS error dialog — double border, red tag chip,
  // dithered TUI drop-shadow (text-mode dialogs shadowed the cells under
  // them with a ▒ halftone, not a solid slab).
  let { tag, children } = $props();
</script>

<div class="problem-box">
  <span class="problem-tag">{tag}</span>
  <h3>{@render children()}</h3>
</div>

<style>
  .problem-box {
    position: relative;
    border: 6px double var(--edit-black);
    background: var(--edit-gray);
    padding: 16px 16px 10px;
    margin: 32px 8px 14px 0;
    text-align: center;
  }
  /* The ▒ shadow: an ::after offset one cell right+down, behind the
     box's own fill. */
  .problem-box::after {
    content: '';
    position: absolute;
    inset: 8px -8px -8px 8px;
    z-index: -1;
    background: var(--dither-dark) 0 0 / 4px 4px;
  }
  .problem-box h3 { margin: 0; font-size: 20px; line-height: 20px; }
  .problem-tag {
    position: absolute;
    top: -8px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--edit-red);
    color: var(--edit-white);
    padding: 0 8px;
    white-space: nowrap;
  }
</style>
