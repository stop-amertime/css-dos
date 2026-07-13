<script>
  // The screen — 64,000 divs, each a CSS rule reading video memory.
  // Copy recycled from the retired "Screen, keys, time" page; facts
  // from CABINET-ANATOMY.md §8.
  import Foldable from '../Foldable.svelte';
  import PixelScreen from '../PixelScreen.svelte';
  import CodeCss from '../CodeCss.svelte';
  import SectionHead from '../SectionHead.svelte';
  import Term from '../Term.svelte';

  const RETRACE = `/* in retrace? — 1 while the beam would be flying back */
max(0, sign(3409 - mod(var(--cycleCount-prev), 68182)))`;

  const PIXEL_RULE = `#p31840 { --ci: mod(var(--mc343600-prev), 256); background-color: --screenPx(var(--vidMode), var(--ci), mod(var(--mc382908-prev), 256), var(--mc377332-prev), var(--mc377832-prev), 3, 128, 128, var(--vidPal)); }`;

  const PALETTE_FN = `@function --paletteRGB(--idx <integer>) returns <color> {
  result: if(
    style(--idx: 0): rgb(round(mod(var(--mc524288-prev), 256) * 255 / 63)
                         round(round(down, var(--mc524288-prev) / 256) * 255 / 63)
                         round(mod(var(--mc524289-prev), 256) * 255 / 63));
    /* … all 256 palette slots … */
    else: rgb(0 0 0));
}`;

  const DAC_SUBINDEX = `--dacSubIndex: if(
  style(--q1: 968): 0;                                      /* OUT 0x3C8: new colour slot — reset */
  style(--q1: 967): 0;                                      /* OUT 0x3C7 (read cursor) also resets */
  style(--q1: 969) and style(--dacSubIndex-prev: 2): 0; /* blue just landed: wrap to red… */
  style(--q1: 969): calc(var(--dacSubIndex-prev) + 1);  /* …otherwise advance R→G→B */
  else: var(--dacSubIndex-prev));`;
</script>

<p>
  Mercifully, the one thing CSS was actually built for is to colour boxes. If you think about it, pixels are just coloured boxes. So the screen is a 320&times;200 grid of <code>&lt;div&gt;</code> elements, each one a pixel: 64,000 of them. Each simply reads the relevant byte of video-specific memory (aka Video RAM, aka VRAM):
</p>

<PixelScreen />

<p>
  Each rule reads its pixel&rsquo;s bytes of video memory and turns them into a colour for whichever screen mode the machine is currently in &mdash; the 256-colour game mode shown here, the DOS text screen (glyphs drawn from an 8&times;8 ROM font baked into the file), or the old four-colour CGA modes. No image, no canvas &mdash; when a game draws, it writes bytes, and divs change colour. These 64,000 rules are 14&nbsp;MB of the file, and they&rsquo;re always in it &mdash; this is the pure-CSS renderer, proven to paint in real Chromium.
</p>
<p>
  Each rule is one line. Pixel 31,840 &mdash; row 99, column 160, the middle of the screen &mdash; is:
</p>
<CodeCss code={PIXEL_RULE} />
<p>
  <code>mod()</code> digs the pixel&rsquo;s byte out of its packed memory cell, and <code>--screenPx()</code> &mdash; the mode dispatcher &mdash; decides what the bytes mean. <code>--vidMode</code> is the machine&rsquo;s current video mode: in the 256-colour game mode it hands <code>--ci</code> to the palette function below; in text mode it reads the character cell instead and looks the glyph row up in the ROM font; in CGA it unpacks two-bit pixels. One rule, every screen the machine can show.
</p>

<SectionHead>The palette &mdash; how 256 colours get chosen</SectionHead>
<p>
  Older programs were limited to 256 colours at once, which isn&rsquo;t very many. They could at least choose WHICH 256 colours they wanted to use. That list of colours is the &lsquo;palette&rsquo;, and the pixel&rsquo;s byte references a colour from that list (0&ndash;255). To set one colour, the program writes three bytes &mdash; red, green, blue &mdash; to a single port, while a small counter steps 0, 1, 2 and rolls over to the next colour slot. When a game fades to black, it is re-streaming the whole table a little darker, over and over.
</p>
<p>
  The lookup itself is a shared 256-way <code>if()</code> function, <code>--paletteRGB</code>, that turns the live palette into an actual <code>rgb(&hellip;)</code> value for each div:
</p>
<CodeCss code={PALETTE_FN} />
<p>
  The mess inside <code>rgb()</code> is three live memory reads &mdash; red, green, blue &mdash; each scaled by 255/63 because a real VGA&rsquo;s palette chip only kept six bits per channel: programs wrote brightnesses from 0 to 63, and the machine honours that.
</p>
<p class="dim small">
  Of the file&rsquo;s thousands of functions, only three return a colour &mdash; this one, its fixed 16-colour cousin <code>--vgaRGB</code> (text and CGA modes), and the <code>--screenPx</code> dispatcher itself. All the others just return integers.
</p>
<Foldable>
  {#snippet summary()}The palette read-back cursor{/snippet}
  <p>
    There&rsquo;s a second, separate cursor for <i>reading</i> the palette back &mdash; a fade effect needs to read the current colours before dimming them, and real VGA hardware let it ask without disturbing the write cursor. If real hardware did it, we have to support it too.
  </p>
</Foldable>

<SectionHead>Counting to three</SectionHead>
<p>
  From the CPU&rsquo;s side, we have three consecutive OUTs to the same port, each carrying a bare number. Nothing about the third write says &ldquo;I am a blue&rdquo;. On real hardware the chip counts them privately. In CSS, we call in the usual suspects: the cursor and its R/G/B counter are just two more register-style variables, handled manually.
</p>
<CodeCss code={DAC_SUBINDEX} />

<SectionHead>Text mode &amp; CGA &mdash; the shared bytes</SectionHead>
<p>
  <Term t="mode13h">Mode 13h</Term> isn&rsquo;t the only screen the machine carries. Text mode &mdash; the 80&times;25 grid the DOS prompt lives on &mdash; is its own region of video memory at a different address: two bytes per character, the letter and its colours. And the older CGA graphics modes have their own aperture which <b>overlaps the text region</b>. Yikes. That&rsquo;s how 1981 CGA hardware behaved, since RAM was scarce and you can&rsquo;t use both modes at once. We must mimic it faithfully.
</p>
<p>
  The overlap is authentic; what comes next isn&rsquo;t. On a real PC, a program&rsquo;s <code>OUT 0x3D9, AL</code> lands in a register <i>inside</i> the CGA chip, and the same chip uses it as it paints &mdash; the hardware that receives the setting is the hardware that draws. CSS-DOS has no such chip, and its screen is drawn by something else entirely: a separate renderer that reads the finished video memory. So the machine leaves that renderer a note. On the <code>OUT</code>, it copies the value into a spare byte of the BIOS data area, and does the same for the current video mode &mdash; two shadow bytes recording what the program <i>asked for</i>, so whatever draws the screen can tell which of these overlapping modes it meant. Both readers use it: the fast external renderer, and the 64,000 pixel rules above, whose <code>--vidMode</code> and <code>--vidPal</code> are exactly these two bytes. A real PC needs no such note, because there the sender and the painter are one piece of silicon.
</p>
<p>
  That palette byte carries one famous bit: the choice between CGA&rsquo;s two four-colour palettes &mdash; green/red/yellow or cyan/magenta/white &mdash; the reason so many old PC games are those exact colours.
</p>

<SectionHead>The electron beam</SectionHead>
<p>
  An 80s monitor painted the picture with an electron beam, top to bottom, 70 times a second &mdash; and games wait for the beam&rsquo;s flyback (the <i>vertical retrace</i>) to redraw without tearing. They poll a status port for this information.
</p>
<p>
  We fake its position from a number the CPU already tracks &mdash; the running count of cycles each instruction would have cost on the real 4.77&nbsp;MHz chip. One seventieth of a second is 68,182 cycles, and the beam spends about 5% of each frame flying back &mdash; 5% of 68,182 is 3,409 cycles &mdash; so:
</p>
<CodeCss code={RETRACE} />
