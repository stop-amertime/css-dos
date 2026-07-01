// Deep-merge two manifest objects; b wins. Mirrors builder/lib/config.mjs's
// deepMerge, kept here so the browser build path doesn't pull in config.mjs.
export function mergeManifest(a, b) {
  if (b === null) return null;
  if (Array.isArray(b) || typeof b !== 'object') return b;
  const out = { ...(a ?? {}) };
  for (const k of Object.keys(b)) {
    const av = out[k], bv = b[k];
    out[k] = bv && typeof bv === 'object' && !Array.isArray(bv) && av && typeof av === 'object' && !Array.isArray(av)
      ? mergeManifest(av, bv)
      : bv;
  }
  return out;
}
