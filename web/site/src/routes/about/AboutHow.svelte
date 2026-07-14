<script>
  // How is this possible? - the one-tool idea and the numbered
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
    A pitifully small set of tools for such a large job. But our most impactful tool is <i>perseverance</i>. A better tool would solve each problem in one hit; ours takes millions. You might start to see why the file reaches an appalling 300+&nbsp;MB of text:
  </p>
  <MoonViz />
  <p>
    So, let&rsquo;s say we want to run DOOM in CSS. What is stopping us? After all, CSS is a programming language, and DOOM is a program, right? Well, let&rsquo;s take it one problem at a time:
  </p>

  <ProblemBox tag="Problem 1">CSS can&rsquo;t do lists of instructions</ProblemBox>
  <p>
    CSS declares properties once and forever - size, font, colour - with no step-by-step workflows. A huge pain in the arse for programs, which are lists of instructions by definition. CSS is conceptually more similar to a spreadsheet (bear with me) - each cell/property can be expressed as a formula, and they can even reference one another, but there is no order to any of it - it just exists, recalculating when it needs to, but not having a direction of travel of its own.
  </p>
  <p>
    <b>The solution is the philosophical cornerstone of this project: instead of reconstructing programs in CSS, reconstruct an entire computer - CPU, RAM, PIT, PIC, etc.</b> and then use that to run the programs in their original language. The dream is: if we can just emulate all the components of a PC 1:1, code should just&hellip; run on it.
  </p>
  <p>
    This sounds a bizarre detour, but: a CPU is a fixed circuit whose outputs are always a function of its inputs. Programs are a terrible fit for CSS, but circuits are a surprisingly natural one. 
  </p>
  <Callout kind="tip" label="Fun fact">
    <p>
      Any program is technically possible in CSS, as it&rsquo;s &lsquo;Turing complete&rsquo;. A bit like saying &lsquo;anywhere is walking distance, if you have the time&rsquo;.
    </p>
  </Callout>
  <p>
    To date, CSS has been used in computational tech demos, but never to run a production OS or real software - so when I started, I didn&rsquo;t have a clue whether it was possible in practice.
  </p>
  <Callout kind="info">
    <p>
      Lyra Rebane first built a <a href="https://lyra.horse/x86css/" class="ext-link" target="_blank" rel="noopener">CSS x86 CPU</a> with a partial instruction set - CSS-DOS completes the instruction set, and adds everything required (chipset, 640K RAM, CGA graphics, etc.) to boot real &rsquo;80s software.
    </p>
  </Callout>
  <p>
    To put things in perspective a little, CSS doesn&rsquo;t even have an AND operator. Those interested can expand below to see how long it takes to re-implement that very basic tool. 
  </p>
  <Foldable>
    {#snippet summary()}Just a taste: the AND function{/snippet}
    <p>
      Let&rsquo;s take a look at one of the simplest functions possible - AND. In most programming languages, this is just <code>a &amp; b</code>. The code required for AND to work in CSS is attached below.
    </p>
    <p>
      Bear in mind: <b>this isn&rsquo;t a CPU instruction - it&rsquo;s just one helper @function.</b> The actual AND X,Y <i>instruction</i> is implemented across many CPU registers, which each individually compute what happens to them if and when the current CPU instruction is &lsquo;AND X,Y&rsquo;.
    </p>
    <CodeCss code={AND_FULL_EXHIBIT} />
    <p>
      The little helpers at the top (<code>--lowerBytes</code>, <code>--rightShift</code>, <code>--bit</code>) are helpers - chop-to-N-bits, shift, extract-one-bit - each built from division and remainder. Then <code>--and</code> itself: thirty-two bit extractions, sixteen multiplications, one weighted sum. Below it, <code>--parity</code>: the 8086 reports whether a result has an even number of 1-bits, and nothing in CSS can count bits, so all 256 possible answers were worked out in advance and written into a 256-arm <code>if()</code>. Last, <code>--andFlags16</code> - the bookkeeping a real chip does as a free side effect of its silicon (did the result hit zero? go negative?), reconstructed as arithmetic.
    </p>
  </Foldable>

  <ProblemBox tag="Problem 2">CSS cannot change variables later</ProblemBox>
  <p>
    In any other programming language, we can set a variable and then change it later:
  </p>
  <ReassignViz />
  <p>
    In CSS, <b>there is no &lsquo;later&rsquo;</b>. If two declarations conflict, certain rules adjudicate which one overrides - but this doesn&rsquo;t change over time (mostly). Another huge pain in the arse for programs. At first this may seem insurmountable. But we can surmount it as follows:
  </p>
  <ol class="sim-list bracket-list bracket-list-num">
    <li>Enumerate every input that could influence your variable</li>
    <li>Write one all-encompassing formula, which covers <i>in advance</i> all possible situations relevant to that variable and, in each situation, how to work out the consequent value of the variable. This formula, when calculated at any moment in time, must output the correct value for the variable in question.</li>
    <li>Recalculate the result of that formula for every single variable, every single cycle, even if the variable didn&rsquo;t change (in this model you don&rsquo;t know if it changed or not without checking).</li>
  </ol>
  <p>
  <br/>
    That might sound absurd. The consequences are comically so:
  </p>
  <ul class="sim-list bracket-list">
    <li><b>Clock:</b> an animation ticks a counter, and EVERY formula in the file re-evaluates each tick.</li>
    <li><b>CPU:</b> there&rsquo;s no logic unit (ALU) at all - how could there be? Instead, each CPU register is a spaghetti-formula defined in terms of <i>every instruction</i> that could touch that register, and enumerating how to calculate its own final value in each eventuality. </li>
    <li><b>RAM:</b> emulated via a titanic list of hundreds of thousands of variables, each a formula which checks, every single cycle: &lsquo;did the current instruction just write to <i>my</i> address?&rsquo;. 99.999% of the time, it didn&rsquo;t, and the variable copies its own previous value back into itself from a buffer - pointlessly, but unavoidably.</li>
  </ul>
  <p>
    <br/>It actually gets a little worse: you can&rsquo;t even <i>read</i> a variable at a dynamic position. Say you want to read the byte of memory at position X. There&rsquo;s no way to say <code>memory[number-X]</code>. Instead, you have to write a comprehensive <code>if()</code> statement that checks every variable that it could possibly be, one by one (!!!). And no cheating with an array, because CSS hasn&rsquo;t heard of her. Every byte that is <i>read</i> from RAM or disk requires traversing an <code>if()</code> statement with 743,948 arms - one per address. Just that one function, required to read one byte of memory, is the length of nine complete works of Shakespeare.
  </p>
  <p>
    A heart-breaking and mind-boggling way to write code. Much more detail is on the next page - <a href="/about/file">the File Map</a>.
  </p>


  <ProblemBox tag="Problem 3">CSS variables can&rsquo;t reference themselves</ProblemBox>
  <p>
    Each tick, every value - register or memory cell - must be recomputed from its previous one. But a variable can&rsquo;t reference itself in CSS, which is unusual:
  </p>
  <CycleDiagrams panel="self" />
  <p>
    Well, that&rsquo;s easy to solve - just use a buffer, right? Hold the previous value of <code>--X</code> somewhere and copy from that? CSS doesn&rsquo;t like that either: it detects <i>cycles</i> too, of any length, and ignores them. And we do need to update the buffer. 
  </p>
  <CycleDiagrams panel="pair" />
  <p>
    What we need is a system that lets state through without ever, at any instant, having a complete route from start to end - a bit like an airlock:
  </p>
  <CycleDiagrams panel="ring" />
  <p>
    This does mean that every single piece of machine state requires <b>four</b> variables.
  </p>

  <ProblemBox tag="Problems 4&ndash;7">CSS has no inputs or outputs</ProblemBox>
  <p>
    CSS can&rsquo;t read files, access a keyboard, or draw directly on the screen - so we cobble every one of these together:
  </p>
  <ul class="sim-list bracket-list">
    <li><b>The floppy disk:</b> CSS can&rsquo;t open anything at runtime - no files, no requests, no loading - so the entire floppy is baked into the stylesheet in advance, byte by byte, one <code>if()</code> arm per byte. DOS asks the drive for one 512-byte sector at a time, so the machine keeps a 512-byte window in memory whose contents aren&rsquo;t stored anywhere: those addresses read straight through to the disk table, at &lsquo;requested sector &times; 512 + offset&rsquo;. (<a href="/about/file/disk">See: disk</a>.)</li>
    <li><b>The screen:</b> 64,000 <code>&lt;div&gt;</code>s are assembled in a 320&times;200 grid, each with a rule that colours it from its own byte of video RAM (skipping over the complexity of various video modes - Text, CGA, Mode&nbsp;13h&hellip;). This is, note, the only place in 300&nbsp;MB where CSS is doing its actual day job, although it&rsquo;s a laborious shift. (<a href="/about/file/screen">See: screen</a>).</li>
    <li><b>A keyboard:</b> CSS can see whether an element is being pressed at this exact moment via the <code>:active</code> selector. So the machine&rsquo;s keyboard is a set of real on-screen buttons, each carrying a rule - &lsquo;while I am held, the keyboard variable holds my key&rsquo;s code&rsquo; - wired into the two bytes of memory where the BIOS expects keyboard hardware. (<a href="/about/file/keys">See: keyboard</a>).</li>
    <li><b>Sound</b> just has no way to work, really. Except possibly displaying the sound wave visually&hellip;? Perhaps that&rsquo;s future work.</li>
  </ul>

  <ProblemBox tag="Problem 8">There&rsquo;s too much code to realistically write</ProblemBox>
  <p>
    The final code is cooked up via a generator script called <b>Kiln</b> - it mechanically fills in all the register tables, memory formulas, the 743,948 read arms and so on from templates. Could I write that in CSS too? Not directly; you can&rsquo;t really write programs in CSS. I could write it as a DOS program that would run in CSS. 
  </p>

  <ProblemBox tag="Problem 9">This runs absurdly slowly, if it runs at all</ProblemBox>
  <Foldable>
    {#snippet summary()}Why it&rsquo;s so slow{/snippet}
    <ul class="sim-list">
      <li>All 368,256 RAM cells re-check &lsquo;was I just written to?&rsquo; every single tick - even though, at most, 3 of them were. In a normal computer the cost of a step is proportional to what <i>changed</i>; in this machine it is proportional to what <i>exists</i>.</li>
      <li>CPU instructions that normally run <i>in hardware</i> - silicon executing billions of them per second - are here re-derived as long chains of arithmetic (remember the AND function above), which the browser has to grind through symbolically, every tick.</li>
      <li>(A thought for the technical: the .css file is, in a sense, an unrolled computer)</li>
    </ul>
  </Foldable>
  <p>
    In theory, a browser will evaluate all of this - at about two instructions per second. Not 2&nbsp;fps. Two <b>instructions</b> - add, multiply, etc. That&rsquo;s very slow:
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
    This is all assuming your browser survives 300+&nbsp;MB of stylesheet at all - in practice Chrome freezes solid the moment it tries to evaluate it (at time of writing).
  </p>
  <p>
    The solution is to do what every other programming language does (including JavaScript in Chrome etc.), and compile the code into something faster before it runs.
  </p>
  <p>
    This site runs the same file through <b>Calcite</b>, a compiler that evaluates the same CSS over 200,000&times; faster; <a href="/about/calcite">its own page</a> explains how it works, and why it isn&rsquo;t cheating.
  </p>
</div>

<style>
  .subpage {
    max-width: 680px;
    margin-inline: auto;
  }

  /* sim / bracket lists ([ ] bullets) now live in global.css. */

  /* - the "how slow is it" stat grid (Problem 9) - three boxed numbers,
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
