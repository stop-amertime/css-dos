<script>
  // SplitPane — reusable two-pane layout for widgets: typically code on
  // the left, a visual on the right. Collapses to a single column on
  // narrow screens (split-pane.css). Pure layout: no box chrome, so it
  // nests inside the house widget boxes.
  import '../styles/_fragments/split-pane.css';
  let { left, right } = $props();
</script>

<div class="split-pane-host">
  <div class="split-pane">
    <div class="split-pane-left">{@render left()}</div>
    <div class="split-pane-right">{@render right()}</div>
  </div>
</div>
