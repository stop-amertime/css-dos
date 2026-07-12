<script>
  // How is this possible? — the one-tool idea and the numbered
  // problems. The code exhibits live in lib/exhibits.js.
  import Callout from '../../components/Callout.svelte';
  import CodeCss from '../../components/CodeCss.svelte';
  import CssTimeline from '../../components/CssTimeline.svelte';
  import CycleDiagrams from '../../components/anatomy/CycleDiagrams.svelte';
  import Foldable from '../../components/Foldable.svelte';
  import MoonViz from '../../components/MoonViz.svelte';
  import ProblemBox from '../../components/ProblemBox.svelte';
  import ReassignViz from '../../components/ReassignViz.svelte';
  import Term from '../../components/Term.svelte';
  import { AND_FULL_EXHIBIT } from '../../lib/exhibits.js';
</script>

<div class="subpage">
  <h1>How is this possible?</h1>
  <p>
    <Term t="css">CSS</Term> is designed to style websites (e.g. &lsquo;make a box blue&rsquo;), not to compute anything. But, some basic tools have been added across thirty years:
  </p>
  <CssTimeline />
  <p style="margin-top:16px">
    A pitifully small set of tools for such a large job. But our best tool is <i>perseverance</i>. A better tool would solve a problem in one hit &mdash; instead, we just brute force the problem with millions of hits until it&rsquo;s fixed. That&rsquo;s why the file is an appalling 300+&nbsp;MB of text:
  </p>
  <MoonViz />
  <p>
    So, let&rsquo;s say we want to run DOOM in CSS. What is stopping us? After all, CSS is a programming language, and DOOM is a program, right? Well, let&rsquo;s take it one problem at a time:
  </p>

  <ProblemBox tag="Problem 1">CSS can&rsquo;t do lists of instructions</ProblemBox>
  <p>
    CSS declares properties once and forever &mdash; size, font, colour &mdash; with no step-by-step workflows. A huge pain in the arse for programs, which are lists of instructions by definition. CSS is conceptually more like a spreadsheet (bear with me) &mdash; each cell/property can have a formula which works out its value, and they can even reference each other, but you can&rsquo;t write a <i>program</i> because there is no order to any of it &mdash; it just exists, recalculating in response to input, but not having a direction of travel of its own.
  </p>
  <p>
    <b>The solution is the philosophical cornerstone of this project: instead of running programs, reconstruct an entire computer &mdash; CPU, RAM, PIT, PIC, etc.</b> and then run the programs on <i>that</i> simulated computer.
  </p>
  <p>
    This sounds a bizarre detour, but: a CPU is a fixed circuit whose outputs are always a function of its inputs. Programs are a terrible fit for CSS, but circuits are a surprisingly natural one. The dream is: if we can just emulate all the components of a PC 1:1, code should just&hellip; run on it.
  </p>
  <Callout kind="tip" label="Fun fact">
    <p>
      Recreating a computer is technically possible, as CSS is &lsquo;Turing complete&rsquo;. It&rsquo;s like saying &lsquo;anywhere is walking distance, if you have the time&rsquo;.
    </p>
  </Callout>
  <p>
    And so, we embark on a journey: mimicking the entire hardware of a computer and all its foibles 1:1, cobbling together a processor, re-creating the RAM, the clock, the PIT, PIC, screen, keyboard, and so on.
  </p>
  <Callout kind="info">
    <p>
      Lyra Rebane first built a <a href="https://lyra.horse/x86css/" class="ext-link" target="_blank" rel="noopener">CSS x86 CPU</a> with a partial instruction set &mdash; CSS-DOS completes the instruction set, and adds everything required (chipset, 640K RAM, CGA graphics, etc.) to boot real &rsquo;80s software.
    </p>
  </Callout>
  <p>
    CSS doesn&rsquo;t even have an AND operator. Let&rsquo;s see how we might implement that.
  </p>
  <Foldable>
    {#snippet summary()}Just a taste: the AND function{/snippet}
    <p>
      Let&rsquo;s take a look at one of the simplest functions possible &mdash; AND. In most programming languages, this is just <code>a &amp; b</code>. The code required for AND to work in CSS is attached below.
    </p>
    <p>
      Bear in mind: <b>this isn&rsquo;t a CPU instruction &mdash; it&rsquo;s just one helper @function.</b> The actual AND X,Y <i>instruction</i> is implemented across many CPU registers, which each individually compute what happens to them if and when the current CPU instruction is &lsquo;AND X,Y&rsquo;.
    </p>
    <CodeCss code={AND_FULL_EXHIBIT} />
    <p>
      The little helpers at the top (<code>--lowerBytes</code>, <code>--rightShift</code>, <code>--bit</code>) are helpers &mdash; chop-to-N-bits, shift, extract-one-bit &mdash; each built from division and remainder. Then <code>--and</code> itself: thirty-two bit extractions, sixteen multiplications, one weighted sum. Below it, <code>--parity</code>: the 8086 reports whether a result has an even number of 1-bits, and nothing in CSS can count bits, so all 256 possible answers were worked out in advance and written into a 256-arm <code>if()</code>. Last, <code>--andFlags16</code> &mdash; the bookkeeping a real chip does as a free side effect of its silicon (did the result hit zero? go negative?), reconstructed as arithmetic.
    </p>
  </Foldable>

  <p>
    Here&rsquo;s a quick overview on how the basic components work around the limitation of &lsquo;no lists of instructions&rsquo;:
  </p>

  <ul class="sim-list bracket-list">
    <li><b>Clock:</b> an animation ticks a counter, and every formula in the file re-evaluates each tick (<a href="#about/file/clock">the clock</a>)</li>
    <li><b>CPU Registers:</b> each a set of formulas including every possible processor instruction that could change them, and how to calculate their resultant value. Those instructions are cobbled together with a combination of <code>if()</code> statements, calc, mod (remainder) and round (<a href="#about/file/cpu">the CPU</a>)</li>
    <li><b>RAM:</b> a titanic list of hundreds of thousands of variables, declared one by one, each with a formula asking, every single tick: &lsquo;did this instruction just write to <i>my</i> address?&rsquo;. Reading them back is its own nightmare &mdash; CSS gives no way to get from an address (a number) to a variable (a name), so reads go through one colossal lookup function with one arm per address: &lsquo;is it address 0? is it address 1?&hellip;&rsquo;, 743,948 arms long (<a href="#about/file/decl">memory declarations</a>, <a href="#about/file/memr">reads</a>)</li>
  </ul>

  <ProblemBox tag="Problem 2">CSS cannot change a property while running</ProblemBox>
  <p>
    In any other programming language, we can set a variable and then change it later:
  </p>
  <ReassignViz />
  <p>
    In CSS, <b>you only get one chance to set a property.</b> A huge pain in the arse for programs, which require you to do that often.
  </p>
  <p>
    At first this may seem insurmountable. But we can surmount it as follows:
  </p>
  <ol class="sim-list bracket-list bracket-list-num">
    <li>Work out every possible state/value for the property at any given time, in advance.</li>
    <li>Write one all-encompassing formula, which covers <i>in advance</i> all possible situations and the values that the variable could take consequently &mdash; which, when calculated, will give you the correct value for the property at any moment in time.</li>
    <li>Recalculate the result of that formula for every single variable, every single cycle, even if the variable didn&rsquo;t change (in this model you don&rsquo;t know if it changed or not without checking).</li>
  </ol>
  <p>
    If that sounds comically absurd, it&rsquo;s because it is:
  </p>
  <ol class="sim-list bracket-list bracket-list-num">
    <li>CPU registers cover every possible CPU instruction that could affect them, and hold a formula to calculate their own new value for every situation that could arise.</li>
    <li>EVERY byte of RAM must re-run its own formula to check, EVERY cycle, whether this tick&rsquo;s instruction wrote to their address, when 99.999% of the time, it didn&rsquo;t. If not written to, the byte of RAM copies its previous value, making that recomputation pointless (but necessary).</li>
  </ol>
  <p>
    This is a heart-breaking and mind-boggling way to write code. Much more detail is included on exactly <i>how</i> this works on the next page.
  </p>

  <ProblemBox tag="Problem 3">CSS variables can&rsquo;t reference themselves</ProblemBox>
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
    Yes, this does mean there are four copies of every single variable.
  </p>

  <ProblemBox tag="Problems 4&ndash;7">No inputs and outputs</ProblemBox>
  <p>
    CSS can&rsquo;t read files, access a keyboard, or draw directly on the screen &mdash; so we cobble every one of these together:
  </p>
  <ul class="sim-list bracket-list">
    <li><b>The floppy disk:</b> CSS can&rsquo;t open anything at runtime &mdash; no files, no requests, no loading &mdash; so the entire floppy is baked into the stylesheet in advance, byte by byte, one <code>if()</code> arm per byte. DOS asks the drive for one 512-byte sector at a time, so the machine keeps a 512-byte window in memory whose contents aren&rsquo;t stored anywhere: those addresses read straight through to the disk table, at &lsquo;requested sector &times; 512 + offset&rsquo;. (<a href="#about/file/disk">See: disk</a>.)</li>
    <li><b>The screen:</b> 64,000 <code>&lt;div&gt;</code>s are assembled in a 320&times;200 grid, each with a rule that colours it from its own byte of video RAM (skipping over the complexity of various video modes &mdash; Text, CGA, Mode&nbsp;13h&hellip;). This is, note, the only place in 300&nbsp;MB where CSS is doing its actual day job, although it's a laborious shift. (<a href="#about/file/screen">See: screen</a>).</li>
    <li><b>A keyboard:</b> CSS can see whether an element is being pressed at this exact moment via the <code>:active</code> selector. So the machine&rsquo;s keyboard is a set of real on-screen buttons, each carrying a rule &mdash; &lsquo;while I am held, the keyboard variable holds my key&rsquo;s code&rsquo; &mdash; wired into the two bytes of memory where the BIOS expects keyboard hardware. (<a href="#about/file/keys">See: keyboard</a>).</li>
    <li><b>Sound</b> just has no way to work, really. Except possibly displaying the sound wave visually&hellip;? Perhaps that&rsquo;s future work.</li>
  </ul>

  <ProblemBox tag="Problem 8">There&rsquo;s too much code to realistically write down</ProblemBox>
  <p>
    The final code is cooked up using templates via a generator script called <b>Kiln</b> &mdash; it mechanically fills in every register table, memory formula, every one of the 743,948 read arms and so on. Could I write that in CSS too? Not directly; you can&rsquo;t really write programs in CSS. But you could write a DOS-compatible program to do it...
  </p>

  <ProblemBox tag="Problem 9">This runs absurdly slowly, if it runs at all</ProblemBox>
  <Foldable>
    {#snippet summary()}Why it&rsquo;s so slow{/snippet}
    <ul class="sim-list">
      <li>All 368,256 RAM cells re-check &lsquo;was I just written to?&rsquo; every single tick &mdash; even though, at most, 3 of them were. In a normal computer the cost of a step is proportional to what <i>changed</i>; in this machine it is proportional to what <i>exists</i>.</li>
      <li>CPU instructions that normally run <i>in hardware</i> &mdash; silicon executing billions of them per second &mdash; are here re-derived as long chains of arithmetic (remember the AND function above), which the browser has to grind through symbolically, every tick.</li>
      <li>(A thought for the technical: the .css file is, in a sense, an unrolled computer)</li>
    </ul>
  </Foldable>
  <p>
    A browser really will evaluate all of this &mdash; at about two instructions per second. Not 2&nbsp;fps. Two <b>instructions</b> &mdash; add, multiply, etc. That's very slow:
  </p>
  <div class="stat-grid">
    <div class="stat-box">
      <span class="stat-num">~3 weeks</span>
      <span class="stat-label">to boot DOS</span>
    </div>
    <div class="stat-box">
      <span class="stat-num">~3 months</span>
      <span class="stat-label">DOOM level load</span>
    </div>
    <div class="stat-box">
      <span class="stat-num">0.00001&nbsp;fps</span>
      <span class="stat-label">DOOM framerate</span>
    </div>
  </div>
  <p>
    This is all assuming your browser doesn&rsquo;t crash from trying to load a 300+&nbsp;MB .css file, which it absolutely will (at time of writing).
  </p>
  <p>
    The solution is to do what every other programming language does (including JavaScript in Chrome etc.), and compile the code into something faster before it runs.
  </p>
  <p>
    This site runs the same file through <b>Calcite</b>, a compiler that evaluates the same CSS over 100,000&times; faster; <a href="#about/calcite">its own page</a> explains how it works, and why it isn&rsquo;t cheating.
  </p>
</div>

<style>
  .subpage {
    max-width: 680px;
    margin-inline: auto;
  }

  /* — sim / bracket lists: [ ] as the bullet, DOS-menu style — */
  .sim-list {
    list-style: none;
    margin: 8px 0 0;
    padding: 0;
  }
  .sim-list li { margin-bottom: 6px; line-height: 16px; }
  .bracket-list { padding-left: 30px; }
  .bracket-list li {
    position: relative;
    padding-left: 6px;
    margin-bottom: 14px;
  }
  .bracket-list li:last-child { margin-bottom: 6px; }
  .bracket-list li::before {
    content: '[]';
    position: absolute;
    left: -30px;
    width: 24px;
    color: var(--edit-blue);
    font-weight: bold;
  }
  /* bracket-list-num: [1] [2] … — same DOS-menu style, numbered */
  .bracket-list-num { counter-reset: bracket-num; }
  .bracket-list-num li { counter-increment: bracket-num; }
  .bracket-list-num li::before { content: '[' counter(bracket-num) ']'; }

  /* — the "how slow is it" stat grid (Problem 9) — three boxed numbers,
     same border/shadow language as the code exhibits. */
  .stat-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin: 12px 0;
  }
  .stat-box {
    flex: 1 1 140px;
    border: 1px solid var(--edit-black);
    background: var(--edit-white);
    box-shadow: 4px 4px 0 var(--edit-black);
    padding: 14px 10px;
    text-align: center;
  }
  .stat-num {
    display: block;
    font-family: 'WebVGA', monospace;
    letter-spacing: normal;
    font-size: 22px;
    line-height: 24px;
    color: var(--edit-red);
  }
  .stat-label {
    display: block;
    margin-top: 4px;
    font-size: 16px;
    line-height: 18px;
    color: var(--edit-black);
  }
</style>
