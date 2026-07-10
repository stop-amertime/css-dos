<script>
  // TreeAst — the ONE renderer for every node of the anatomy Tree View
  // (see tools/extract-tree-data.mjs for the node model):
  //   section  editorial label row, [+]/[-] folds its children.
  //   block    verbatim multi-line code exhibit; folds to its first line.
  //   decl/if/branch/value  the real dispatch AST, rendered as indented
  //            Prism-highlighted code whose indentation IS the tree.
  // Collapsing happens ONLY at nodes the extraction tool carved with a
  // `folded` flag (sections, register decls, @property blocks, opcode
  // rows) — every other node is plain, always-visible code with no
  // toggle. `folded: true` = starts collapsed; the flag's presence is
  // what makes a node togglable at all.
  //
  // Display rules (display logic only — the data stays fully decomposed):
  //   - a branch whose only child is a leaf value renders on one line
  //     ("style(--_tf: 1): var(--__1AX);") IF the joined line fits the
  //     line budget; past that it splits at the child boundary instead,
  //     because a clean two-line split reads better than a mid-expression
  //     wrap.
  //   - a folded node shows its own token, a dim "…", then its comment
  //     (the comment is the row's description — it stays visible).
  //   - an if's real closing text (trailer) prints back at its own indent.
  import Prism from '../../../lib/prism.js';
  import TreeAst from './TreeAst.svelte'; // self-import: Svelte 5 deprecates <svelte:self>

  let { node } = $props();

  const PAGE = 20;
  // ~chars that fit one line of WebVGA 14px in the tree column before
  // wrapping. An approximation (depth eats width) — tune by eye.
  const LINE_BUDGET = 80;

  let open = $state(!node.folded);
  let shown = $state(PAGE);

  const isSection = $derived(node.kind === 'section');
  const isBlock = $derived(node.kind === 'block');
  const children = $derived(node.children ?? []);

  const hl = (s) => Prism.highlight(s, Prism.languages.css, 'css');

  // Blocks: highlight whole, split on '\n' (Prism never breaks a token
  // across a source newline — verified for the CSS grammar).
  const blockLines = $derived(isBlock ? hl(node.code).split('\n') : []);
  const blockFoldable = $derived(isBlock && blockLines.length > 1);

  // One-line rule for AST nodes.
  const onlyChild = $derived(children.length === 1 ? children[0] : null);
  const onlyChildIsLeaf = $derived(
    onlyChild != null && onlyChild.code != null && (onlyChild.children ?? []).length === 0
  );
  const joinedLen = $derived(!onlyChildIsLeaf ? Infinity
    : (node.code ?? '').length + 1 + onlyChild.code.length
      + (node.comment ? node.comment.length + 1 : 0));
  const oneLine = $derived(!isSection && !isBlock && onlyChildIsLeaf && joinedLen <= LINE_BUDGET);

  // Only tool-carved nodes fold — and only if they really hide something.
  const foldable = $derived(
    node.folded != null && (
      isSection ? children.length > 0
      : isBlock ? blockFoldable
      : !oneLine && children.length > 0
    )
  );

  // The node's own visual line, as one trusted HTML string: code
  // (+ one-lined child), dim ellipsis when folded, comment last.
  const lineHtml = $derived.by(() => {
    if (isSection) return null;
    if (isBlock) {
      return open && blockFoldable
        ? blockLines[0]
        : hl(node.code.split('\n')[0]) + (blockFoldable ? '<span class="ast-ellipsis"> …</span>' : '');
    }
    let h = hl((node.code ?? '') + (oneLine ? ` ${onlyChild.code}` : ''));
    if (foldable && !open) h += '<span class="ast-ellipsis"> …</span>';
    if (node.comment) h += hl(` ${node.comment}`);
    return h;
  });

  const visible = $derived(oneLine ? [] : children.slice(0, shown));
  const remaining = $derived(oneLine ? 0 : Math.max(0, children.length - shown));

  function toggle() { if (foldable) open = !open; }
</script>

{#snippet body()}
  {#if isSection}
    <div class="ast-line is-section" class:is-foldable={foldable}
         role={foldable ? 'button' : undefined} tabindex={foldable ? 0 : undefined}
         onclick={toggle} onkeydown={(e) => e.key === 'Enter' && toggle()}>
      <span class="tree-glyph" aria-hidden="true">{foldable ? (open ? '[-]' : '[+]') : ''}</span>
      <span class="tree-label-group">{node.label}</span>
    </div>
  {:else}
    <div class="ast-line" class:is-foldable={foldable}
         role={foldable ? 'button' : undefined} tabindex={foldable ? 0 : undefined}
         onclick={toggle} onkeydown={(e) => e.key === 'Enter' && toggle()}>
      <span class="tree-glyph" aria-hidden="true">{foldable ? (open ? '[-]' : '[+]') : ''}</span>
      <code>{@html lineHtml}</code>
    </div>
  {/if}

  {#if isBlock && open && blockFoldable}
    {#each blockLines.slice(1) as line}
      <div class="ast-line">
        <span class="tree-glyph" aria-hidden="true"></span>
        <code>{@html line}</code>
      </div>
    {/each}
  {/if}

  {#if !isBlock && open && visible.length > 0}
    <div class="ast-children">
      {#each visible as child}
        <TreeAst node={child} />
      {/each}
      {#if remaining > 0}
        <div class="tree-more">
          <button onclick={() => (shown += PAGE)}>({remaining} more&hellip;)</button>
        </div>
      {/if}
    </div>
  {/if}

  {#if !isBlock && open && node.trailer}
    <div class="ast-line">
      <span class="tree-glyph" aria-hidden="true"></span>
      <code>{@html hl(node.trailer)}</code>
    </div>
  {/if}
{/snippet}

{#if node.kind === 'decl' || isBlock}
  <div class="byte-example tree-ast">{@render body()}</div>
{:else}
  {@render body()}
{/if}
