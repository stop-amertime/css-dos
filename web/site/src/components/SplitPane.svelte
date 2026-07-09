<script>
  // SplitPane — reusable two-pane layout for widgets: typically code on
  // the left, a visual on the right. Collapses to a single column on
  // narrow screens (split-pane.css). Pure layout: no box chrome, so it
  // nests inside the house widget boxes.
  let { left, right } = $props();
</script>

<div class="split-pane-host">
  <div class="split-pane">
    <div class="split-pane-left">{@render left()}</div>
    <div class="split-pane-right">{@render right()}</div>
  </div>
</div>

<style>
  .split-pane-host { container-type: inline-size; }

  .split-pane {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    align-items: center;
  }
  .split-pane-left { border-right: 1px solid var(--edit-black); align-self: stretch; }
  .split-pane-left, .split-pane-right { min-width: 0; }

  @container (max-width: 560px) {
    .split-pane { grid-template-columns: minmax(0, 1fr); }
    .split-pane-left {
      border-right: none;
      border-bottom: 1px solid var(--edit-black);
    }
  }
</style>
