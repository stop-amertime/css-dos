# Attic

Retired pages kept for their copy and widget wiring — not imported by
the app, so Vite ignores them.

- `HowItWorks.svelte` — the old 8-page "How it works" wizard step
  (What is CSS? / Stumbling block / Where's the computer? / The CPU /
  Screen keys time / 300 MB / Tricks / Credits). Retired 2026-07-03
  when the site collapsed to About–Build–Play; its content gets
  recycled into the About FAQs and the cabinet-contents stories
  (design: `ABOUT-SCRIPT.md`).
- `TricksPage.svelte` — the Tricks sub-page HowItWorks mounts; moved
  here 2026-07-12 when the About refactor dissolved the fragment CSS.

NOTE (2026-07-12): the fragment stylesheets these two imported
(`_fragments/about.css`, `_fragments/anatomy.css`) were dissolved into
component `<style>` blocks and `global.css` by the About refactor, so
they no longer compile as-is — re-mounting means recreating the odd
rule (`.anatomy-list`, `.tick-walk`, `.byte-example .tok-*`) from git
history (`git show e2d4f49:web/site/src/styles/_fragments/about.css`).
