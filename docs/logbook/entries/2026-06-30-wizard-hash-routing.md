# Wizard hash routing — refresh keeps the step

**2026-06-30 · LANDED (branch web/build-boxart-cards)**

The landing/build page (`web/site/index.html`) is a single page whose
three "tabs" (About / Build / Play) are JS-toggled `.step` sections in
`wizard.js`. A refresh reset you to About — the active step lived only
in JS state, not the URL.

Fix: the URL hash is now the route.
- `setStep()` writes `#about` / `#build` / `#play` (`writeHash`).
- `applyHash()` (on load + `hashchange`) reads it and moves there,
  with the same gating as a tab click — `#play` before a build falls
  back to `#build`.
- A `syncingHash` flag breaks the setStep→hashchange→setStep echo.
- `#games` kept as a historical alias for `#build` (no code links to
  it; URL rewrites to `#build` on arrival).

No framework, no build step, no new files — stays static / Node-builtins
only, per the repo's stated values. The owner considered SvelteKit-static
routes but chose the minimal fix; plain HTML has no native routing/
components, and hash routing can't 404 on refresh the way history routing
would without server rewrites.

Playwright-verified in Chromium: tab clicks update the URL; reload of
`#build` lands on Build (grid shown); `#play` ungated redirects to
`#build`; rapid switching doesn't loop; console clean.
