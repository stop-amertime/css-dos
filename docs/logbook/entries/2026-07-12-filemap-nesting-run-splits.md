# File map: stage-1 nesting fixes + per-run "(N more…)" restored

**2026-07-12 · LANDED**

Owner screenshot: FETCH & DECODE's `.cpu` rule nested under "decode
helpers". Three distinct causes, all fixed:

- **Kiln emission order** — the `--- decode helpers ---` banner (a sub
  spans until the NEXT banner, per the extractor's Grouper) preceded
  `.cpu {`, swallowing it. Stage 1 now emits rule-first, helpers after
  (same shape as HELPERS). Behaviour-inert: smoke 6/6 PASS.
- **Grouper promoted-sub bug** — in a `---`-only context the FIRST sub
  became a major and ate its siblings (slot 1/2 under slot 0,
  `registers` under `timer countdown`). Every promoted sub is now a
  sibling. **unfoldCeremony generalised**: a lone rule among @property
  blocks / boxed subs renders open (chipset chips lose a click).
- **TreeAst per-run cursors** — the 07-12 shared cursor clumped later
  runs' comment landmarks above one global button, violating
  conventions principle 6. Each comment-delimited run again paginates
  independently; buttons can't stack (a run always shows a page before
  its button; the next run opens with its comment).

Also committed `public/anatomy/screen/` (506 chunks) — the committed
skeleton referenced them but they were never git-added (deploy 404).
Verified in-browser: cpu/memr/disk/chipset shapes, per-run buttons,
wire-page loads, console clean.
