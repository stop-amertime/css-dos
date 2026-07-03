<script>
  // The clock — the four-beat animation (0.1 KB) and the three
  // memory sweeps it drives (43 MB). The snapshot/staged/held
  // walk-through is the main body (owner: don't bury the mechanism
  // in a fold). Facts from CABINET-ANATOMY.md §4, §12, §14–16;
  // keyframe extracts verbatim from sokoban.css (names tidied:
  // --__1mc5000 → --snapshot-mc5000).
  import Foldable from '../Foldable.svelte';
  import TickClock from '../TickClock.svelte';
</script>

<p>
  Exactly one thing in CSS changes on its own: an <b>animation</b>. At
  the very bottom of the file, after 300&nbsp;MB of formulas, sits the
  thing that runs them &mdash; verbatim:
</p>
<pre class="byte-example"><code><span class="tok-prop">.clock</span> {'{'}
  animation: <span class="tok-prop">anim-play</span> <span class="tok-num">400ms</span> steps(<span class="tok-num">4</span>, jump-end) infinite;
  <span class="tok-prop">--clock</span>: <span class="tok-num">0</span>;
{'}'}

@keyframes <span class="tok-prop">anim-play</span> {'{'}
  <span class="tok-num">0%</span> {'{'} <span class="tok-prop">--clock</span>: <span class="tok-num">0</span> {'}'}
  <span class="tok-num">25%</span> {'{'} <span class="tok-prop">--clock</span>: <span class="tok-num">1</span> {'}'}
  <span class="tok-num">50%</span> {'{'} <span class="tok-prop">--clock</span>: <span class="tok-num">2</span> {'}'}
  <span class="tok-num">75%</span> {'{'} <span class="tok-prop">--clock</span>: <span class="tok-num">3</span> {'}'}
{'}'}</code></pre>
<p>
  A counter ticking 0,&nbsp;1,&nbsp;2,&nbsp;3, forever. Each lap, every
  formula in the file re-evaluates once and the machine advances by one
  CPU instruction. These few lines are the smallest section of the
  cabinet and its only moving part.
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
<pre class="byte-example"><code><span class="tok-comment">/* always in force: the snapshot — the copy every formula reads —
   is wired to the staged copy from last tick */</span>
<span class="tok-prop">--snapshot-mc5000</span>: var(<span class="tok-prop">--staged-mc5000</span>, <span class="tok-num">32861</span>);

<span class="tok-comment">/* always in force: the next value, computed from snapshots only
   (this is the write formula from the write-formulas section) */</span>
<span class="tok-prop">--mc5000</span>: &hellip;;

<span class="tok-comment">/* beat 3 — the "execute" keyframe: park the computed value */</span>
<span class="tok-prop">--held-mc5000</span>: var(<span class="tok-prop">--mc5000</span>);

<span class="tok-comment">/* beat 1 — the "store" keyframe: stage the parked value
   so it becomes the NEXT tick's snapshot */</span>
<span class="tok-prop">--staged-mc5000</span>: var(<span class="tok-prop">--held-mc5000</span>, <span class="tok-num">32861</span>);</code></pre>
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

<Foldable>
  {#snippet summary()}How one animation conducts two more{/snippet}
  <p>
    The store and execute steps are themselves <code>@keyframes</code>
    &mdash; and an animation can&rsquo;t call another animation. So the
    cabinet attaches both to the CPU permanently, <b>paused</b>, and
    the clock unpauses each one for a single beat &mdash; verbatim:
  </p>
  <pre class="byte-example"><code><span class="tok-prop">.cpu</span> {'{'}
  animation: <span class="tok-prop">store</span> <span class="tok-num">1ms</span> infinite, <span class="tok-prop">execute</span> <span class="tok-num">1ms</span> infinite;
  animation-play-state: paused, paused;
  @container style(<span class="tok-prop">--clock</span>: <span class="tok-num">1</span>) {'{'} animation-play-state: running, paused {'}'}
  @container style(<span class="tok-prop">--clock</span>: <span class="tok-num">3</span>) {'{'} animation-play-state: paused, running {'}'}</code></pre>
</Foldable>
