<script>
  // The chipset — the support chips around the CPU: timer (PIT),
  // interrupt controller (PIC), keyboard controller, VGA palette DAC.
  // Split out of SectionCpu 2026-07-10 when kiln gave these tables
  // their own .motherboard rule (the CPU proper lives in .cpu — both
  // classes on the same player element). Extracts verbatim from
  // sokoban.css (names tidied per the CPU section's NOTE callout).
  import CodeCss from '../CodeCss.svelte';
  import TreeView from './tree/TreeView.svelte';
  import { CHIPSET_TREE, CHIPSET_TREE_META } from './tree/chipset-tree.js';

  const CHIP_VARS = `--picMask --picPending --picInService     /* interrupt controller */
--pitMode --pitReload --pitCounter …      /* timer chip */
--prevKeyboard --kbdScancodeLatch …       /* keyboard controller */
--dacWriteIndex --dacSubIndex …           /* VGA palette chip */`;

  const PIT_COUNTER = `--pitCounter: if(
  /* … rows for the OUT opcodes that program the timer … */
  else: if(
    style(--snapshot-pitReload: 0): 0;   /* never armed — hold at zero */
    else: calc(var(--snapshot-pitCounter) - var(--_pitDecrement)
      + max(0, sign(calc(var(--_pitDecrement) - var(--snapshot-pitCounter) + 1)))
        * var(--snapshot-pitReload))));  /* count down; past zero, reload — and IRQ 0 fires */`;
</script>

<TreeView nodes={CHIPSET_TREE} bytes={CHIPSET_TREE_META.bytes} />

<p>
  A PC was never one chip. Around the CPU sits a small crowd of
  support silicon, and &rsquo;80s programs talk to it directly: they
  program a <b>timer chip</b> to interrupt them 18.2 times a second,
  tell the <b>interrupt controller</b> which events to let through,
  stream colours into the <b>VGA palette</b>. Each of those chips is
  simulated the same way the registers are &mdash; a few more
  variables, with tables describing what the silicon would have done:
</p>
<CodeCss code={CHIP_VARS} />
<p>
  All of it fits in about 16&nbsp;KB &mdash; its own little block in
  the file, between the CPU and the keyboard. (The keyboard
  controller&rsquo;s input side and the palette&rsquo;s colour maths
  have their own pages: <a href="#about/file/keys">keyboard</a>,
  <a href="#about/file/screen">screen</a>.)
</p>

<h3 class="anatomy-head">Busy even when idle</h3>
<p>
  A CPU register&rsquo;s table ends with &ldquo;otherwise, keep the
  old value&rdquo; &mdash; if the current instruction doesn&rsquo;t
  touch it, nothing happens. The chips are different: real hardware
  runs whether or not the program is paying attention. Their tables
  end with a fall-through that <i>does work</i>. The timer&rsquo;s
  table has rows for the OUT instructions that program it, and when
  none of them fire &mdash; almost every tick &mdash; it counts down
  instead:
</p>
<CodeCss code={PIT_COUNTER} />
<p>
  Every time the counter crosses zero it reloads itself and raises
  IRQ&nbsp;0 &mdash; the tick DOS keeps its clock by. The interrupt
  controller&rsquo;s fall-through latches any newly arrived interrupt
  requests; the keyboard controller&rsquo;s snapshots the current key
  so the next tick can spot the change. The chips&rsquo;
  <code>else</code> branches are where the machine&rsquo;s
  concurrency lives.
</p>
