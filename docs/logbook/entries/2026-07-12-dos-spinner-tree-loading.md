# 2026-07-12 — DOS throbber for the file-map tree's loading line

**LANDED.** Owner ask: the tree's lazy-chunk `loading…` line (not a
Svelte `{#await}` — TreeAst's manual `loadState` rune around
`fetchChunk`) now shows an old-school DOS wait spinner. New
`web/site/src/components/DosSpinner.svelte`: pure-text `| / - \`
cycling at 120 ms in a fixed 1ch cell (no line jitter), aria-hidden
(the "loading" word carries the semantics), inherits font/colour —
reusable anywhere the site awaits something. Verified on the dev
site with a Playwright route delay on /anatomy/ chunks: frames
cycle, line clears when the chunk lands, console clean.
