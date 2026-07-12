<script>
  // Ruled section heading for the About pages (h3 over a full-width
  // underline). `tight` trims the top gap for a head that follows the
  // page's intro paragraph directly.
  let { tight = false, children } = $props();
</script>

<h3 class="section-head" class:tight>{@render children()}</h3>

<style>
  .section-head {
    margin: 40px 0 12px;
    font-size: 20px;
    line-height: 20px;
    letter-spacing: normal;
    color: var(--edit-black);
    border-bottom: 1px solid var(--edit-black);
    padding-bottom: 6px;
  }
  .tight { margin-top: 22px; }
</style>
