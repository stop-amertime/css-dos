<script>
  // TreeView — the root of the anatomy Tree View: a compact header (a
  // code-file icon, the section's title, and the real measured size of
  // the code block it shows) over one TreeAst per top-level entry in
  // `nodes` (sections, blocks, and dispatch ASTs all render through the
  // same component — see tools/extract-tree-data.mjs for the node
  // model). Sits above the existing prose in a section pane (see
  // SectionCpu.svelte).
  import '../../../styles/_fragments/tree-view.css';
  import TreeAst from './TreeAst.svelte';
  import IconCodeFile from '~icons/pixelarticons/script-text';

  let { nodes, title, bytes = null } = $props();

  const kb = $derived(bytes != null ? `${Math.round(bytes / 1000)} KB` : null);
</script>

<section class="tree-view" aria-label="{title} — real cabinet CSS">
  <div class="tree-view-head">
    <IconCodeFile class="tree-view-icon" aria-hidden="true" />
    <span class="tree-view-title">{title}</span>
    {#if kb}<span class="tree-view-kb">{kb}</span>{/if}
  </div>
  {#each nodes as node}
    <TreeAst {node} />
  {/each}
</section>
