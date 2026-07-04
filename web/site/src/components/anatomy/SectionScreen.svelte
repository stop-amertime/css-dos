<script>
  // The screen — 64,000 divs, each a CSS rule reading video memory.
  // Copy recycled from the retired "Screen, keys, time" page; facts
  // from CABINET-ANATOMY.md §8.
  import Foldable from '../Foldable.svelte';
  import PixelScreen from '../PixelScreen.svelte';
  import CodeCss from '../CodeCss.svelte';

  const RETRACE = `/* in retrace? — 1 while the beam would be flying back */
max(0, sign(3409 - mod(var(--snapshot-cycleCount), 68182)))`;

  const PIXEL_RULE = `#p31840 { --ci: mod(var(--snapshot-mc343600), 256); background-color: --paletteRGB(var(--ci)); }`;

  const PALETTE_FN = `@function --paletteRGB(--idx <integer>) returns <color> {
  result: if(
    style(--idx: 0): rgb(round(mod(var(--snapshot-mc524288), 256) * 255 / 63)
                         round(round(down, var(--snapshot-mc524288) / 256) * 255 / 63)
                         round(mod(var(--snapshot-mc524289), 256) * 255 / 63));
    /* … all 256 palette slots … */
    else: rgb(0 0 0));
}`;
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
<p>
  Each rule is one line. Pixel 31,840 &mdash; row 99, column 160, the
  middle of the screen &mdash; is:
</p>
<CodeCss code={PIXEL_RULE} />
<p>
  <code>mod()</code> digs the pixel&rsquo;s byte out of its packed
  memory cell, and the palette function turns that byte into a colour.
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
    actual <code>rgb(&hellip;)</code> value for each div:
  </p>
  <CodeCss code={PALETTE_FN} />
  <p>
    The mess inside <code>rgb()</code> is three live memory reads
    &mdash; red, green, blue &mdash; each scaled by 255/63 because a
    real VGA&rsquo;s palette chip only kept six bits per channel:
    programs wrote brightnesses from 0 to 63, and the machine honours
    that. Of the file&rsquo;s thousands of functions, this is the only
    one that returns a colour &mdash; everything else in
    300&nbsp;MB computes integers.
  </p>
  <p>
    There&rsquo;s even a second, separate cursor for <i>reading</i> the
    palette back &mdash; a fade effect wants to know the current
    colours before dimming them, and real VGA hardware let it ask
    without disturbing the write cursor. So does this one.
  </p>
</Foldable>

<h3 class="anatomy-head">Text mode &amp; CGA &mdash; the shared bytes</h3>
<p>
  Mode 13h isn&rsquo;t the only screen the machine carries. Text mode
  &mdash; the 80&times;25 grid the DOS prompt lives on &mdash; is its
  own region of video memory at a different address: two bytes per
  character, the letter and its colours. And the older CGA graphics
  modes have their own aperture&hellip; which <b>overlaps the text
  region</b>. The same memory cells serve both, on purpose, because
  that&rsquo;s genuinely how 1981 CGA hardware behaved &mdash; the
  aliasing is part of the machine being faithful.
</p>
<p>
  The pure-CSS painter above only draws Mode 13h. For the other modes
  the cabinet stores everything a renderer needs &mdash; including
  copying the current video mode and the CGA palette register into two
  spare bytes of the BIOS data area, so the outside of the machine can
  tell which screen the program meant. That register carries one
  famous bit: the choice between CGA&rsquo;s two four-colour palettes,
  green/red/yellow or cyan/magenta/white &mdash; the reason so many
  old PC games are those exact colours.
</p>

<h3 class="anatomy-head">The electron beam</h3>
<p>
  One more thing games ask the screen: &ldquo;is the monitor mid-redraw?&rdquo;
  A 1981 monitor painted the picture with an electron beam, top to
  bottom, 70 times a second &mdash; and games wait for the beam&rsquo;s
  flyback (the <i>vertical retrace</i>) to redraw without tearing.
  They poll a status port for it, constantly.
</p>
<p>
  There is no beam. The machine fakes its position from a number the
  CPU already tracks &mdash; the running count of cycles each
  instruction would have cost on the real 4.77&nbsp;MHz chip. One
  seventieth of a second is 68,182 cycles, and the beam spends about
  5% of each frame flying back, so:
</p>
<CodeCss code={RETRACE} />
<p>
  The electron beam of a CRT monitor, reduced to a <code>mod()</code>
  and a <code>sign()</code>. Games genuinely synchronise to it.
</p>
