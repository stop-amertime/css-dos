// lazy.js — chunk fetcher for the anatomy Tree View's progressive
// disclosure. Skeleton modules (<id>-tree.js) carry lazy: { ref, count }
// on heavy nodes; the children live in paged JSON files under
// public/anatomy/<ref>.json, written by tools/extract-tree-data.mjs.
// Chunk format: { nodes: [...], next: { ref, remaining } | null }.
//
// The cache stores the promise (not the payload) so concurrent expands of
// the same node share one request; a failed fetch is evicted so a retry
// actually retries.
// `run` nodes are losslessly compressed uniform stretches (see the tool):
// `period` templates with %%N%% tokens (row i uses templates[i % period] —
// memory arms alternate two shapes for even/odd bytes) plus one numeric
// column per token — constant {c}, linear {b, s}, or explicit {v: [...]}.
// expandRun(run, i) rebuilds row i's exact node; the generator verified
// every row against the source, so expansion is reconstruction, not
// approximation.
function colValue(col, i) {
  if ('c' in col) return col.c;
  if ('v' in col) return col.v[i];
  return col.b + i * col.s;
}

export function expandRun(run, i) {
  const cls = i % run.period;
  const inClass = Math.floor(i / run.period);
  return JSON.parse(
    run.templates[cls].replace(/%%(\d+)%%/g, (_, c) => String(colValue(run.cols[cls][Number(c)], inClass)))
  );
}

const cache = new Map();

export function fetchChunk(ref) {
  if (!cache.has(ref)) {
    const p = fetch(`${import.meta.env.BASE_URL}anatomy/${ref}.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`chunk ${ref}: HTTP ${r.status}`);
        return r.json();
      })
      .catch((err) => {
        cache.delete(ref);
        throw err;
      });
    cache.set(ref, p);
  }
  return cache.get(ref);
}
