<script>
  // The clock — the four-beat animation (0.1 KB) and the three
  // memory sweeps it drives (43 MB). Copy recycled from the retired
  // "Stumbling block" page; facts from CABINET-ANATOMY.md §4, §12,
  // §14–16.
  import Foldable from '../Foldable.svelte';
  import TickClock from '../TickClock.svelte';
</script>

<p>
  Exactly one thing in CSS changes on its own: an <b>animation</b>. At
  the very bottom of the file, after 300&nbsp;MB of formulas, sits the
  thing that runs them &mdash; an animation ticking a counter
  0,&nbsp;1,&nbsp;2,&nbsp;3, forever:
</p>
<pre class="byte-example"><code>@keyframes <span class="tok-prop">anim-play</span> {'{'}
  <span class="tok-num">0%</span>   {'{'} <span class="tok-prop">--clock</span>: <span class="tok-num">0</span> {'}'}
  <span class="tok-num">25%</span>  {'{'} <span class="tok-prop">--clock</span>: <span class="tok-num">1</span> {'}'}
  <span class="tok-num">50%</span>  {'{'} <span class="tok-prop">--clock</span>: <span class="tok-num">2</span> {'}'}
  <span class="tok-num">75%</span>  {'{'} <span class="tok-prop">--clock</span>: <span class="tok-num">3</span> {'}'}
{'}'}</code></pre>
<p>
  Each lap of the counter, every formula in the file re-evaluates once,
  and the machine advances by one CPU instruction. These thirty lines
  are the smallest section of the cabinet and its only moving part.
</p>

<h3 class="anatomy-head">Why four beats and not one?</h3>
<p>
  A formula isn&rsquo;t allowed to refer to itself, so the machine
  keeps two copies of everything: results land in a <b>buffer</b>, and
  the buffer only becomes the next <b>snapshot</b> &mdash; the copy
  every formula reads &mdash; after everything has finished reading the
  old one. Nothing is ever copied from and written to at the same
  moment. The four beats sequence that handover:
</p>

<TickClock />

<Foldable>
  {#snippet summary()}Where the 43 MB goes{/snippet}
  <p>
    The animation itself is 0.1&nbsp;KB. The cost is that the
    snapshot-and-buffer shuffle has to be written out <b>per memory
    cell</b>, three separate times &mdash; one line each in three
    sweeps over all of memory:
  </p>
  <pre class="byte-example"><code><span class="tok-comment">/* read sweep (15 MB): this tick's snapshot comes from the staged copy */</span>
<span class="tok-prop">--snapshot-mc5000</span>: var(<span class="tok-prop">--staged-mc5000</span>, <span class="tok-num">32861</span>);

<span class="tok-comment">/* store keyframe (15 MB): stage last tick's result */</span>
<span class="tok-prop">--staged-mc5000</span>: var(<span class="tok-prop">--held-mc5000</span>, <span class="tok-num">32861</span>);

<span class="tok-comment">/* execute keyframe (13 MB): commit this tick's computed value */</span>
<span class="tok-prop">--held-mc5000</span>: var(<span class="tok-prop">--mc5000</span>);</code></pre>
  <p>
    Multiply three short lines by hundreds of thousands of cells and
    you get 43&nbsp;MB &mdash; the price of every tick reading a clean
    before-picture of the machine. (The registers get the same
    treatment in a much smaller block inside the CPU.)
  </p>
</Foldable>
