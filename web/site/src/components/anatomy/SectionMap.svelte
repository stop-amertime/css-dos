<script>
  // The map — the carousel's landing page. Orients the reader on the
  // bar and plants the one-definition fact that the 171 MB payoff at
  // the end of the tour depends on. Not a file section (no bytes of
  // its own) — see router FILE_SECTIONS vs anatomy/groups.js.
  // The old GLOSSARY callout (cart/cabinet/tick) was replaced by
  // inline Term definitions 2026-07-04 — words define themselves at
  // the point of use.
  import Term from '../Term.svelte';
</script>

<p>
  The bar above is the whole <Term t="cabinet">cabinet</Term> &mdash;
  a real build (Sokoban, 309&nbsp;MB), drawn to scale, in file order.
  Click any stripe, or use the arrows to walk the sections in order.
</p>

<p>
  Two things are worth knowing before you go in. First, the thinking
  is nearly free: the CPU &mdash; every
  <Term t="register">register</Term>, every instruction &mdash; is the
  hairline at the bar&rsquo;s left edge, 255&nbsp;KB, under a tenth of
  a percent of the file. Second, one fact of CSS explains most of the
  rest: a variable can be defined exactly once. There is no
  <code>x&nbsp;=&nbsp;y</code> &mdash; every variable is a single
  formula that has to anticipate, in advance, everything that could
  ever happen to it. The biggest stripe, 171&nbsp;MB of dark blue, is
  the price of that, and it&rsquo;s the last stop on the tour.
</p>
