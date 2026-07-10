# 2026-07-10 — Site: owner fix round (mobile overflow, dither placement, Home/Why copy)

**LANDED** (master) — five owner-reported items, verified via
Playwright at 390px + 1280px (no horizontal overflow, screenshots):

- Mobile sideways-scroll on Home: the hero h1 (24px, `nowrap`,
  out-specifies the phone h1 rule) forced a ~470px min-content width.
  ≤640px it now wraps at 22px (`about.css`).
- Step-strip tabs: inactive tabs get a DARKER (#666) dither; current
  stays transparent over the band's #999 weave — all dithered, not
  flat-vs-dithered. Labels sized up 16→20px (17/16 on ≤900/≤640px)
  (`StepDots.svelte`).
- `.menu-bar`/`.status-line` un-dithered back to flat grey (the 197d93e
  texture was unwanted); the hairline purge stands — no 1px line back.
- Home hero + Why copy synced from `docs/CSS-DOS-site-copy.md`
  ("An entire ’80s PC…", morbidly-obese para moved up, Dugg cave-paint
  passage). Why-page CTA buttons centred (`align-items: center`).
