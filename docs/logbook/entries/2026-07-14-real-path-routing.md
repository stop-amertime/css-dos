# Real-path routing + skip/cart URL attribution

`web/site/src/lib/router.svelte.js`: hash routing → History API.
`pathFor()`/`applyPath()` (was `hashFor`/`applyHash`) +
`pushState`/`popstate` give real paths (`/about/why`, `/build/pick`,
`/play`) so Vercel Analytics attributes pageviews per route instead
of everything landing on `/`. `migrateLegacyHash()` translates old
`#...` links once on load; a `click` listener intercepts same-origin
`<a href="/...">` clicks (all in-copy deep links across
`components/anatomy/*`/`AboutFaqs`/`AboutHow`/`Play.svelte` updated
from `#` to `/`) into `pushState`, no full reload.

Two one-shot-field attribution additions (same pattern as the
existing `#wantedPlay`): Why page's "TRY IT OUT IMMEDIATELY" tags its
landing pageview `?skipped=true` (stripped right after); a picked
cart stays in the URL (`?cart=<id>`) through the rest of Build, and
loading that URL directly pre-selects it once `serverCarts` loads.

`vite.config.js` now emits `vercel.json` `rewrites` + `_redirects`
(SPA fallback other hosts need) — required for direct loads/refresh
on a deep path. Verified in dev + `vite preview` prod build via
Playwright: pushState nav (no reload, distinct Analytics `[view]`
events per route), skip-tag round-trip, cart deep-link pre-select,
bogus `?cart=` no-ops cleanly.
