# 2026-07-04 — About section critique pass (owner-approved list, actioned)

Owner asked for a first-time-user critique of the About section, then
approved actioning the full list. Changes (all `web/site/src/`):
pages reordered Intro / How possible / **How it works** (was
"What's in the file", was last) / FAQs / Why-as-epilogue; carousel
header-comment section deleted (build-recipe fact moved to util's
first sentence) and replaced at position 1 by a **map page** — bar
fully lit + GLOSSARY callout (cart/cabinet/tick, arcade framing) +
the one-definition teaser that pays off at memw. Page 2 rebuilt as
the mechanisms page (CssDemo + what-is-CSS absorbed as a fold-bg;
year-and-a-half stat + Calcite mention promoted from the last FAQ
fold). FAQs deduped to short answers + real `#about/file/<id>` deep
links, skeptic-first, +3 new (sound / playability / own programs).
memw main flow rewritten to the ABOUT-SCRIPT register + verbatim
assembled-cell cascade added (mirrors kiln/emit-css.mjs). Util's
sign() para corrected: that line is SUB/CMP's borrow (verified in
kiln/patterns/flags.mjs:115), not ADD's carry. Keyboard ←/→ now fall
through to page turns at carousel ends (no wrap trap); applyHash
scrolls to top. Verified in Chromium via Playwright: all 5 pages, 10
carousel stops, deep links, arrow fall-through, 0 console errors.
ABOUT-SCRIPT.md design section updated to match.
