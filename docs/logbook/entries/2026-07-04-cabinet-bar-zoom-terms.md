# 2026-07-04 - Cabinet bar rework (sticky map, unified zoom) + inline Term definitions

Owner asks. CabinetBar: the three exaggerated left slivers replaced
by one 2px near-scale sliver; the CPU-only zoom callout now expands
all three too-small sections (util/CPU/keys, clickable) labelled
"~350× zoom - 0.1% of the file". Bar is `position:sticky` at the top
of `.wiz-scroll` (map stays while sections scroll); the long caption
is gone - the header row shows "The whole 309 MB file" on the map,
else the current section's title + size clamped over its segment and
tied to it by a coloured tick (`bind:clientWidth` centring). The
duplicate `.pane-head` in About was removed (count moved into the
bar row). Router `scrollTop()` now also resets `.wiz-scroll` (it
only reset `window`, a no-op - page turns kept stale scroll) and
`sectionJump` scrolls too. New `Term.svelte` + `lib/terms.js`:
dotted-underline inline terms with a fixed-position definition card
(hover/tap/focus; scroll/outside-tap closes); seeded cabinet, cart,
register, tick, floppy, opcode, DOS across About/sections.
Playwright-verified desktop+390px: sticky pin, zoom clicks, scroll
reset, tooltips (tap incl.); `vite build` green.
