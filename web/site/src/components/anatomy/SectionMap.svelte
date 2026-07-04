<script>
  // The map — the carousel's landing page. Orients the reader on the
  // bar, defines the project's three working words (glossary callout),
  // and plants the one-definition fact that the 171 MB payoff at the
  // end of the tour depends on. Not a file section (no bytes of its
  // own) — see router FILE_SECTIONS vs anatomy/groups.js.
</script>

<p>
  The bar above is the whole cabinet &mdash; a real build (Sokoban,
  309&nbsp;MB), drawn to scale, in file order. Click any stripe, or
  use the arrows to walk the sections in order.
</p>

<div class="callout">
  <span class="callout-label">GLOSSARY</span>
  <p>
    <b>Cart</b> &mdash; the program you feed in: a folder of DOS-era
    files, picked or uploaded on the Build page.
  </p>
  <p>
    <b>Cabinet</b> &mdash; the <code>.css</code> file that comes out:
    the machine and the cart&rsquo;s floppy disk fused into one
    object, the way an arcade cabinet is a computer and one game sold
    as a single box. This tour walks through a cabinet.
  </p>
  <p>
    <b>Tick</b> &mdash; one beat of the machine: every formula in the
    file re-evaluates once, and one CPU instruction executes. The
    clock section shows what does the beating.
  </p>
</div>

<p>
  Two things are worth knowing before you go in. First, the thinking
  is nearly free: the CPU &mdash; every register, every instruction
  &mdash; is the hairline at the bar&rsquo;s left edge, 255&nbsp;KB,
  under a tenth of a percent of the file. Second, one fact of CSS
  explains most of the rest: a variable can be defined exactly once.
  There is no <code>x&nbsp;=&nbsp;y</code> &mdash; every variable is a
  single formula that has to anticipate, in advance, everything that
  could ever happen to it. The biggest stripe, 171&nbsp;MB of dark
  blue, is the price of that, and it&rsquo;s the last stop on the
  tour.
</p>
