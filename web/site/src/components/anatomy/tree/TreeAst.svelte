<script>
  // TreeAst — the ONE renderer for every node of the anatomy Tree View
  // (see tools/extract-tree-data.mjs for the node model):
  //   section  editorial label row, [+]/[-] folds its children; with
  //            `boxed: true` its children render inside one tinted
  //            .byte-example pane (one box per file region, not one per
  //            exhibit).
  //   block    verbatim code chunk (a one-line declaration, a banner
  //            comment, an @property/@function body); folds to its first
  //            line when carved.
  //   decl/if/branch/value  the real dispatch AST, rendered as indented
  //            Prism-highlighted code whose indentation IS the tree.
  // Collapsing happens ONLY at nodes the extraction tool carved with a
  // `folded` flag — every other node is plain, always-visible code with
  // no toggle. `folded: true` = starts collapsed; the flag's presence is
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
  //   - code lines are <pre> elements: the wizard's inline-code white
  //     chip rule (global.css `.window.wizard :not(pre) > code`) is
  //     designed to skip code inside a <pre>.
  import Prism from '../../../lib/prism.js';
  import TreeAst from './TreeAst.svelte'; // self-import: Svelte 5 deprecates <svelte:self>

  // forceSplit: set by the PARENT when this node sits in a run of
  // same-shaped siblings where any member exceeds the line budget —
  // uniform lists wrap together (see runForcedKeys below).
  let { node, forceSplit = false } = $props();

  const PAGE = 20;
  // ~chars that fit one line of WebVGA 14px in the tree column before
  // wrapping. An approximation (depth eats width) — tune by eye.
  const LINE_BUDGET = 80;

  let open = $state(!node.folded);
  let runShown = $state({}); // run index -> items revealed (default PAGE)

  const isSection = $derived(node.kind === 'section');
  const isBlock = $derived(node.kind === 'block');
  const children = $derived(node.children ?? []);

  const hl = (s) => Prism.highlight(s, Prism.languages.css, 'css');
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // Blocks render whole, as ONE <code> (white-space: pre-wrap shows the
  // real newlines) — splitting Prism's output per line breaks multiline
  // tokens: a "/* ... \n ... */" comment is a single span, and cutting
  // it mid-token leaves unclosed markup that strips the continuation
  // lines' styling.
  const blockMultiline = $derived(isBlock && node.code.includes('\n'));

  // One-line rule for AST nodes.
  const onlyChild = $derived(children.length === 1 ? children[0] : null);
  const onlyChildIsLeaf = $derived(
    onlyChild != null && onlyChild.code != null && (onlyChild.children ?? []).length === 0
  );
  // Comment length doesn't count toward the budget — comments render as
  // their own right-aligned flex column now, not inline after the code.
  const joinedLen = $derived(!onlyChildIsLeaf ? Infinity
    : (node.code ?? '').length + 1 + onlyChild.code.length);
  const oneLine = $derived(
    !isSection && !isBlock && onlyChildIsLeaf && !forceSplit && joinedLen <= LINE_BUDGET
  );

  // Only tool-carved nodes fold. A carved ONE-LINE row is foldable too
  // (run uniformity: it folds to hide just its value, so a list of
  // like rows all carry the same [+] affordance).
  const foldable = $derived(
    node.folded != null && (
      isSection ? children.length > 0
      : isBlock ? blockMultiline
      : children.length > 0
    )
  );

  // A branch whose only child is a leaf value that just didn't fit the
  // line budget is a WRAPPED CONTINUATION, not a deeper structural
  // level — it renders indented but without the tint step or the
  // dashed guide (those mean "you've descended into nesting"). The
  // continuation line soft-wraps within its own code box, so its own
  // wrap aligns under its own first character.
  const isContinuation = $derived(!isSection && !isBlock && onlyChildIsLeaf && !oneLine);

  // The node's own visual line: its own token, dim ellipsis when
  // folded. A one-lined child value renders in its OWN flex box
  // (valueHtml) — so if the browser soft-wraps it, the continuation
  // aligns to the VALUE's start (end of the condition), not the row
  // start, at any viewport width. The trailing comment is its own
  // non-shrinkable flex item at the line's right edge.
  const lineHtml = $derived.by(() => {
    if (isSection) return null;
    if (isBlock) {
      if (open) return hl(node.code);
      // Folded preview: first line only. A comment fragment won't
      // re-tokenize in isolation (unterminated /*), so wrap it manually.
      const first = node.code.split('\n')[0];
      const preview = node.code.startsWith('/*')
        ? `<span class="token comment">${esc(first)}</span>`
        : hl(first);
      return `${preview}<span class="ast-ellipsis"> …</span>`;
    }
    let h = hl(node.code ?? '');
    if (foldable && !open) h += '<span class="ast-ellipsis"> …</span>';
    return h;
  });
  // A value is structurally one level deeper than its condition. When it
  // SHARES the line it shows that as an .ast-depth chip; on its own line
  // the .ast-continuation container carries the same tint step instead —
  // never both (that double-highlighted split values). Hidden while a
  // carved one-line row is folded.
  const valueHtml = $derived(
    oneLine && (!foldable || open)
      ? `<span class="ast-depth">${hl(onlyChild.code)}</span>`
      : null
  );
  const commentHtml = $derived(
    !isSection && !isBlock && node.comment ? hl(node.comment) : null
  );

  // Children render in RUNS delimited by standalone comment nodes: the
  // comment is always visible and each run paginates independently — so
  // a comment Kiln plants at a type boundary in a long list (or before a
  // lone interesting node at the end of 500 twins) can never drown
  // behind a single flat "(N more…)".
  const runs = $derived.by(() => {
    if (oneLine) return [];
    const out = [];
    let cur = { comment: null, items: [] };
    for (const c of children) {
      if (c.kind === 'block' && (c.code ?? '').startsWith('/*')) {
        if (cur.comment || cur.items.length) out.push(cur);
        cur = { comment: c, items: [] };
      } else {
        cur.items.push(c);
      }
    }
    if (cur.comment || cur.items.length) out.push(cur);
    return out;
  });
  const shownFor = (i) => runShown[i] ?? PAGE;

  // RUN UNIFORMITY (wrap): within a run, branches sharing a condition
  // shape (condition text with numbers masked — "style(--opcode: #):")
  // wrap together: if any same-shaped sibling exceeds the line budget,
  // they all split. No per-row layout lottery in a list of like rows.
  const maskKey = (n) =>
    n.kind === 'branch' ? (n.code ?? '').replace(/\d+/g, '#') : null;
  const isLeafBranch = (n) =>
    n.kind === 'branch' && (n.children ?? []).length === 1
    && n.children[0].code != null && (n.children[0].children ?? []).length === 0;
  const runForcedKeys = $derived(runs.map((run) => {
    const groups = new Map();
    for (const m of run.items) {
      const k = maskKey(m);
      if (!k) continue;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(m);
    }
    const forced = new Set();
    for (const [k, members] of groups) {
      if (members.length < 2) continue;
      const overBudget = members.some((m) =>
        isLeafBranch(m) && m.code.length + 1 + m.children[0].code.length > LINE_BUDGET);
      if (overBudget) forced.add(k);
    }
    return forced;
  }));

  function toggle() { if (foldable) open = !open; }
</script>

{#snippet childList()}
  {#each runs as run, i}
    {#if run.comment}
      <TreeAst node={run.comment} />
    {/if}
    {#each run.items.slice(0, shownFor(i)) as child}
      <TreeAst node={child} forceSplit={runForcedKeys[i].has(maskKey(child))} />
    {/each}
    {#if run.items.length > shownFor(i)}
      <div class="tree-more">
        <button onclick={() => (runShown[i] = shownFor(i) + PAGE)}>({run.items.length - shownFor(i)} more&hellip;)</button>
      </div>
    {/if}
  {/each}
{/snippet}

{#if isSection}
  <div class="ast-line is-section" class:is-foldable={foldable}
       role={foldable ? 'button' : undefined} tabindex={foldable ? 0 : undefined}
       onclick={toggle} onkeydown={(e) => e.key === 'Enter' && toggle()}>
    <span class="tree-glyph" class:is-open={open} aria-hidden="true">{foldable ? (open ? '-' : '+') : ''}</span>
    <span class="tree-label-group">{node.label}</span>
  </div>
  {#if open && runs.length > 0}
    <div class="ast-children" class:byte-example={node.boxed} class:tree-ast={node.boxed}>
      {@render childList()}
    </div>
  {/if}
{:else}
  <pre class="ast-line" class:is-foldable={foldable}
       role={foldable ? 'button' : undefined} tabindex={foldable ? 0 : undefined}
       onclick={toggle} onkeydown={(e) => e.key === 'Enter' && toggle()}><span class="tree-glyph" class:is-open={open} aria-hidden="true">{foldable ? (open ? '-' : '+') : ''}</span><code class:ast-cond={valueHtml != null}>{@html lineHtml}</code>{#if valueHtml}<code class="ast-val">{@html valueHtml}</code>{/if}{#if commentHtml}<code class="ast-comment">{@html commentHtml}</code>{/if}</pre>

  {#if !isBlock && open && runs.length > 0}
    <div class={isContinuation ? 'ast-continuation' : 'ast-children'}>
      {@render childList()}
    </div>
  {/if}

  {#if !isBlock && open && node.trailer}
    <pre class="ast-line"><span class="tree-glyph" aria-hidden="true"></span><code>{@html hl(node.trailer)}</code></pre>
  {/if}
{/if}
