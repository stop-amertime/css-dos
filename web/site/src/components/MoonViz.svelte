<script>
  import '../styles/_fragments/moon-viz.css';
</script>

<!-- earth–moon distance. The dotted walk is ~2/3 of the baseline:
     332M chars x ~0.75 m/step ≈ 249,000 km ≈ 65% of the 384,400 km
     mean Earth–Moon distance. Baseline x=40..660. -->
<div class="moon-viz" id="moon-viz">
  <svg viewBox="0 0 700 160" role="img" aria-label="Earth to Moon distance, about two thirds dotted">
    <!-- baseline -->
    <line x1="40" y1="120" x2="660" y2="120" stroke="#888" stroke-width="1" stroke-dasharray="2 4"/>
    <!-- the walk: ~2/3 of the way (x=40 -> x=443) -->
    <line x1="40" y1="120" x2="443" y2="120" stroke="#aa0000" stroke-width="3" stroke-dasharray="3 5"/>
    <!-- Earth -->
    <circle cx="40" cy="120" r="26" fill="#0000aa" stroke="#000" stroke-width="1"/>
    <text x="40" y="124" text-anchor="middle" font-size="11" fill="#fff" font-family="inherit">EARTH</text>
    <!-- Moon -->
    <circle cx="660" cy="120" r="12" fill="#aaa" stroke="#000" stroke-width="1"/>
    <text x="660" y="98" text-anchor="middle" font-size="11" fill="#000" font-family="inherit">MOON</text>
    <!-- ~2/3 marker -->
    <text x="443" y="98" text-anchor="middle" font-size="11" fill="#aa0000" font-family="inherit">~2/3</text>
  </svg>
  <p class="caption">
    Take one step for every character in the file &mdash; letter,
    digit, etc. &mdash; and you&rsquo;d walk
    <b>about two-thirds of the way to the Moon</b>
    (around 250,000&nbsp;km).
  </p>
</div>
