<script>
</script>

<!-- earth–moon distance. The dotted walk is ~60% of the baseline:
     309,116,250 chars (sokoban.css) x ~0.75 m/step ≈ 232,000 km ≈
     60.3% of the 384,400 km mean Earth–Moon distance. Baseline
     x=46..654. Body sizes are illustrative, NOT to scale with the
     distance (true scale: Earth r≈10, Moon r≈3 on this baseline). -->
<div class="moon-viz" id="moon-viz">
  <svg viewBox="0 12 700 90" role="img" aria-label="Earth to Moon distance, about 60% dotted">
    <!-- baseline -->
    <line x1="46" y1="58" x2="654" y2="58" stroke="#888" stroke-width="1" stroke-dasharray="2 4"/>
    <!-- the walk: ~60% of the way (x=46 -> x=413) -->
    <line x1="46" y1="58" x2="413" y2="58" stroke="#aa0000" stroke-width="4" stroke-dasharray="4 6"/>
    <!-- Earth -->
    <circle cx="46" cy="58" r="36" fill="#0000aa" stroke="#000" stroke-width="1"/>
    <text x="46" y="63" text-anchor="middle" font-size="13" fill="#fff" font-family="inherit">EARTH</text>
    <!-- Moon -->
    <circle cx="654" cy="58" r="18" fill="#aaa" stroke="#000" stroke-width="1"/>
    <text x="654" y="30" text-anchor="middle" font-size="12" fill="#000" font-family="inherit">MOON</text>
    <!-- ~60% marker -->
    <text x="413" y="34" text-anchor="middle" font-size="20" font-weight="bold" fill="#aa0000" font-family="inherit">~60%</text>
  </svg>
  <p class="caption">
    Take one step for every character in the file &mdash; letter,
    digit, etc. &mdash; and you&rsquo;d walk
    <b>about 60% of the way to the Moon</b>
    (some 230,000&nbsp;km).
  </p>
</div>

<style>
  .moon-viz {
    border: 1px solid var(--edit-black);
    background: var(--edit-white);
    box-shadow: 4px 4px 0 var(--edit-black);
    padding: 12px 16px;
    margin: 16px 0;
  }
  .moon-viz svg { width: 100%; height: auto; display: block; }
  .moon-viz .caption {
    margin: 8px 0 0;
    font-size: 16px;
    line-height: 18px;
    color: var(--edit-black);
  }
</style>
