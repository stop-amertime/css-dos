<script>
  // TreeAst - the ONE renderer for every node of the anatomy Tree View
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
  // `folded` flag - every other node is plain, always-visible code with
  // no toggle. `folded: true` = starts collapsed; the flag's presence is
  // what makes a node togglable at all.
  //
  // Display rules (display logic only - the data stays fully decomposed):
  //   - a branch whose only child is a leaf value renders on one line
  //     ("style(--_tf: 1): var(--__1AX);") IF the joined line fits the
  //     line budget; past that it splits at the child boundary instead,
  //     because a clean two-line split reads better than a mid-expression
  //     wrap.
  //   - a folded node shows its own token, a dim "…", then its comment
  //     (the comment is the row's description - it stays visible).
  //   - an if's real closing text (trailer) prints back at its own indent.
  //   - code lines are <pre> elements: the wizard's inline-code white
  //     chip rule (global.css `.window.wizard :not(pre) > code`) is
  //     designed to skip code inside a <pre>.
  import Prism from '../../../lib/prism.js';
  import TreeAst from './TreeAst.svelte'; // self-import: Svelte 5 deprecates <svelte:self>
  import { fetchChunk, expandRun } from './lazy.js';
  import DosSpinner from '../../DosSpinner.svelte';

  // forceSplit: set by the PARENT when this node sits in a run of
  // same-shaped siblings where any member exceeds the line budget -
  // uniform lists wrap together (see runForcedKeys below).
  // budget: chars that fit one row, MEASURED by TreeView from the
  // container's real width; each nesting level passes down a bit less.
  // rowLimit: for `run` nodes only - how many rows the PARENT's weighted
  // page cursor allots this run. The parent owns the "(N more…)" button;
  // a run given a rowLimit never draws its own.
  let { node, forceSplit = false, budget = 80, rowLimit = null } = $props();

  const PAGE = 20;

  let open = $state(!node.folded);
  // PER-RUN reveal cursors: every comment-delimited run paginates
  // independently - a Kiln comment is a page break, so a run's first rows
  // are always on show and can never drown behind an earlier run's
  // "(N more…)" (owner 2026-07-12; this restores the round-2 behaviour the
  // 07-11 shared cursor replaced, which clumped every later run's comment
  // landmark above one global button). Buttons still can't stack: a run
  // shows at least its first page before its button, and the next run
  // opens with its comment line, so two buttons are never adjacent.
  let runCursors = $state({});
  const cursorOf = (i) => runCursors[i] ?? PAGE;

  // PROGRESSIVE DISCLOSURE: a node with `lazy: { ref, count }` has its
  // children in paged JSON chunks (see lazy.js / extract-tree-data.mjs).
  // The first page loads when the node is first opened - or on mount for
  // non-foldable lazy nodes, which only mount once an ancestor fold opened,
  // so nothing is fetched for parts of the tree the reader never visits.
  // Further pages ride the "(N more…)" button.
  let fetched = $state(null);     // loaded chunk nodes, once any page is in
  let nextPage = $state(null);    // { ref, remaining } | null
  let loadState = $state('idle'); // 'idle' | 'loading' | 'error'

  const isSection = $derived(node.kind === 'section');
  const isBlock = $derived(node.kind === 'block');
  const isNote = $derived(node.kind === 'note');
  // root: the invisible container each section skeleton exports - no line
  // of its own, children render directly (with runs/pagination/lazy).
  const isRoot = $derived(node.kind === 'root');
  // run: a losslessly compressed uniform stretch (template + columns; see
  // lazy.js expandRun). Rows materialize on demand; the count is the real
  // row count, so pagination reaches every row without truncation.
  const isRun = $derived(node.kind === 'run');
  let runShownCount = $state(PAGE); // fallback pager when no rowLimit came down
  const runLimit = $derived(rowLimit ?? runShownCount);
  const runRows = $derived(
    isRun
      ? Array.from({ length: Math.min(runLimit, node.count) }, (_, i) => expandRun(node, i))
      : []
  );
  // Rows in a run are same-shaped by construction: measure row 0 once and
  // wrap them all together (run uniformity).
  const runRowsForced = $derived.by(() => {
    if (!isRun || node.count === 0) return false;
    const c = chainParts(expandRun(node, 0));
    return c != null && c.text.length > budget;
  });
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
  // real newlines) - splitting Prism's output per line breaks multiline
  // tokens: a "/* ... \n ... */" comment is a single span, and cutting
  // it mid-token leaves unclosed markup that strips the continuation
  // lines' styling.
  const blockMultiline = $derived(isBlock && node.code.includes('\n'));

  // One-line rule for AST nodes, generalised to SINGLE-PATH CHAINS: a node
  // whose only-child path runs straight to a leaf joins onto one line,
  // trailers included - so a whole one-liner source rule
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
  // Comment length doesn't count toward the budget - comments render as
  // their own right-aligned flex column, not inline after the code.
  const chain = $derived(
    (isSection || isBlock || isNote || isRoot || isRun) ? null
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
  // level - it renders indented but without the tint step or the
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
  // (valueHtml) - so if the browser soft-wraps it, the continuation
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
  // the .ast-continuation container carries the same tint step instead -
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
  // comment is always visible and each run paginates independently - so
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
  // WEIGHTED page cursor: a `run` node stands for `count` real rows, so it
  // spends that many rows of its run's page budget - "(N more…)" totals
  // count every real row, not wire nodes.
  const weightOf = (c) => (c.kind === 'run' ? c.count : 1);
  // Rows this run reveals given `limit` rows of its own cursor.
  function visibleFor(run, limit) {
    const out = [];
    let used = 0;
    for (const item of run.items) {
      if (used >= limit) break;
      if (item.kind === 'run') {
        const take = Math.min(item.count, limit - used);
        out.push({ item, take });
        used += take;
      } else {
        out.push({ item, take: null });
        used += 1;
      }
    }
    return { out, used };
  }
  // Total real rows (weighted) in a run's items.
  const runWeight = (run) => run.items.reduce((n, c) => n + weightOf(c), 0);
  // Rows still hidden in run `i` behind its own button. Pages still on the
  // wire belong to the LAST loaded run's button (loading them may extend
  // that run or open new comment-headed runs), so totals stay honest
  // before anything downloads.
  function hiddenOf(run, i) {
    let hidden = runWeight(run) - visibleFor(run, cursorOf(i)).used;
    if (i === runs.length - 1 && nextPage) hidden += nextPage.remaining;
    return hidden;
  }

  // RUN UNIFORMITY (wrap): within a run, rows sharing a code shape (text
  // with numbers masked - "style(--opcode: #):" / "--mc#:") wrap
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

  // "(N more…)": reveals another display page of run `i`. On the last run,
  // when the loaded rows run short of the new target and more pages exist
  // on the wire, pull the next chunk first (appended nodes either extend
  // this run or open new comment-headed runs after it).
  async function more(i) {
    const target = cursorOf(i) + PAGE;
    if (i === runs.length - 1 && nextPage && runWeight(runs[i]) < target) {
      await loadNext();
    }
    runCursors = { ...runCursors, [i]: target };
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
    {@const vis = visibleFor(run, cursorOf(i))}
    {#each vis.out as v}
      <TreeAst node={v.item} rowLimit={v.take} forceSplit={runForcedKeys[i].has(maskKey(v.item))} budget={budget - 2} />
    {/each}
    {@const hidden = hiddenOf(run, i)}
    {#if hidden > 0 && loadState !== 'error'}
      <div class="tree-more">
        <button onclick={() => more(i)}>({hidden.toLocaleString('en-US')} more&hellip;)</button>
      </div>
    {/if}
  {/each}
  {#if loadState === 'loading' && runs.length === 0}
    <pre class="ast-line"><span class="tree-glyph" aria-hidden="true"></span><code class="ast-note">loading <DosSpinner /></code></pre>
  {:else if loadState === 'error'}
    <div class="tree-more">
      <button onclick={retry}>failed to load - retry</button>
    </div>
  {/if}
{/snippet}

{#if isRun}
  {#each runRows as row}
    <TreeAst node={row} {budget} forceSplit={runRowsForced} />
  {/each}
  {#if rowLimit == null && runShownCount < node.count}
    <div class="tree-more">
      <button onclick={() => (runShownCount += PAGE)}>({(node.count - runShownCount).toLocaleString('en-US')} more&hellip;)</button>
    </div>
  {/if}
{:else if isRoot}
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

<style>
  /* One visual line of the tree: a fixed [+]/[-] gutter (kept on every
     line so code columns stay aligned whether or not a row folds) and the
     line's content - wrapped continuations align after the gutter. Code
     lines are <pre> elements so the wizard's inline-code white-chip rule
     (global.css `.window.wizard :not(pre) > code`) skips them by design -
     reset the pre defaults here. */
  .ast-line {
    display: flex;
    /* wrap-reverse: the first flex line sits at the BOTTOM, so the only
       item allowed to wrap (the comment - everything else has basis 0 or
       is rigid) stacks ABOVE the code line when the row gets tight,
       instead of both squeezing side by side. When it fits, one line. */
    flex-wrap: wrap-reverse;
    align-items: baseline;
    padding: 1px 0;
    margin: 0;
    border: none;
    background: none;
    white-space: normal;
    overflow-x: visible;
    font-size: inherit;
    line-height: inherit;
  }
  /* The fold toggle: a drawn [+]/[-] box, EGA cyan (#00aaaa - EGA colour 3,
     the interactable accent; the palette's --edit-cyan is BRIGHT cyan 11,
     unreadable on this light pane). Every line keeps the slot so code
     columns align; only foldable rows draw the box. */
  /* The empty slot is width-only - giving it a fixed HEIGHT makes its
     baseline its bottom edge (empty box + baseline alignment), which
     pushed glyphless lines' text down ~7px and made wrapped continuations
     look detached from their parent row. Only the drawn foldable box
     below carries a height. */
  .ast-line .tree-glyph {
    flex: none;
    width: 22px;
    margin-right: 7px;
    font-family: 'WebVGA', monospace;
    letter-spacing: normal;
    user-select: none;
  }
  .ast-line.is-foldable .tree-glyph {
    height: 22px;
    border: 1px solid #00aaaa;
    color: #00aaaa;
    font-weight: bold;
    font-size: 22px;
    line-height: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    /* .ast-line wraps with wrap-reverse (comments stack ABOVE the row), so
       the cross axis runs bottom-to-top: flex-END is the visual TOP. With
       flex-start the box sat beside the LAST soft-wrapped line of a long
       code box (the phone-width @function-header bug, 2026-07-11). */
    align-self: flex-end;
    margin-top: 0;
  }
  /* WebVGA's glyph metrics sit slightly off true center in the box -
     per-state padding nudges (padding moves the character, not the box):
     '+' (closed) rides high, '-' (open) leans left. */
  .ast-line.is-foldable .tree-glyph:not(.is-open) { padding-top: 3px; }
  .ast-line.is-foldable .tree-glyph.is-open { padding-left: 2px; }
  .ast-line.is-foldable:hover .tree-glyph {
    background: #00aaaa;
    color: var(--edit-white);
  }
  /* Code boxes get flex-basis 0 (not content size): with wrap-reverse
     enabled, an item whose hypothetical size overflows the line would
     wrap to the line ABOVE - basis 0 means code can never trigger that;
     it stays on its line and absorbs leftover width, wrapping internally.
     Only the comment (basis auto, flex none) can wrap up. */
  .ast-line code {
    flex: 1 1 0;
    min-width: 0;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    line-height: 20px;
  }
  /* A one-lined row's value gets its own box taking the remaining width:
     if it soft-wraps, the continuation aligns to the VALUE's start (the
     end of the condition), not the row start. The condition box beside it
     is RIGID - a condition is an atomic label and must never wrap; the
     value column absorbs all the squeeze. */
  .ast-line code.ast-cond {
    flex: none;
    white-space: pre;
  }
  .ast-line .ast-val {
    flex: 1 1 0;
    min-width: 0;
    margin-left: 1ch;
  }
  /* Trailing row comments: their own NON-shrinkable flex item at the
     line's right edge - an annotation column. Never compresses (that
     orphaned "*​/" onto its own line); the code column yields instead.
     Baseline-aligned, so on a wrapped code row it sits at the top right. */
  .ast-line .ast-comment {
    margin-left: auto;
    padding-left: 16px;
    text-align: right;
    flex: none;
  }
  .ast-line.is-foldable { cursor: pointer; user-select: none; }
  .ast-line.is-foldable:hover { background: rgba(0, 0, 0, 0.05); }

  /* Dim elision marker on folded rows. Injected via {@html}, not the
     template - global. */
  :global(.ast-ellipsis) { color: #999; }

  /* Editorial section label rows. */
  .ast-line.is-section .tree-label-group {
    color: var(--edit-black);
    font-weight: bold;
  }

  /* Children indent one level, with the dashed guide. Inside a code pane
     each nesting level steps one shade deeper through a subtle blue ramp
     (the pane itself is #f0f0f8), so depth reads at a glance instead of
     level 3+ all flattening to the same tint. */
  .ast-children {
    margin-left: 14px;
    padding: 2px 4px 2px 8px;
    border-left: 1px dashed #ccd;
  }
  /* A wrapped continuation (a branch's over-budget value on its own line):
     one structural level deeper, so it gets the SAME one-step tint as an
     .ast-children container at its depth - consistent with inline values,
     which show the same step via the .ast-depth chip. No guide (it's a
     single value, not a child list). */
  .ast-continuation {
    margin-left: 14px;
    padding: 0 4px 0 8px;
    /* Tight to the row it wrapped from; the breathing room goes BELOW,
       separating the pair from the next row. */
    margin-bottom: 4px;
  }
  /* These chains span recursive TreeAst instances - each `.ast-children`
     past the first is produced by a nested instance of this same
     component, not this template, so Svelte's static CSS-usage prover
     can't connect them across the component boundary. :global from the
     second step on (the first step is this template's own boxed div and
     stays scoped). */
  .tree-ast :global(.ast-continuation) { background: #e9eaf5; }
  .tree-ast :global(.ast-children .ast-continuation) { background: #e1e3f1; }
  .tree-ast :global(.ast-children .ast-children .ast-continuation) { background: #d9dcec; }
  .tree-ast :global(.ast-children .ast-children .ast-children .ast-continuation) { background: #d1d5e8; }
  .tree-ast :global(.ast-children .ast-children .ast-children .ast-children .ast-continuation) { background: #c9cee3; }
  .tree-ast :global(.ast-children .ast-children .ast-children .ast-children .ast-children .ast-continuation) { background: #c1c7df; }

  .tree-ast :global(.ast-children) { background: #e9eaf5; }
  .tree-ast :global(.ast-children .ast-children) { background: #e1e3f1; }
  .tree-ast :global(.ast-children .ast-children .ast-children) { background: #d9dcec; }
  .tree-ast :global(.ast-children .ast-children .ast-children .ast-children) { background: #d1d5e8; }
  .tree-ast :global(.ast-children .ast-children .ast-children .ast-children .ast-children) { background: #c9cee3; }
  .tree-ast :global(.ast-children .ast-children .ast-children .ast-children .ast-children .ast-children) { background: #c1c7df; }

  /* Structural depth shows even INLINE: a branch's value is one level
     deeper than its condition, so it carries the next tint step as a
     text-hugging chip (an inner span - the value's flex box stretches to
     fill the row, so the box itself can't carry the colour). Same chain
     arithmetic as .ast-children, one rung deeper. clone keeps the chip's
     padding on each fragment when it wraps. */
  /* Chip colours run TWO rungs deeper than their row's background - a
     small text chip needs real contrast where a large container area can
     afford a subtle step. */
  /* .ast-depth itself is {@html}-injected (never literal in any
     template), and every .ast-children past the first spans a nested
     TreeAst instance (see the background chain above) - both make the
     chain unprovable by Svelte's static usage check, so it's global
     from .ast-children on. Only .tree-ast (this template's own boxed
     div) stays scoped. */
  .tree-ast :global(.ast-depth) {
    padding: 0 3px;
    -webkit-box-decoration-break: clone;
    box-decoration-break: clone;
    background: #dfe2f0;
  }
  .tree-ast :global(.ast-children .ast-depth) { background: #d6daeb; }
  .tree-ast :global(.ast-children .ast-children .ast-depth) { background: #cdd2e5; }
  .tree-ast :global(.ast-children .ast-children .ast-children .ast-depth) { background: #c4cadf; }
  .tree-ast :global(.ast-children .ast-children .ast-children .ast-children .ast-depth) { background: #bbc2d9; }
  .tree-ast :global(.ast-children .ast-children .ast-children .ast-children .ast-children .ast-depth) { background: #b2bad3; }

  /* A boxed section's children pane: ONE tinted box per real file region
     (the @function cluster, the .cpu rule, the @property blocks) -
     .byte-example supplies the WebVGA font and Prism palette; this
     override swaps its border for the tint. */
  .ast-children.tree-ast {
    margin: 4px 0 8px 0;
    background: #f0f0f8;
    border: none;
    padding: 6px 8px;
    font-size: 14px;
    white-space: normal;
    overflow-x: visible;
  }

  /* Pagination: "(N more…)" as a real button - same cyan interactable
     language as the fold boxes. */
  .tree-more {
    margin: 3px 0;
    padding-left: 29px;
  }
  .tree-more button {
    font: inherit;
    font-size: 13px;
    color: #00aaaa;
    background: none;
    border: 1px solid #00aaaa;
    padding: 1px 8px;
    cursor: pointer;
  }
  .tree-more button:hover {
    background: #00aaaa;
    color: var(--edit-white);
  }

  /* Editorial lines that are NOT source text: the truncation `note` rows
     the extraction tool plants where a giant uniform run was capped, and
     the transient loading indicator. Styled clearly as annotation, not
     code - italic, dim. */
  .ast-line .ast-note {
    font-style: italic;
    color: #666;
  }

  @media (max-width: 640px) {
    .tree-ast { font-size: 13px; }
    .ast-children { margin-left: 8px; padding-left: 5px; }
    .ast-line .tree-glyph { width: 22px; }
    /* On a phone-width pane, comments ALWAYS stack above their line
       (flex-basis 100% = never shares a line; wrap-reverse puts its line
       on top) instead of even attempting inline - no per-row layout
       lottery on narrow screens. */
    .ast-line .ast-comment { flex: 0 1 100%; padding-left: 0; }
  }
</style>
