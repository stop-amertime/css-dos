<script>
  // Paginated cabinet-source viewer. Cabinets are 100+ MB with pathologically
  // long lines, so we paginate by LINE COUNT and discover page offsets lazily
  // (stream forward counting newlines, cache the byte offset of each page).
  import Prism from '../lib/prism.js';

  let { blob } = $props();

  const LINES_PER_PAGE = 200;

  let page = $state(1);
  let pageStarts = [0];
  let exactPageCount = $state(null);
  let totalLabel = $state('0');
  let codeEl;

  function estimateTotal() {
    if (exactPageCount != null) return exactPageCount;
    const est = Math.max(1, Math.ceil(blob.size / (LINES_PER_PAGE * 40)));
    return Math.max(est, pageStarts.length);
  }

  async function ensurePage(target) {
    if (target < pageStarts.length || exactPageCount != null) return;
    const CHUNK = 256 * 1024;
    let offset = pageStarts[pageStarts.length - 1];
    let sinceMark = 0;
    while (pageStarts.length <= target && offset < blob.size) {
      const end = Math.min(offset + CHUNK, blob.size);
      const buf = new Uint8Array(await blob.slice(offset, end).arrayBuffer());
      for (let i = 0; i < buf.length; i++) {
        if (buf[i] === 0x0a && ++sinceMark === LINES_PER_PAGE) {
          pageStarts.push(offset + i + 1);
          sinceMark = 0;
          if (pageStarts.length > target) break;
        }
      }
      offset = end;
    }
    if (offset >= blob.size) { exactPageCount = pageStarts.length; pageStarts.push(blob.size); }
  }

  async function render(n) {
    await ensurePage(n);
    if (exactPageCount != null && n > exactPageCount) n = exactPageCount;
    page = n;
    const start = pageStarts[n - 1];
    const end = pageStarts[n] ?? blob.size;
    const text = await blob.slice(start, end).text();
    codeEl.textContent = text;
    Prism.highlightElement(codeEl);
    const total = estimateTotal();
    totalLabel = exactPageCount != null ? String(total) : `~${total}`;
  }

  $effect(() => {
    // Re-paginate whenever a new cabinet arrives.
    blob;
    pageStarts = [0];
    exactPageCount = null;
    render(1);
  });

  let atEnd = $derived(exactPageCount != null && page >= exactPageCount);
</script>

<section class="source-viewer-block">
  <div class="pager-controls">
    <span class="pager-label">Source Code:</span>
    <button class="pager-btn" disabled={page <= 1} onclick={() => render(page - 1)}>&#171; Prev</button>
    <span class="pager-page">
      Page
      <input class="field page-jump-input" type="number" min="1" value={page}
             onchange={(e) => render(Math.max(1, parseInt(e.currentTarget.value, 10) || 1))} />
      of {totalLabel}
    </span>
    <button class="pager-btn" disabled={atEnd} onclick={() => render(page + 1)}>Next &#187;</button>
  </div>
  <pre class="source-pre"><code bind:this={codeEl} class="language-css"></code></pre>
</section>
