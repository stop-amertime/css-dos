<script>
  // The screen — 64,000 divs, each a CSS rule reading video memory.
  // Copy recycled from the retired "Screen, keys, time" page; facts
  // from CABINET-ANATOMY.md §8.
  import Foldable from '../Foldable.svelte';
  import PixelScreen from '../PixelScreen.svelte';
</script>

<p>
  CSS can&rsquo;t draw pixels. It can colour elements. So the screen is
  <b>one &lt;div&gt; per pixel</b> &mdash; 64,000 of them, 320 wide by
  200 tall &mdash; each with a rule that reads its own byte of video
  memory:
</p>

<PixelScreen />

<p>
  When a program writes to video memory, the divs whose bytes changed
  recalculate their <code>background-color</code>, and the picture
  changes. These 64,000 rules are 6.5&nbsp;MB of the file, and
  they&rsquo;re always in it &mdash; this is the pure-CSS renderer,
  proven to paint in real Chromium.
</p>

<Foldable>
  {#snippet summary()}The palette &mdash; how 256 colours get chosen{/snippet}
  <p>
    A pixel&rsquo;s byte isn&rsquo;t a colour; it&rsquo;s an index into
    a palette of 256. The palette isn&rsquo;t fixed either &mdash; the
    running program loads its own, and the machine accepts it exactly
    the way real VGA hardware did: to set one colour, the program
    writes three bytes &mdash; red, green, blue &mdash; to a single
    port, while a small counter steps 0, 1, 2 and rolls over to the
    next colour slot. When a game fades to black, it is re-streaming
    the whole table a little darker, over and over.
  </p>
  <p>
    The lookup itself is a shared 256-way <code>if()</code> function,
    <code>--paletteRGB</code>, that turns the live palette into an
    actual <code>rgb(&hellip;)</code> value for each div.
  </p>
</Foldable>
