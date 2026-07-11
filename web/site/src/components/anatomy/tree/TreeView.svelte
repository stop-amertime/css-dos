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

  // No title prop: the pane heading above already names the section, so
  // the tree header is a constant strip — icon, "the real CSS", measured
  // size — rather than a duplicate title (owner feedback 2026-07-11).
  let { nodes, title = 'the real CSS', bytes = null, note = null } = $props();

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
  {#if note}<div class="tree-view-note">{note}</div>{/if}
  {#each nodes as node}
    <TreeAst {node} {budget} />
  {/each}
</section>
