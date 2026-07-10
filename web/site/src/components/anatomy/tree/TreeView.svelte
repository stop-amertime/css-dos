<script>
  // TreeView — the root of the anatomy Tree View: a labelled panel
  // containing one TreeAst per top-level entry in `nodes` (sections,
  // blocks, and dispatch ASTs all render through the same component —
  // see tools/extract-tree-data.mjs for the node model). Sits above the
  // existing prose in a section pane (see SectionCpu.svelte).
  import '../../../styles/_fragments/tree-view.css';
  import TreeAst from './TreeAst.svelte';
  import IconTree from '~icons/pixelarticons/tree';

  let { nodes, label = 'Tree view: real cabinet CSS' } = $props();
</script>

<section class="tree-view" aria-label={label}>
  <h3 class="anatomy-head tree-view-head">
    <IconTree class="tree-view-icon" aria-hidden="true" />
    <span class="sr-only">{label}</span>
  </h3>
  {#each nodes as node}
    <TreeAst {node} />
  {/each}
</section>
