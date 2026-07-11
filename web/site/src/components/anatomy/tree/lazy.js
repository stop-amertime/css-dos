// lazy.js — chunk fetcher for the anatomy Tree View's progressive
// disclosure. Skeleton modules (<id>-tree.js) carry lazy: { ref, count }
// on heavy nodes; the children live in paged JSON files under
// public/anatomy/<ref>.json, written by tools/extract-tree-data.mjs.
// Chunk format: { nodes: [...], next: { ref, remaining } | null }.
//
// The cache stores the promise (not the payload) so concurrent expands of
// the same node share one request; a failed fetch is evicted so a retry
// actually retries.
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
