# Locked-control tooltips: why Play / Next are disabled

**2026-07-12 · LANDED**

Owner ask: the greyed "3 Play" strip tab and the Build step's disabled
"Next »" should say why on hover/tap. Yellow DOS bubbles:

- Strip tab (StepDots `disabledTip` prop): "Please 'Build' a file
  first", below the tab. Tab fade moved from the `li` onto its content
  spans (child opacity can't out-opaque a faded parent); the ≤900px
  ellipsis clip moved onto a new `.lbl` span so it can't cut the bubble.
- Next »: `nav.nextTip` getter (router owns the why) — pick sub-page
  "Please select a program first", configure "Please 'Build' a file
  first". New global `.tip-anchor` wrapper: disabled form controls
  swallow pointer events, so the child gets `pointer-events:none` and
  the wrapper takes the hover/tap; `data-tip` null when enabled.

Verified in-browser: both bubbles on hover, pick→configure tip switch
reactive, hidden at rest.
