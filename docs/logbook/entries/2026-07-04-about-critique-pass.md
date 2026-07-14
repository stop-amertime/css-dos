# 2026-07-04 - About section critique pass (owner-approved list, actioned)

Owner asked for a first-time-user critique of the About section, then
approved actioning the full list. Changes (all `web/site/src/`):
pages reordered Intro / How possible / **How it works** (was
"What's in the file", was last) / FAQs / Why-as-epilogue; carousel
header-comment section deleted (build-recipe fact moved to util's
first sentence) and replaced at position 1 by a **map page** - bar
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
Follow-up (same day): wizard height caps switched 100vh→100dvh (vh is
the large viewport on phones; with the URL bar showing and the body
unable to scroll, the pinned Next footer sat off-screen), and Next is
now disabled on the carousel's map page until the carousel has been
used once (arrow/bar/deep link) so readers can't skip the tour
without finding it. Credits & thanks restored as About page 6
(verbatim from the retired route; dropped in the 2026-07-03
collapse) - half-answers the old open [Q]; Tricks still attic-only.
Second mobile fix (same day): the dvh switch above was incomplete -
the base `body{min-height:100vh}` still won over the wizard rule's
`height:100dvh` (min-height beats height), so with the URL bar showing
the body was URL-bar-height too tall and safe-center split that excess
into extra blue gap on top + footer pushed below the fold. Wizard body
rule now sets `min-height:100dvh` too. Verified in Chromium by
rendering both resolved values at 390×844 (pre: 904px body, +30px top
gap, footer +30px down; post: symmetric, footer on-screen) + desktop
1440×900 and 390×560 regression screenshots.
