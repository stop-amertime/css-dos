<script>
  // TreeView — the root of the anatomy Tree View: a labelled panel
  // containing one TreeNode per top-level entry in `nodes`. Sits above
  // the existing prose in a section pane (see SectionCpu.svelte) — see
  // docs/plans/2026-07-10-anatomy-tree-view.md "Data & placement".
  import '../../../styles/_fragments/tree-view.css';
  import TreeNode from './TreeNode.svelte';

  let { nodes, label = 'Tree view: real cabinet CSS' } = $props();
</script>

<section class="tree-view" aria-label={label}>
  <h3 class="anatomy-head">{label}</h3>
  {#each nodes as node}
    <TreeNode {node} depth={0} />
  {/each}
</section>
