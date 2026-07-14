<script>
  // The constrained wizard window: a flex column capped to the viewport.
  // Three bands - a pinned header (main step strip + optional substep dots
  // with a separator), a single scrolling body, and a pinned footer (nav).
  // Only the body scrolls; the tabs and Back/Next stay put.
  let { strip, subhead, children, nav } = $props();
</script>

<div class="window wizard">
  <div class="wiz-head">
    {@render strip()}
    {#if subhead}
      <div class="wiz-subhead">
        {@render subhead()}
      </div>
    {/if}
  </div>

  <div class="wiz-scroll">
    <div class="window-body">
      {@render children()}
    </div>
  </div>

  {@render nav()}
</div>
