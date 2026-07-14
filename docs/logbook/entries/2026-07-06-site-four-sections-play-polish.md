# 2026-07-06 - Site: four sections (Home/Build/Play/About) + Play/build UX pass

Owner batch, all on the Svelte site. Router restructured to **Home /
Build / Play / About** - About (how/file/calcite/faqs/why/credits) now
reads AFTER the build/play flow; the old Intro page is the `Home` step;
Play gained a Next → About. Legacy hashes (`#about/intro`, `#how`,
bare `#about`) still resolve; copy pass on About is owner-owned, later.
Play page: iframe now sized to the embed document's real height
(same-origin measure + ResizeObserver - `body.scrollHeight`, NOT
`documentElement`, which is viewport-clamped and never shrinks), so
screen+keyboard+Calcite-note fit without scrolling; the CSS-DOS
title/engine-status debug line replaced by a quiet "Change program"
button (errors still surface); the page re-verifies its cabinet on
mount (Cache Storage probe) and bounces to `#build/pick` if evicted.
Build page: clicking a cart card advances straight to configure; the
custom-upload choices are now buttons that `.click()` the hidden
inputs (label→display:none-input forwarding is unreliable on mobile)
and the `.com/.exe` accept filter is gone (Android opens no chooser
for extension-only accepts - likely the "upload does nothing" report).
How-it-works hub: h1 dropped; bar = full-bleed sticky white topper
with tall narrow flanking arrows; section content in a white box
keyed to the segment colour; first-visit hint is a hand-rolled white
bubble (white arrow) + dim spotlight, dismissed by X/click-out/use -
Next is no longer gated. Gotcha for reuse: Chrome clips
position:fixed descendants of a sticky element to its layer - the
overlay must be a *sibling* of the sticky bar (z 44 under its 45).
tippy.js dependency dropped. Verified in Chromium end-to-end: sokoban
built → played in-frame, gate bounce, hint interactions, mobile 390px,
`site:build` green.
