// Cache Storage is the cabinet's only home. The builder writes it here;
// the bridge worker compiles from here (imports getCabinetBlob below);
// sw.js serves /cabinet.css from here for the raw player - its reader
// must mirror the part scheme (it's a classic script and can't import
// this module).
//
// Cabinets are stored CHUNKED: body-less index entry at CURRENT_URL
// (headers carry part count + total size) + `?part=N` entries of
// PART_BYTES each. A single ~330 MB put reproducibly dies on Windows
// Chromium with "Unexpected internal error" (doom8088 is 323 MB);
// ≤64 MB parts are reliably below that. Parts are written first and
// the index last, so a concurrent reader either sees a complete
// cabinet or none.
//
// Cabinets are purged at build start (at most one exists) but survive
// page reloads: the bridge rehydrates from this cache on the next
// viewer connect, so an F5 / HMR / discarded mobile tab doesn't lose
// the build or strand an open player.
// The bump from v1 → v2 one-time-evicted pre-flat-shape cabinets that
// existing users had lying around.
const CACHE_NAME = 'cssdos-cabinets-v2';
const LEGACY_CACHE_NAMES = ['cssdos-cabinets-v1'];
const CURRENT_URL = '/cabinet.css';
const PART_BYTES = 64 * 1024 * 1024;

export async function saveCabinet(blob, url = CURRENT_URL) {
  const cache = await caches.open(CACHE_NAME);
  // Drop the old index first so no reader pairs it with the new parts.
  await cache.delete(url);
  const parts = Math.max(1, Math.ceil(blob.size / PART_BYTES));
  for (let i = 0; i < parts; i++) {
    const part = blob.slice(i * PART_BYTES, Math.min((i + 1) * PART_BYTES, blob.size));
    await cache.put(`${url}?part=${i}`, new Response(part, {
      headers: { 'Content-Type': 'text/css', 'Content-Length': String(part.size) },
    }));
  }
  await cache.put(url, new Response(null, {
    headers: {
      'Content-Type': 'text/css',
      'Content-Length': String(blob.size),
      'X-Cabinet-Parts': String(parts),
    },
  }));
  return url;
}

export async function hasCabinet(url = CURRENT_URL) {
  const cache = await caches.open(CACHE_NAME);
  const hit = await cache.match(url);
  return hit != null;
}

/// The index entry (headers only - Content-Length is the cabinet size).
export async function getCabinet(url = CURRENT_URL) {
  const cache = await caches.open(CACHE_NAME);
  return cache.match(url);
}

/// Reassemble the full cabinet as one Blob (part blobs are disk-backed
/// references - this doesn't copy the bytes). Returns null if absent or
/// incomplete. Falls back to a pre-chunking single-entry cabinet.
export async function getCabinetBlob(url = CURRENT_URL) {
  const cache = await caches.open(CACHE_NAME);
  const index = await cache.match(url);
  if (!index) return null;
  const parts = Number(index.headers.get('X-Cabinet-Parts') || '0');
  if (!parts) return index.blob();
  const blobs = [];
  for (let i = 0; i < parts; i++) {
    const p = await cache.match(`${url}?part=${i}`);
    if (!p) return null;
    blobs.push(await p.blob());
  }
  return new Blob(blobs, { type: 'text/css' });
}

export async function deleteCabinet(url = CURRENT_URL) {
  const cache = await caches.open(CACHE_NAME);
  const keys = await cache.keys();
  await Promise.all(keys
    .filter((req) => new URL(req.url).pathname === url)
    .map((req) => cache.delete(req)));
  return true;
}

/// Wipe every cabinet in every known cache (current + legacy).
/// Called at build start, so the new build never races a stale cabinet.
export async function purgeCabinets() {
  const names = [CACHE_NAME, ...LEGACY_CACHE_NAMES];
  await Promise.all(names.map((name) => caches.delete(name).catch(() => false)));
}
