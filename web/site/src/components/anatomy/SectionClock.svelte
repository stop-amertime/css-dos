<script>
  // The clock — the four-beat animation (0.1 KB) and the three
  // memory sweeps it drives (43 MB). The snapshot/staged/held
  // walk-through is the main body (owner: don't bury the mechanism
  // in a fold). Facts from CABINET-ANATOMY.md §4, §12, §14–16;
  // keyframe extracts verbatim from sokoban.css (names tidied:
  // --__1mc5000 → --snapshot-mc5000).
  import Foldable from '../Foldable.svelte';
  import TickClock from '../TickClock.svelte';
  import CodeCss from '../CodeCss.svelte';
  import Term from '../Term.svelte';

  const CLOCK_ANIM = `.clock {
  animation: anim-play 400ms steps(4, jump-end) infinite;
  --clock: 0;
}

@keyframes anim-play {
  0% { --clock: 0 }
  25% { --clock: 1 }
  50% { --clock: 2 }
  75% { --clock: 3 }
}`;

  const CELL_PLUMBING = `/* always in force: the snapshot — the copy every formula reads —
   is wired to the staged copy from last tick */
--snapshot-mc5000: var(--staged-mc5000, 32861);

/* always in force: the next value, computed from snapshots only
   (this is the write formula from the write-formulas section) */
--mc5000: …;

/* beat 3 — the "execute" keyframe: park the computed value */
--held-mc5000: var(--mc5000);

/* beat 1 — the "store" keyframe: stage the parked value
   so it becomes the NEXT tick's snapshot */
--staged-mc5000: var(--held-mc5000, 32861);`;

  const CYCLE_ROWS = `style(--opcode: 144): calc(var(--snapshot-cycleCount) + 3);   /* NOP: 3 cycles */
style(--opcode: 136): calc(var(--snapshot-cycleCount)
  + if(style(--mod: 3): 2; else: 9));   /* MOV: 2 — or 9 if memory is involved */
style(--opcode: 212): calc(var(--snapshot-cycleCount) + 83);  /* AAM: 83 — division was expensive */`;

  const CONDUCTOR = `.cpu {
  animation: store 1ms infinite, execute 1ms infinite;
  animation-play-state: paused, paused;
  @container style(--clock: 1) { animation-play-state: running, paused }
  @container style(--clock: 3) { animation-play-state: paused, running }`;
</script>

<p>
  Exactly one thing in CSS changes on its own: an <b>animation</b>. At
  the very bottom of the file, after 300&nbsp;MB of formulas, sits the
  thing that runs them &mdash; verbatim:
</p>
<CodeCss code={CLOCK_ANIM} />
<p>
  A counter ticking 0,&nbsp;1,&nbsp;2,&nbsp;3, forever. Each lap, every
  formula in the file re-evaluates once and the machine advances by one
  CPU instruction. These few lines are the smallest section of the
  <Term t="cabinet">cabinet</Term> and its only moving part.
</p>

<h3 class="anatomy-head">Why four beats and not one?</h3>
<p>
  Because a formula isn&rsquo;t allowed to refer to itself. A memory
  cell&rsquo;s next value is computed from its current one &mdash; but
  written as one variable, that&rsquo;s a circular definition, and CSS
  rejects it. So every cell exists as <b>several</b> variables: the
  copy the formulas read, and the copies used to hand each
  tick&rsquo;s results across to the next tick. Here is one cell&rsquo;s
  full plumbing:
</p>
<CodeCss code={CELL_PLUMBING} />
<p>
  Follow one lap of the clock. The formulas compute the whole
  machine&rsquo;s next state, reading only the frozen snapshots. On
  beat 3, the results are parked in the <i>held</i> copies. On beat 1
  of the next lap, the parked values move into the <i>staged</i>
  copies &mdash; and since the snapshots are wired to those, every
  formula now sees the new state, and computes the tick after. Round
  and round.
</p>
<p>
  The reason for the two-step handover: each copy is written at one
  beat and read at another, so nothing is ever read and overwritten at
  the same moment. The machine never sees a half-updated version of
  itself &mdash; every tick gets a clean before-picture, even though
  368,256 cells and fourteen registers all change &ldquo;at
  once.&rdquo;
</p>

<TickClock />

<p>
  And that is where the 43&nbsp;MB goes: the animation is 0.1&nbsp;KB,
  but the three plumbing lines have to be written out per cell &mdash;
  three sweeps over all of memory (15 + 15 + 13&nbsp;MB). The registers
  get the same treatment in a much smaller block inside the CPU.
</p>

<h3 class="anatomy-head">The other clock &mdash; the one DOS sees</h3>
<p>
  The animation is the machine&rsquo;s heartbeat, but DOS has never
  heard of it. What DOS expects is the PC&rsquo;s <b>timer chip</b>,
  interrupting it 18.2 times a second &mdash; that&rsquo;s how it
  keeps the time of day, and how games pace themselves. CSS can&rsquo;t
  read a wall clock, so the timer is derived from a number the CPU
  already tracks: a running tally of the cycles each instruction
  <i>would have cost</i> on the real 4.77&nbsp;MHz chip.
</p>
<p>
  The tally is one more register table &mdash; every
  instruction&rsquo;s row adds what Intel&rsquo;s 1978 manual billed
  for it:
</p>
<CodeCss code={CYCLE_ROWS} />
<p>
  The gearing is real 1981 engineering: the PC&rsquo;s timer chip ran
  at exactly one quarter of the CPU&rsquo;s clock, so the
  machine&rsquo;s timer ticks are simply
  <code>cycleCount&nbsp;/&nbsp;4</code>. The chip is simulated down to
  its quirks &mdash; in its default square-wave mode the counter
  genuinely counts down by <i>two</i> per tick, and its 16-bit reload
  value has to arrive as two separate byte writes before the count
  starts, just like the real part. Every time the counter crosses
  zero, the timer interrupt fires and DOS&rsquo;s clock advances.
</p>
<p>
  So the machine keeps two times: the CSS animation decides how fast
  the world computes, and the cycle counter decides what the software
  <i>believes</i> the time is. Evaluate the file faster and everything
  speeds up together, still in step &mdash; DOS&rsquo;s sense of time
  is tied to work done, not to your wall clock.
</p>

<Foldable>
  {#snippet summary()}How one animation conducts two more{/snippet}
  <p>
    The store and execute steps are themselves <code>@keyframes</code>
    &mdash; and an animation can&rsquo;t call another animation. So the
    cabinet attaches both to the CPU permanently, <b>paused</b>, and
    the clock unpauses each one for a single beat &mdash; verbatim:
  </p>
  <CodeCss code={CONDUCTOR} />
</Foldable>
