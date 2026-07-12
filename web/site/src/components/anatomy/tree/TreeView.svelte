<script>
  // TreeView — the root of the anatomy Tree View: a compact header (a
  // code-file icon, the section's title, and the real measured size of
  // the code block it shows) over one TreeAst per top-level entry in
  // `nodes` (sections, blocks, and dispatch ASTs all render through the
  // same component — see tools/extract-tree-data.mjs for the node
  // model). Sits above the existing prose in a section pane (see
  // SectionCpu.svelte).
  import TreeAst from './TreeAst.svelte';
  import IconCodeFile from '~icons/pixelarticons/script-text';

  let { nodes, title, bytes = null } = $props();

  // The one-lining budget is MEASURED, not guessed: chars that fit one
  // row at this container's real width (~8px/char WebVGA + the glyph
  // gutter). The old fixed 80 was a desktop approximation — at phone
  // width it let 41-char keyboard rows "one-line" into an ugly soft-wrap
  // with an orphaned `}`. Each nesting level trims a little more.
  let width = $state(0);
  const budget = $derived(width > 0 ? Math.max(28, Math.floor((width - 56) / 8)) : 80);

  const kb = $derived.by(() => {
    if (bytes == null) return null;
    if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
    if (bytes < 10_000) return `${(bytes / 1000).toFixed(1)} KB`;
    return `${Math.round(bytes / 1000)} KB`;
  });
</script>

<section class="tree-view" aria-label="{title} — real cabinet CSS" bind:clientWidth={width}>
  <div class="tree-view-head">
    <IconCodeFile class="tree-view-icon" aria-hidden="true" />
    <span class="tree-view-title">{title}</span>
    {#if kb}<span class="tree-view-kb">{kb}</span>{/if}
  </div>
  {#each nodes as node}
    <TreeAst {node} {budget} />
  {/each}
</section>

<style>
  .tree-view {
    margin: 12px 0 20px;
    border: 1px solid var(--edit-black);
    background: var(--edit-white);
    box-shadow: 4px 4px 0 var(--edit-black);
    padding: 10px 12px;
    font-size: 15px;
    line-height: 19px;
  }

  /* Compact header: code-file icon, section title, and the real measured
     size of the code block shown — "[icon] CPU · 265 KB". Deliberately
     NOT .anatomy-head (whose 40px top margin + underline read as a big
     empty band here). */
  .tree-view-head {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0 0 8px;
  }
  .tree-view :global(.tree-view-icon) { width: 18px; height: 18px; color: var(--edit-blue); flex: none; }
  .tree-view-title {
    font-weight: bold;
    font-size: 17px;
    color: var(--edit-black);
  }
  .tree-view-kb { color: #666; font-size: 14px; }

  /* Prism token palette — mirrors .byte-example's (global.css) exactly.
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
    .tree-view { padding: 8px; font-size: 14px; }
  }
</style>
