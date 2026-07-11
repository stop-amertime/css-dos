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
  import { fetchChunk } from './lazy.js';

  // forceSplit: set by the PARENT when this node sits in a run of
  // same-shaped siblings where any member exceeds the line budget —
  // uniform lists wrap together (see runForcedKeys below).
  // budget: chars that fit one row, MEASURED by TreeView from the
  // container's real width; each nesting level passes down a bit less.
  let { node, forceSplit = false, budget = 80 } = $props();

  const PAGE = 20;

  let open = $state(!node.folded);
  let runShown = $state({}); // run index -> items revealed (default PAGE)

  // PROGRESSIVE DISCLOSURE: a node with `lazy: { ref, count }` has its
  // children in paged JSON chunks (see lazy.js / extract-tree-data.mjs).
  // The first page loads when the node is first opened — or on mount for
  // non-foldable lazy nodes, which only mount once an ancestor fold opened,
  // so nothing is fetched for parts of the tree the reader never visits.
  // Further pages ride the "(N more…)" button.
  let fetched = $state(null);     // loaded chunk nodes, once any page is in
  let nextPage = $state(null);    // { ref, remaining } | null
  let loadState = $state('idle'); // 'idle' | 'loading' | 'error'

  const isSection = $derived(node.kind === 'section');
  const isBlock = $derived(node.kind === 'block');
  const isNote = $derived(node.kind === 'note');
  // root: the invisible container each section skeleton exports — no line
  // of its own, children render directly (with runs/pagination/lazy).
  const isRoot = $derived(node.kind === 'root');
  const children = $derived(fetched ?? node.children ?? []);

  async function loadFirst() {
    if (!node.lazy || fetched != null || loadState === 'loading') return;
    loadState = 'loading';
    try {
      const page = await fetchChunk(node.lazy.ref);
      fetched = page.nodes;
      nextPage = page.next;
      loadState = 'idle';
    } catch {
      loadState = 'error';
    }
  }
  async function loadNext() {
    if (!nextPage || loadState === 'loading') return;
    loadState = 'loading';
    try {
      const page = await fetchChunk(nextPage.ref);
      fetched = [...fetched, ...page.nodes];
      nextPage = page.next;
      loadState = 'idle';
    } catch {
      loadState = 'error';
    }
  }
  // Non-foldable lazy nodes (an if( whose arm list was externalized) render
  // their line immediately and stream their children in on mount.
  $effect(() => {
    if (node.lazy && !node.folded) loadFirst();
  });

  const hl = (s) => Prism.highlight(s, Prism.languages.css, 'css');
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // Blocks render whole, as ONE <code> (white-space: pre-wrap shows the
  // real newlines) — splitting Prism's output per line breaks multiline
  // tokens: a "/* ... \n ... */" comment is a single span, and cutting
  // it mid-token leaves unclosed markup that strips the continuation
  // lines' styling.
  const blockMultiline = $derived(isBlock && node.code.includes('\n'));

  // One-line rule for AST nodes, generalised to SINGLE-PATH CHAINS: a node
  // whose only-child path runs straight to a leaf joins onto one line,
  // trailers included — so a whole one-liner source rule
  // ("&:has(#kb-0:active) { --keyboard: 2864; }") reads as the one line it
  // is in the file. A lazy node is never a leaf (it must mount to fetch);
  // a mid-chain comment bails (it needs its own column).
  function chainParts(n) {
    if (n == null || n.code == null) return null;
    const codes = [n.code];
    const trailers = n.trailer ? [n.trailer] : [];
    let cur = n;
    while ((cur.children ?? []).length === 1 && cur.lazy == null) {
      const k = cur.children[0];
      if (k.code == null || k.kind === 'section' || k.kind === 'note' || k.comment) return null;
      codes.push(k.code);
      if (k.trailer) trailers.push(k.trailer);
      cur = k;
    }
    if ((cur.children ?? []).length !== 0 || cur.lazy != null) return null;
    const closers = [...trailers].reverse();
    return {
      text: [...codes, ...closers].join(' '),
      rest: [...codes.slice(1), ...closers].join(' '),
    };
  }
  // Comment length doesn't count toward the budget — comments render as
  // their own right-aligned flex column, not inline after the code.
  const chain = $derived(
    (isSection || isBlock || isNote || isRoot) ? null
      : chainParts({ ...node, children })
  );
  const oneLine = $derived(
    chain != null && !forceSplit && chain.text.length <= budget
  );

  // Only tool-carved nodes fold. A carved ONE-LINE row is foldable too
  // (run uniformity: it folds to hide just its value, so a list of
  // like rows all carry the same [+] affordance). A lazy node's children
  // aren't loaded yet but it folds all the same.
  const hasContent = $derived(children.length > 0 || node.lazy != null);
  const foldable = $derived(
    node.folded != null && (isBlock ? blockMultiline : hasContent)
  );

  // A row whose only child is a leaf value that just didn't fit the
  // line budget is a WRAPPED CONTINUATION, not a deeper structural
  // level — it renders indented but without the tint step or the
  // dashed guide (those mean "you've descended into nesting"). The
  // continuation line soft-wraps within its own code box, so its own
  // wrap aligns under its own first character. (Deeper chains that miss
  // the budget just render as normal nesting.)
  const isContinuation = $derived(
    chain != null && !oneLine
    && children.length === 1 && (children[0].children ?? []).length === 0
  );

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
      ? `<span class="ast-depth">${hl(chain.rest)}</span>`
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

  // RUN UNIFORMITY (wrap): within a run, rows sharing a code shape (text
  // with numbers masked — "style(--opcode: #):" / "--mc#:") wrap
  // together: if any same-shaped sibling exceeds the line budget, they
  // all split. No per-row layout lottery in a list of like rows.
  const maskKey = (n) =>
    (n.kind === 'branch' || n.kind === 'decl')
      ? (n.code ?? '').replace(/\d+/g, '#') : null;
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
      const overBudget = members.some((m) => {
        const c = chainParts(m);
        return c != null && c.text.length > budget;
      });
      if (overBudget) forced.add(k);
    }
    return forced;
  }));

  function toggle() {
    if (!foldable) return;
    open = !open;
    if (open) loadFirst();
  }

  // "(N more…)": reveals another display page; when the loaded items run
  // short and more pages exist on the wire, pull the next chunk first. The
  // shown count always includes what's still on the server, so totals are
  // honest before anything downloads.
  async function more(i, run) {
    const target = shownFor(i) + PAGE;
    if (run.items.length < target && nextPage) await loadNext();
    runShown[i] = target;
  }
  function retry() {
    loadState = 'idle';
    if (fetched == null) loadFirst();
    else loadNext();
  }
</script>

{#snippet childList()}
  {#each runs as run, i}
    {#if run.comment}
      <TreeAst node={run.comment} budget={budget - 2} />
    {/if}
    {#each run.items.slice(0, shownFor(i)) as child}
      <TreeAst node={child} forceSplit={runForcedKeys[i].has(maskKey(child))} budget={budget - 2} />
    {/each}
    {@const netMore = i === runs.length - 1 && nextPage ? nextPage.remaining : 0}
    {@const hidden = run.items.length - shownFor(i) + netMore}
    {#if hidden > 0 && loadState !== 'error'}
      <div class="tree-more">
        <button onclick={() => more(i, run)}>({hidden.toLocaleString('en-US')} more&hellip;)</button>
      </div>
    {/if}
  {/each}
  {#if loadState === 'loading' && runs.length === 0}
    <pre class="ast-line"><span class="tree-glyph" aria-hidden="true"></span><code class="ast-note">loading&hellip;</code></pre>
  {:else if loadState === 'error'}
    <div class="tree-more">
      <button onclick={retry}>failed to load &mdash; retry</button>
    </div>
  {/if}
{/snippet}

{#if isRoot}
  {@render childList()}
{:else if isNote}
  <pre class="ast-line"><span class="tree-glyph" aria-hidden="true"></span><code class="ast-note">{node.text}</code></pre>
{:else if isSection}
  <div class="ast-line is-section" class:is-foldable={foldable}
       role={foldable ? 'button' : undefined} tabindex={foldable ? 0 : undefined}
       onclick={toggle} onkeydown={(e) => e.key === 'Enter' && toggle()}>
    <span class="tree-glyph" class:is-open={open} aria-hidden="true">{foldable ? (open ? '-' : '+') : ''}</span>
    <span class="tree-label-group">{node.label}</span>
  </div>
  {#if open && (runs.length > 0 || loadState !== 'idle')}
    <div class="ast-children" class:byte-example={node.boxed} class:tree-ast={node.boxed}>
      {@render childList()}
    </div>
  {/if}
{:else}
  <pre class="ast-line" class:is-foldable={foldable}
       role={foldable ? 'button' : undefined} tabindex={foldable ? 0 : undefined}
       onclick={toggle} onkeydown={(e) => e.key === 'Enter' && toggle()}><span class="tree-glyph" class:is-open={open} aria-hidden="true">{foldable ? (open ? '-' : '+') : ''}</span><code class:ast-cond={valueHtml != null}>{@html lineHtml}</code>{#if valueHtml}<code class="ast-val">{@html valueHtml}</code>{/if}{#if commentHtml}<code class="ast-comment">{@html commentHtml}</code>{/if}</pre>

  {#if !isBlock && open && (runs.length > 0 || loadState !== 'idle')}
    <div class={isContinuation ? 'ast-continuation' : 'ast-children'}>
      {@render childList()}
    </div>
  {/if}

  {#if !isBlock && open && node.trailer && !oneLine}
    <pre class="ast-line"><span class="tree-glyph" aria-hidden="true"></span><code>{@html hl(node.trailer)}</code></pre>
  {/if}
{/if}
