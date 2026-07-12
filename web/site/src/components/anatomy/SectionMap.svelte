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
  Click the sections or arrows above to delve<span class="map-fn-star">*</span>
  in.
</p>
<p class="map-fn small">
  <span class="map-fn-star">*</span> written by a human, I promise.
</p>

<style>
  .map-fn { margin: 0; color: #555; line-height: 14px; }
  .map-fn-star { color: var(--edit-red); text-decoration: none; }
</style>
