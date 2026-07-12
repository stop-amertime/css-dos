<script>
  // The chipset — the support chips around the CPU: timer (PIT),
  // interrupt controller (PIC), keyboard controller, VGA palette DAC.
  // Split out of SectionCpu 2026-07-10 when kiln gave these tables
  // their own .motherboard rule (the CPU proper lives in .cpu — both
  // classes on the same player element). Extracts verbatim from
  // sokoban.css (names tidied per the CPU section's NOTE callout).
  import CodeCss from '../CodeCss.svelte';
  import SectionHead from '../SectionHead.svelte';
  import TreeView from './tree/TreeView.svelte';
  import { CHIPSET_TREE, CHIPSET_TREE_META } from './tree/chipset-tree.js';

  const CHIP_VARS = `--picMask --picPending --picInService     /* interrupt controller */
--pitMode --pitReload --pitCounter …      /* timer chip */
--prevKeyboard --kbdScancodeLatch …       /* keyboard controller */
--dacWriteIndex --dacSubIndex …           /* VGA palette chip */`;

  const PIT_COUNTER = `--pitCounter: if(
  /* … rows for the OUT opcodes that program the timer … */
  else: if(
    style(--pitReload-prev: 0): 0;   /* never armed — hold at zero */
    else: calc(var(--pitCounter-prev) - var(--_pitDecrement)
      + max(0, sign(calc(var(--_pitDecrement) - var(--pitCounter-prev) + 1)))
        * var(--pitReload-prev))));  /* count down; past zero, reload — and IRQ 0 fires */`;

  const CYCLE_ROWS = `style(--opcode: 144): calc(var(--cycleCount-prev) + 3);   /* NOP: 3 cycles */
style(--opcode: 136): calc(var(--cycleCount-prev)
  + if(style(--mod: 3): 2; else: 9));   /* MOV: 2 — or 9 if memory is involved */
style(--opcode: 212): calc(var(--cycleCount-prev) + 83);  /* AAM: 83 — division was expensive */`;
</script>

<TreeView nodes={CHIPSET_TREE} title="Chipset" bytes={CHIPSET_TREE_META.bytes} />

<p>
  A PC was never one chip. Around the CPU sits a small crowd of support silicon, and &rsquo;80s programs talk to it directly: they program a <b>timer chip</b> to interrupt them 18.2 times a second, tell the <b>interrupt controller</b> which events to let through, stream colours into the <b>VGA palette</b>. Each of those chips is simulated the same way the registers are &mdash; a few more variables, with tables describing what the silicon would have done:
</p>
<CodeCss code={CHIP_VARS} />
<p>
  All of it fits in about 19&nbsp;KB &mdash; its own little block in the file, between the CPU and the keyboard. (The keyboard controller&rsquo;s input side and the palette&rsquo;s colour maths have their own pages: <a href="#about/file/keys">keyboard</a>, <a href="#about/file/screen">screen</a>.)
</p>

<SectionHead>Busy even when idle</SectionHead>
<p>
  A CPU register&rsquo;s table ends with &ldquo;otherwise, keep the old value&rdquo; &mdash; if the current instruction doesn&rsquo;t touch it, nothing happens. The chips are different: real hardware runs whether or not the program is paying attention. Their tables end with a fall-through that <i>does work</i>. The timer&rsquo;s table has rows for the OUT instructions that program it, and when none of them fire &mdash; almost every tick &mdash; it counts down instead:
</p>
<CodeCss code={PIT_COUNTER} />
<p>
  Every time the counter crosses zero it reloads itself and raises IRQ&nbsp;0 &mdash; the tick DOS keeps its clock by. The interrupt controller&rsquo;s fall-through latches any newly arrived interrupt requests; the keyboard controller&rsquo;s copies the current key so the next tick can spot the change. The chips&rsquo; <code>else</code> branches are where the machine&rsquo;s concurrency lives.
</p>

<SectionHead>Where the timer&rsquo;s ticks come from</SectionHead>
<p>
  The countdown above needs something to count, and CSS can&rsquo;t read a wall clock. So the timer is derived from a number the CPU already tracks: a running tally of the cycles each instruction <i>would have cost</i> on the real 4.77&nbsp;MHz chip. The tally is one more register table &mdash; every instruction&rsquo;s row adds what Intel&rsquo;s 1978 manual billed for it:
</p>
<CodeCss code={CYCLE_ROWS} />
<p>
  The gearing is real 1981 engineering: the PC&rsquo;s timer chip ran at exactly one quarter of the CPU&rsquo;s clock, so the timer&rsquo;s ticks are simply <code>cycleCount&nbsp;/&nbsp;4</code>. The chip is simulated down to its quirks &mdash; in its default square-wave mode the counter genuinely counts down by <i>two</i> per tick, and its 16-bit reload value has to arrive as two separate byte writes before the count starts, just like the real part.
</p>
<p>
  So the machine keeps two times: the <a href="#about/file/clock">clock animation</a> decides how fast the world computes, and the cycle tally decides what the software <i>believes</i> the time is. Evaluate the file faster and everything speeds up together, still in step &mdash; DOS&rsquo;s sense of time is tied to work done, not to your wall clock.
</p>
