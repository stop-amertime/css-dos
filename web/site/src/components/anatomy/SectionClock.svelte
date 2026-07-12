<script>
  // The clock — the four-keyframe animation (0.1 KB) and the three
  // memory sweeps it drives (43 MB). The four-variable ring
  // walk-through is the main body (owner: don't bury the mechanism
  // in a fold). Facts from CABINET-ANATOMY.md §4, §12, §14–16;
  // keyframe extracts verbatim from sokoban.css (names tidied to
  // flow order: --__0/--__2/--__1mc5000 → --mc5000_1/_2/-prev).
  import Callout from '../Callout.svelte';
  import CodeCss from '../CodeCss.svelte';
  import CycleDiagrams from './CycleDiagrams.svelte';
  import Foldable from '../Foldable.svelte';
  import SectionHead from '../SectionHead.svelte';
  import Term from '../Term.svelte';
  import { CELL_PLUMBING } from '../../lib/exhibits.js';

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

  const CONDUCTOR = `.motherboard {
  animation: store 1ms infinite, execute 1ms infinite;
  animation-play-state: paused, paused;
  @container style(--clock: 1) { animation-play-state: running, paused }
  @container style(--clock: 3) { animation-play-state: paused, running }`;
</script>

<Callout kind="tip" label="Fun fact">
  <p>
    Early experiments in CSS computation had no way to make time pass &mdash; the user had to repeatedly press buttons to advance the machine one cycle at a time, until this method of using animations and <code>@keyframes</code> was discovered.
  </p>
</Callout>

<p>
  Exactly one thing in CSS changes on its own: an <b>animation</b>. At the very bottom of the file, after 300&nbsp;MB of formulas, sits the thing that runs them &mdash; verbatim:
</p>
<CodeCss code={CLOCK_ANIM} />
<p>
  A counter ticking 0,&nbsp;1,&nbsp;2,&nbsp;3, forever. Each lap, every formula in the file re-evaluates once and the machine advances by one CPU instruction. These few lines are the smallest section of the <Term t="cabinet">cabinet</Term> and its only moving part.
</p>

<Foldable>
  {#snippet summary()}Why do we need four keyframes?{/snippet}
  <p class="dim small">
    This was previously covered in the &lsquo;How is this possible?&rsquo; page, but it belongs here too, so it&rsquo;s duplicated.
  </p>
  <p>
    Each tick, every value &mdash; register or memory cell &mdash; must be recomputed from its previous one. But a variable can&rsquo;t reference itself in CSS (in most other languages, it can!):
  </p>
  <CycleDiagrams panel="self" />
  <p>
    Well, that&rsquo;s easy to solve &mdash; just use a buffer, right? Hold the previous value of <code>--X</code> somewhere and copy from that? CSS doesn&rsquo;t like that either: it detects <i>cycles</i> too, of any length, and ignores them.
  </p>
  <CycleDiagrams panel="pair" />
  <p>
    What we need is a system that lets state through without ever, at any instant, having a complete route from start to end &mdash; a bit like an airlock:
  </p>
  <CycleDiagrams panel="ring" />
  <p>
    Here is one cell&rsquo;s full plumbing:
  </p>
  <CodeCss code={CELL_PLUMBING} />
  <p>
    Follow one lap. At the 25% keyframe, last lap&rsquo;s <code>_1</code> copies move into <code>_2</code> &mdash; and since every <code>-prev</code> is defined as its <code>_2</code>, every formula now reads the new state and re-evaluates. At the 75% keyframe, the freshly computed values are copied into <code>_1</code>. Repeat forever.
  </p>
  <p>
    The reason for the two-step handover: each copy is written at one keyframe and read at another, so nothing is ever read and overwritten at the same moment. The machine never sees a half-updated version of itself &mdash; every tick gets a clean before-picture, even though 368,256 cells and fourteen registers all change &ldquo;at once.&rdquo;
  </p>
</Foldable>

<Foldable>
  {#snippet summary()}The nitty-gritty: what actually freezes the copies{/snippet}
  <p>
    The <code>_1</code> and <code>_2</code> lines live inside the <code>store</code> and <code>execute</code> <code>@keyframes</code> blocks (attached to the machine permanently, paused &mdash; the wiring is at the bottom of this page). The load-bearing browser behaviour: while an animation is <i>running</i>, a <code>var()</code> inside its keyframes re-resolves continuously &mdash; the copy is a live wire, tracking its source. While it is <i>paused</i>, the browser stops re-resolving, and the copy simply holds its last value. The pause is the freeze &mdash; the only way in CSS to keep a value still.
  </p>
  <p>
    Why two copies between <code>--X</code> and <code>--X-prev</code>, not one? Because the four variables form a ring, and a ring whose links are all live at once is a circular reference no matter how many hops it has. With a single in-between copy, the moment its keyframe ran, every link would conduct at once &mdash; a cycle at the exact instant of handover, every tick. With two, unpaused strictly in turn, at least one link is frozen at every instant, and CSS never has a cycle to reject.
  </p>
  <p>
    The names here are tidied for reading. In the real file, <code>--X-prev</code>, <code>--X_1</code> and <code>--X_2</code> for memory cell 5000 are <code>--__1mc5000</code>, <code>--__0mc5000</code> and <code>--__2mc5000</code> &mdash; and only the base <code>--mc5000</code> is ever declared. The three copies have no <code>@property</code> block anywhere: an unregistered CSS variable springs into existence the first time something assigns it.
  </p>
  <p>
    And the very first tick? Neither copy animation has ever run, so nothing has ever been copied. That is what the <code>,&nbsp;32861</code> fallbacks riding in the plumbing lines are for: they supply each cell&rsquo;s power-on value until the real handover machinery delivers its first cargo.
  </p>
</Foldable>

<p>
  And that is where the 43&nbsp;MB goes: the animation is 0.1&nbsp;KB, but the three plumbing lines have to be written out per cell &mdash; three sweeps over all of memory (15 + 15 + 13&nbsp;MB). The registers get the same treatment in a much smaller block inside the CPU.
</p>

<p>
  One thing this animation is <i>not</i>: the time DOS sees. DOS gets its time from the simulated timer chip, which counts something else entirely &mdash; the <a href="#about/file/chipset">chipset section</a> covers it.
</p>

<SectionHead>How the store and execute steps get triggered</SectionHead>
<p>
  The store and execute steps are themselves <code>@keyframes</code> &mdash; and an animation can&rsquo;t call another animation. So the cabinet attaches both to the CPU permanently, <b>paused</b>, and the clock unpauses each one for a quarter of every lap &mdash; verbatim:
</p>
<CodeCss code={CONDUCTOR} />
