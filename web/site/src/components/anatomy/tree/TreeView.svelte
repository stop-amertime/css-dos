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

  let { nodes, title, bytes = null, note = null } = $props();

  const kb = $derived.by(() => {
    if (bytes == null) return null;
    if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
    return `${Math.round(bytes / 1000)} KB`;
  });
</script>

<section class="tree-view" aria-label="{title} — real cabinet CSS">
  <div class="tree-view-head">
    <IconCodeFile class="tree-view-icon" aria-hidden="true" />
    <span class="tree-view-title">{title}</span>
    {#if kb}<span class="tree-view-kb">{kb}</span>{/if}
  </div>
  {#if note}<div class="tree-view-note">{note}</div>{/if}
  {#each nodes as node}
    <TreeAst {node} />
  {/each}
</section>
