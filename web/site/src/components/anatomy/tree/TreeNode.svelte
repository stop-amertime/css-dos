<script>
  // TreeNode — one row of the anatomy Tree View, recursive. Two
  // flavours: `type: 'group'` (editorial, no code, folder [+]/[-]) and
  // `type: 'code'` (real cabinet CSS, classify()'d for its glyph/colour,
  // rendered via CodeCss when expanded). Children paginate at 20 per
  // level via a "(N more…)" row that appends the next 20 in place — see
  // docs/plans/2026-07-10-anatomy-tree-view.md "Pagination".
  import { classify } from './classify.js';
  import { KIND_STYLE } from './kind-style.js';
  import CodeCss from '../../CodeCss.svelte';
  import TreeNode from './TreeNode.svelte'; // self-import: Svelte 5 deprecates <svelte:self>

  let { node, depth = 0 } = $props();

  const PAGE = 20;
  let open = $state(false);
  let shown = $state(PAGE);

  const isGroup = $derived(node.type === 'group');
  const meta = $derived(isGroup ? null : classify(node.code));
  const kindStyle = $derived(meta ? KIND_STYLE[meta.kind] : null);
  const hasChildren = $derived(Array.isArray(node.children) && node.children.length > 0);
  const isLeaf = $derived(!hasChildren && !isGroup);
  const visibleChildren = $derived(hasChildren ? node.children.slice(0, shown) : []);
  const remaining = $derived(hasChildren ? node.children.length - shown : 0);

  function toggle() {
    if (isLeaf) return; // leaf code nodes show their code inline, no fold
    open = !open;
  }
</script>

<div class="tree-node" class:is-leaf={isLeaf}>
  <div class="tree-row" role="button" tabindex="0"
       onclick={toggle} onkeydown={(e) => e.key === 'Enter' && toggle()}>
    <span class="tree-glyph" aria-hidden="true">{isLeaf ? '' : (open ? '[-]' : '[+]')}</span>
    {#if isGroup}
      <span class="tree-label-group">{node.label}</span>
    {:else}
      <span class="tree-kind-chip" style="background:{kindStyle.colour}">{kindStyle.glyph}</span>
      <span class="tree-label-code">{meta.label}</span>
    {/if}
  </div>

  {#if !isGroup && (open || isLeaf)}
    <CodeCss code={node.code} />
  {/if}

  {#if hasChildren && open}
    <div class="tree-children">
      {#each visibleChildren as child}
        <TreeNode node={child} depth={depth + 1} />
      {/each}
    </div>
    {#if remaining > 0}
      <div class="tree-more">
        <button onclick={() => (shown += PAGE)}>({remaining} more&hellip;)</button>
      </div>
    {/if}
  {/if}
</div>
