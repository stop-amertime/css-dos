<script>
  // TreeView - the anatomy Tree View: one TreeAst per top-level entry
  // in `nodes` (sections, blocks, and dispatch ASTs all render through
  // the same component - see tools/extract-tree-data.mjs for the node
  // model). Chrome-less since the 2026-07-12 pane restyle: the code
  // pane in AboutFileMap provides the box, header (section name +
  // size + icon) and colour; this renders only the tree. `title`
  // feeds the aria-label.
  import TreeAst from './TreeAst.svelte';

  let { nodes, title } = $props();

  // The one-lining budget is MEASURED, not guessed: chars that fit one
  // row at this container's real width (~8px/char WebVGA + the glyph
  // gutter). The old fixed 80 was a desktop approximation - at phone
  // width it let 41-char keyboard rows "one-line" into an ugly soft-wrap
  // with an orphaned `}`. Each nesting level trims a little more.
  let width = $state(0);
  const budget = $derived(width > 0 ? Math.max(28, Math.floor((width - 56) / 8)) : 80);
</script>

<section class="tree-view" aria-label="{title} - real cabinet CSS" bind:clientWidth={width}>
  {#each nodes as node}
    <TreeAst {node} {budget} />
  {/each}
</section>

<style>
  .tree-view {
    font-size: 15px;
    line-height: 19px;
  }

  /* Prism token palette - mirrors .byte-example's (global.css) exactly.
     The tree must colour its code EVERYWHERE: since the 2026-07-11
     de-ceremony pass, hoisted panes render content with no .byte-example
     ancestor, so the palette is scoped to the tree itself. Token spans
     arrive via {@html} in TreeAst, so these targets are global. */
  .tree-view :global(.token.comment) { color: #777; }
  .tree-view :global(.token.variable) { color: var(--edit-red); }
  .tree-view :global(.token.selector) { color: var(--edit-red); }
  .tree-view :global(.token.number) { color: #006600; }
  .tree-view :global(.token.function) { color: var(--edit-blue); }
  .tree-view :global(.token.atrule) { color: #aa00aa; }
  .tree-view :global(.token.atrule .token.variable) { color: var(--edit-red); }
  .tree-view :global(.token.atrule .token.number) { color: #006600; }
  .tree-view :global(.token.string) { color: #aa5500; }

  @media (max-width: 640px) {
    .tree-view { font-size: 14px; }
  }
</style>
