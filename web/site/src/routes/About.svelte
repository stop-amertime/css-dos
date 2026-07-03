<script>
  // About — rebuilt from ABOUT-SCRIPT.md (the shared script doc). Pages
  // 1–5 carry the drafted copy; pages 6–8 are interim (best of the old
  // pages, awaiting their script rewrite, one page at a time).
  import '../styles/_fragments/about.css';
  import '../styles/_fragments/anatomy.css';
  import { nav } from '../lib/router.svelte.js';
  import StepDots from '../components/StepDots.svelte';
  import Wizard from '../components/Wizard.svelte';
  import CssDemo from '../components/CssDemo.svelte';
  import MoonViz from '../components/MoonViz.svelte';
  import PixelScreen from '../components/PixelScreen.svelte';
  import KeyboardDemo from '../components/KeyboardDemo.svelte';
  import RamWrite from '../components/RamWrite.svelte';
  import TickClock from '../components/TickClock.svelte';
  import FileMap from '../components/FileMap.svelte';
  import TricksPage from '../components/TricksPage.svelte';

  let { strip, wizNav } = $props();

  const SUBPAGES = [
    { label: 'Intro' },
    { label: 'Why?' },
    { label: 'How it works' },
    { label: 'Stumbling block' },
    { label: "Where's the computer?" },
    { label: 'The CPU' },
    { label: 'Screen, keys, time' },
    { label: 'The 300 MB question' },
    { label: 'Tricks' },
    { label: 'Credits' },
  ];

  // The URL hash is the router's, so in-page jumps scroll instead.
  function skipCssIntro() {
    document.getElementById('css-anything')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
</script>

{#snippet subhead()}
  <StepDots variant="sub" items={SUBPAGES} current={nav.sub} onjump={(n) => (nav.sub = n)} />
{/snippet}

<Wizard {strip} {subhead} nav={wizNav}>
  <section class="step learn-step" data-step="1">

  {#if nav.sub === 1}
    <!-- Intro -->
    <div class="subpage subpage-intro" data-subpage="1">
      <div class="intro-hero">
        <div class="intro-logo">
          <img src="/assets/css-dos-logo-narrow.png" alt="CSS-DOS">
        </div>
        <div class="intro-text">
          <h1>A complete 1980s PC, in a stylesheet.</h1>
          <p class="lede">
            An IBM PC compatible &mdash; 8086 processor, 640&nbsp;KB of
            RAM, floppy drive, keyboard, VGA screen, and various
            less-memorable support chips &mdash; in one CSS file.
          </p>
          <p class="lede">
            It boots real <b>DOS</b> (disk operating system, the
            precursor to Windows) from an emulated floppy and runs
            unmodified 1980s software.
          </p>
          <p class="lede">Yes, it runs <b>Doom</b><span class="flair-star">*</span></p>
          <div class="flair-burst">
            <div class="flair-text">
              <span>The first time real<span class="flair-star">**</span> programs have run in CSS!</span>
            </div>
          </div>
          <p class="intro-fn small">
            <span class="fn-star">*</span> barely.
          </p>
          <p class="intro-fn small">
            <span class="fn-star">**</span> &ldquo;real&rdquo; meaning
            production programs &mdash; the command shell, early computer
            games, and so on.
          </p>
          <p class="lede">
            The file that does all this is about <b>300&nbsp;MB of plain
            text</b>. Every line is spec-compliant CSS, albeit abused
            beyond recognition.
          </p>
          <p class="intro-gh">
            <a href="https://github.com/stop-amertime/css-dos" class="ext-link"
               target="_blank" rel="noopener">&#9733; View the source on GitHub</a>
          </p>
        </div>
      </div>
    </div>
  {:else if nav.sub === 2}
    <!-- Why? -->
    <div class="subpage" data-subpage="2">
      <h1>Why?</h1>
      <blockquote class="epigraph">
        <p>&ldquo;Because it&rsquo;s there&rdquo;</p>
        <cite>&mdash; George Mallory, when asked why he climbed Everest.</cite>
      </blockquote>
      <!-- TODO(owner): link the Dark Souls bongos run -->
      <p>
        Cave paintings started with some spare blood being misused to
        represent a deer. Ten thousand years later, someone beat Dark
        Souls using the Bongo Drums controller from a Donkey Kong rhythm
        game, which only has three buttons and a microphone. Humans, we
        never learn, chasing useless abstract concepts like meaning,
        challenge, innovation, love. Pick your poison.
      </p>
      <p>
        I&rsquo;m under no illusion here: this project was excruciating
        to create and serves no practical benefit whatsoever. But it sits
        in that special nook between &lsquo;might be technically
        possible&rsquo; and &lsquo;impossible&rsquo; that draws the
        foolish and the brave recklessly in.
      </p>
    </div>
  {:else if nav.sub === 3}
    <!-- How it works -->
    <div class="subpage" data-subpage="3">
      <h1>How it works</h1>

      <h3 class="anatomy-head">What is CSS?</h3>
      <p class="skip-note small">
        Know this already? <button onclick={skipCssIntro}>Skip ahead &darr;</button>
      </p>
      <p>
        HTML declares what is <i>on</i> a webpage, and CSS declares how
        it should <i>appear</i>. Most of it does exactly what it says on
        the tin:
      </p>
      <pre class="byte-example"><code><span class="tok-prop">.box</span> {'{'}
  background-color: blue;
  width: <span class="tok-num">120px</span>;
{'}'}</code></pre>
      <p>
        Over the years, CSS has quietly accumulated tools: variables you
        can store and reuse like an accent colour, <code>calc()</code>
        for arithmetic &mdash; and very recently custom functions and a
        rudimentary <code>if()</code>:
      </p>

      <CssDemo />

      <h3 class="anatomy-head" id="css-anything">CSS can technically run anything</h3>
      <p>
        Now, CSS is technically <b>Turing-complete</b>, meaning that
        <span class="in-theory">in theory</span> it can run any
        computation <i>at all</i>. Instagram, Minecraft, anything &mdash;
        in theory.
      </p>
      <p>
        &lsquo;Turing complete&rsquo; is a very low bar &mdash; an
        infinitely long roll of tape with a read/write head that can
        move along it technically also qualifies.
      </p>
      <p>
        Saying a language is Turing-complete is a bit like saying
        anywhere is within walking distance, if you have enough time.
      </p>
      <p>
        Here is everything else a computer needs, and CSS has none of it:
      </p>
      <ul class="cross-list">
        <li><span class="no">[ ]</span> Keyboard input</li>
        <li><span class="no">[ ]</span> Pixels you can draw</li>
        <li><span class="no">[ ]</span> Memory you can write to</li>
        <li><span class="no">[ ]</span> Files</li>
        <li><span class="no">[ ]</span> Loops &mdash; or any way to run anything twice</li>
      </ul>

      <!-- [Q] per ABOUT-SCRIPT: do the lineage box + ✓-list stay here,
           or move to Intro/Credits? Parked here for now. -->
      <div class="ext-link-box">
        <p>
          Lyra Rebane first built a working
          <a href="https://lyra.horse/x86css/" class="ext-link"
             target="_blank" rel="noopener">x86 CPU in pure CSS</a> &mdash;
          a clean, visual demonstration that the trick works at all.
        </p>
      </div>
      <p style="margin-top:12px">
        CSS-DOS is an extension of that work: not just a CPU, but the
        whole PC around it, faithfully enough that unmodified 1980s
        software can&rsquo;t tell the difference. It simulates:
      </p>
      <ul class="sim-list">
        <li><span class="ok">[X]</span> A custom <b>BIOS</b>, booting real <b>DOS</b></li>
        <li><span class="ok">[X]</span> A FAT12 floppy disk, with your files on it</li>
        <li><span class="ok">[X]</span> 640&nbsp;KB of RAM</li>
        <li><span class="ok">[X]</span> Text + VGA graphics (Mode&nbsp;13h)</li>
        <li><span class="ok">[X]</span> A keyboard, a timer, and hardware interrupts</li>
      </ul>
    </div>
  {:else if nav.sub === 4}
    <!-- The first stumbling block -->
    <div class="subpage" data-subpage="4">
      <h1>The first stumbling block</h1>
      <p>
        Basically all programming languages are a list of instructions,
        like a <i>recipe</i>. For example <code>x = y</code>. The
        instructions are actioned in order.
      </p>
      <p>
        A stylesheet is very different. It has no order: every rule in it
        is in force the whole time &mdash; more like a blueprint or a
        diagram. You cannot tell CSS to <i>do</i> things. You can only
        declare, once, what a thing <i>is</i>:
      </p>
      <pre class="byte-example"><code><span class="tok-prop">--x</span>: blue;</code></pre>
      <p>
        In other words, we can only define X ONCE, and can&rsquo;t change
        it later. This is clearly going to be a massive pain in the arse,
        but CSS is Turing complete, so there must be a way around it.
      </p>
      <p>
        We create a &lsquo;write slot&rsquo; &mdash; a variable that just
        holds the address and value of a change to memory. Then, we
        define X as a function that looks at the write slot to see if it
        has been updated to a new value, and if not, it keeps its old
        value.
      </p>
      <p class="small">
        (Some instructions change up to six bytes at once, so we need
        multiple write slots!)
      </p>
      <p>
        There&rsquo;s another wrinkle: a formula isn&rsquo;t allowed to
        refer to itself, so we have to keep a duplicate copy of the
        entire memory, just to allow X to keep the same value. In a
        sense, every byte of memory does actually update every
        instruction, it&rsquo;s just that 99.99984% of the time it
        updates to the same value as before.
      </p>

      <RamWrite />

      <p>
        Now, the catch &mdash; this formula has to be rerun EVERY SINGLE
        TIME anything happens, even if that variable wasn&rsquo;t
        changed.
      </p>
      <p>
        In a normal programming language, <code>y = &lt;value&gt;</code>
        only affects Y &mdash; one check, done.
      </p>
      <p>
        In CSS, an instruction might write one byte, and 650,000 formulas
        must be rerun to check whether the write was about them. Often, a
        CPU instruction doesn&rsquo;t write <i>any</i> bytes, but they
        all still have to check. This is absurdly wasteful.
      </p>
      <p class="punchline">
        More than half the file (171&nbsp;MB) is this single formula,
        written out once per byte.
      </p>

      <h3 class="anatomy-head">How does anything ever change?</h3>
      <p>
        Exactly one thing in CSS changes on its own: an <b>animation</b>.
        The actual computation is run by an animation which ticks
        0,&nbsp;1,&nbsp;2,&nbsp;3, forever:
      </p>
      <pre class="byte-example"><code><span class="tok-prop">.cpu</span> {'{'} animation: tick <span class="tok-num">400ms</span> steps(<span class="tok-num">4</span>) infinite; {'}'}</code></pre>
      <p>
        Each lap of the counter, every formula in the file re-evaluates
        once, and the machine advances by one CPU instruction. This
        animation is the only moving part in 300&nbsp;MB.
      </p>
      <p>The four stages are shown below:</p>

      <TickClock />
    </div>
  {:else if nav.sub === 5}
    <!-- Where's the computer? -->
    <div class="subpage" data-subpage="5">
      <h1>Where&rsquo;s the computer?</h1>
      <p>
        We have memory and a clock now, but nothing that runs programs.
      </p>
      <p>
        On a real PC this part comes for free. A program is machine code:
        a long list of numbers sitting in memory, each one an instruction
        &mdash; 184,&nbsp;5,&nbsp;0 means &ldquo;put the number 5 into
        AX&rdquo;. The CPU is a chip that loops forever: read the number
        at the address IP points to, do what it says, move IP along. AX
        and IP are registers &mdash; fourteen values the CPU keeps close
        to hand &mdash; and all of it, the registers, the pointer, the
        reading itself, is wiring. Nobody writes code to make a CPU
        fetch; it fetches because that&rsquo;s what the silicon does.
      </p>
      <p>
        We get none of that. Everything on that list has to be built, and
        the only material available is variables:
      </p>
      <ul class="anatomy-list">
        <li>
          The program is numbers in memory, and memory is variables
          &mdash; last page.
        </li>
        <li>
          Every register is a variable: <code>--AX</code>,
          <code>--BX</code>, <code>--IP</code>&hellip;
        </li>
        <li>
          Even &ldquo;which instruction are we on&rdquo; is a variable.
          The cabinet literally contains the line:
        </li>
      </ul>
      <pre class="byte-example"><code><span class="tok-prop">--opcode</span>: var(<span class="tok-prop">--q0</span>);   <span class="tok-comment">/* --q0: the byte of memory that IP points at */</span></code></pre>
      <p>
        And the reading &mdash; the thing silicon does without being
        asked &mdash; is the first fight. CSS can&rsquo;t build a
        variable <i>name</i> out of a value: there is no way to write
        &ldquo;--memory-&#123;whatever IP is&#125;&rdquo;. So the file
        asks every possibility in turn: if IP is 0, the opcode is byte
        0&rsquo;s value; if IP is 1, byte 1&rsquo;s; on and on, for every
        address a program could run from. A giant if-statement whose only
        job is to read one number.
      </p>
      <p>Put together, one tick of the machine looks like this:</p>
      <div class="widget-placeholder">
        [WIDGET &mdash; one tick, as a flowchart: <code>--IP</code> &rarr;
        the program bytes at that address &rarr; <code>--opcode</code>
        &rarr; the register formulas and the write slots &rarr; the
        memory formulas &rarr; a new <code>--IP</code>; around the
        outside, the animation, once per lap. Being built.]
      </div>
      <p>
        IP is updated by a formula like everything else: every
        instruction has an arm in the IP table saying where the machine
        goes next. ADD&rsquo;s arm steps past itself:
      </p>
      <pre class="byte-example"><code>style(<span class="tok-prop">--opcode</span>: <span class="tok-num">5</span>): calc(var(<span class="tok-prop">--snapshot-IP</span>) + <span class="tok-num">3</span>);   <span class="tok-comment">/* ADD AX, imm16 */</span></code></pre>
      <p>
        &mdash; plus 3, because that instruction is three bytes long. A
        jump&rsquo;s arm computes a destination instead:
      </p>
      <pre class="byte-example"><code>style(<span class="tok-prop">--opcode</span>: <span class="tok-num">235</span>): --lowerBytes(calc(var(<span class="tok-prop">--snapshot-IP</span>) + <span class="tok-num">2</span> + --u2s1(var(<span class="tok-prop">--q1</span>))), <span class="tok-num">16</span>);   <span class="tok-comment">/* JMP short */</span></code></pre>
      <p>
        &mdash; the byte after the opcode (<code>--q1</code>) is the jump
        distance. It can be negative: jumping backwards is how loops
        happen. Next tick, the fetch reads from the new IP.
      </p>
    </div>
  {:else if nav.sub === 6}
    <!-- The CPU — INTERIM: strongest half of the old "How it computes";
         script rewrite pending (see ABOUT-SCRIPT.md, page 6 plan). -->
    <div class="subpage" data-subpage="6">
      <h1>The CPU</h1>
      <p>
        Registers &mdash; AX, BX and friends, the CPU&rsquo;s scratch
        values &mdash; are cells in the same spreadsheet, and their
        formulas are where the instruction set lives. A real 8086 has
        its instructions burned into silicon: add two numbers,
        subtract, copy, compare, plus dozens of more arcane ones. Each
        one is a little circuit. We have no circuits, so every
        instruction is redefined as arithmetic. This is the actual
        &ldquo;add a number to AX&rdquo; arm, verbatim from the file:
      </p>
      <pre class="byte-example"><code>style(<span class="tok-prop">--opcode</span>: <span class="tok-num">5</span>): --lowerBytes(calc(var(<span class="tok-prop">--__1AX</span>) + var(<span class="tok-prop">--imm16</span>)), 16);  <span class="tok-comment">/* ADD AX, imm16 */</span></code></pre>
      <p>
        Read it as: <i>if the opcode is 5, AX&rsquo;s next value is
        last tick&rsquo;s AX (<code>--__1AX</code>) plus the number
        that followed the opcode in memory (<code>--imm16</code>),
        trimmed back to 16 bits.</i>
      </p>
      <p>
        But the adding is the easy half. In silicon, ADD also
        <b>reports on itself for free</b>, as side effects of the
        circuit: did it overflow? hit zero? go negative? Programs test
        these &ldquo;flags&rdquo; constantly &mdash; and we get no side
        effects, so every flag is its own formula. Here is the
        machine&rsquo;s real 16-bit ADD flag function, piece by piece.
        First add, keeping only the low 16 bits, because registers
        wrap:
      </p>
      <pre class="byte-example"><code><span class="tok-prop">--raw</span>: calc(var(--dst) + var(--src));
<span class="tok-prop">--res</span>: --lowerBytes(var(--raw), <span class="tok-num">16</span>);</code></pre>
      <p>
        Did the true result overflow past 65,535? That&rsquo;s the
        <b>carry flag</b>: divide by 65,536 and round down, and you
        have a 1 or a 0.
      </p>
      <pre class="byte-example"><code><span class="tok-prop">--cf</span>: min(<span class="tok-num">1</span>, round(down, var(--raw) / <span class="tok-num">65536</span>));</code></pre>
      <p>
        Is the result exactly zero? Is its top bit set &mdash; a
        16-bit number&rsquo;s way of saying &ldquo;negative&rdquo;?
        The <b>zero</b> and <b>sign</b> flags, each parked at its own
        bit position of the flags register (64 and 128):
      </p>
      <pre class="byte-example"><code><span class="tok-prop">--zfsf</span>: calc(if(style(--res: <span class="tok-num">0</span>): <span class="tok-num">64</span>; else: <span class="tok-num">0</span>) + --bit(var(--res), <span class="tok-num">15</span>) * <span class="tok-num">128</span>);</code></pre>
      <p>
        Does the result have an even number of 1-bits? The
        <b>parity flag</b>. Nobody counts bits live &mdash; the answer
        comes from a 256-entry table baked into the file:
      </p>
      <pre class="byte-example"><code><span class="tok-prop">--pf</span>: --parity(var(--res));</code></pre>
      <p>
        Finally, pack everything into one number &mdash; the flags
        register. Two more flags hide in this line: <b>overflow</b>
        (did the sign flip in a way signed maths forbids?) and, in the
        middle, &ldquo;did the bottom four bits carry?&rdquo; &mdash;
        kept only to serve the decimal instructions below:
      </p>
      <pre class="byte-example"><code>result: calc(var(--cf) + var(--pf)
   + calc(round(down, max(<span class="tok-num">0</span>, sign(mod(var(--dst), <span class="tok-num">16</span>)
       + mod(var(--src), <span class="tok-num">16</span>) - <span class="tok-num">15.5</span>)) + <span class="tok-num">0.5</span>) * <span class="tok-num">16</span>)
   + var(--zfsf) + var(--of) + <span class="tok-num">2</span>);</code></pre>
      <p>
        So one silicon instruction became six formulas &mdash; and ADD
        is among the <i>easiest</i>. The arcane ones don&rsquo;t get
        skipped either, because DOS-era programs really use them. This
        is DAA, &ldquo;decimal adjust AL&rdquo; &mdash; a calculator-era
        relic that patches up additions done on numbers stored as
        decimal digits &mdash; complete:
      </p>
      <pre class="byte-example"><code>style(<span class="tok-prop">--opcode</span>: <span class="tok-num">39</span>): calc(round(down, var(--__1AX) / <span class="tok-num">256</span>) * <span class="tok-num">256</span>
  + mod(calc(var(--AL)
  + calc(min(<span class="tok-num">1</span>, calc(round(down, mod(var(--AL), <span class="tok-num">16</span>) / <span class="tok-num">10</span>)
  + mod(round(down, var(--__1flags) / <span class="tok-num">16</span>), <span class="tok-num">2</span>))) * <span class="tok-num">6</span>)
  + calc(min(<span class="tok-num">1</span>, calc(round(down, var(--AL) / <span class="tok-num">154</span>)
  + mod(var(--__1flags), <span class="tok-num">2</span>))) * <span class="tok-num">96</span>)), <span class="tok-num">256</span>))</code></pre>
      <p>
        Nobody said it was pretty. It goes on like this for
        <b>232 distinct opcodes &mdash; 1,094 arms</b> across the
        register tables.
      </p>

      <h3 class="anatomy-head">Not just the CPU</h3>
      <p>
        A PC was never one chip, and programs talk to the rest of the
        machine directly: they program a <b>timer chip</b> to
        interrupt them 18.2 times a second, tell the <b>interrupt
        controller</b> which events to let through, stream colours
        into the <b>VGA palette chip</b>. So the dispatch section
        holds 29 of these switch-rules &mdash; and only 14 of them are
        the 8086&rsquo;s registers. The rest are the neighbouring
        chips:
      </p>
      <pre class="byte-example"><code><span class="tok-prop">--AX --CX --DX --BX --SP --BP --SI --DI</span>   <span class="tok-comment">/* the registers &hellip; */</span>
<span class="tok-prop">--CS --DS --ES --SS --IP --flags</span>          <span class="tok-comment">/* &hellip; all fourteen */</span>
<span class="tok-prop">--picMask --picPending --picInService</span>     <span class="tok-comment">/* interrupt controller */</span>
<span class="tok-prop">--pitMode --pitReload --pitCounter</span> &hellip;      <span class="tok-comment">/* timer chip */</span>
<span class="tok-prop">--prevKeyboard --kbdScancodeLatch</span>         <span class="tok-comment">/* keyboard */</span>
<span class="tok-prop">--dacWriteIndex --dacSubIndex</span> &hellip;           <span class="tok-comment">/* VGA palette chip */</span></code></pre>
      <p>
        A support chip, in this machine, is just a few more cells in
        the spreadsheet, with formulas describing what the silicon
        would have done.
      </p>
    </div>
  {:else if nav.sub === 7}
    <!-- Screen, keys, time — INTERIM: old page + "no clock on the wall"
         promoted from Tricks; script rewrite pending. -->
    <div class="subpage" data-subpage="7">
      <h1>Screen, keys, time</h1>
      <p>
        CSS can&rsquo;t draw pixels &mdash; but it can colour elements.
        So the screen is <b>one &lt;div&gt; per pixel</b>, each painted
        by its own rule:
      </p>

      <PixelScreen />

      <h3 class="anatomy-head">The palette</h3>
      <p>
        One thing the widget glosses over: the palette isn&rsquo;t a
        fixed table of 256 colours. The running program loads its own,
        and the machine accepts it exactly the way real VGA hardware
        did: to set one colour, the program writes three bytes &mdash;
        red, green, blue &mdash; to a single port, while a tiny counter
        steps 0, 1, 2 and rolls over to the next colour slot. When a
        game fades to black, it is re-streaming this table a little
        darker, over and over.
      </p>

      <h3 class="anatomy-head">The keys</h3>
      <p>
        Input has no events either. What CSS <i>can</i> ask is
        <b><code>:active</code></b> &mdash; &ldquo;is this element being
        pressed?&rdquo; The player&rsquo;s on-screen keys are real
        buttons, and these are the cabinet&rsquo;s actual rules:
      </p>

      <KeyboardDemo />

      <p>
        Notice what this rules out: CSS cannot see your physical
        keyboard &mdash; no selector reacts to a real keypress. Every
        program is piloted by pressing the on-screen keys. And some
        gaps stay gaps: CSS has no way to make sound, so the PC speaker
        stays silent.
      </p>

      <h3 class="anatomy-head">No clock on the wall</h3>
      <p>
        DOS programs expect two heartbeats the real PC had: a timer chip
        interrupting 18.2 times a second (how DOS keeps the time of day,
        and how games pace themselves), and the screen&rsquo;s
        70-per-second refresh signal. CSS can&rsquo;t read a real clock.
        Both are instead derived from a number the CPU already tracks:
        how many cycles each instruction <i>would have cost</i> on a
        real 4.77&nbsp;MHz 8086. Time, in this machine, is measured in
        work done &mdash; not in seconds.
      </p>
    </div>
  {:else if nav.sub === 8}
    <!-- The 300 MB question — INTERIM: old "The file" + "Inside the
         file" merged; script rewrite pending. -->
    <div class="subpage" data-subpage="8">
      <h1>The 300 MB question</h1>
      <p>
        The Build step will hand you one <code>.css</code> file. Here is
        everything inside Sokoban&rsquo;s &mdash; all 309&nbsp;MB of it,
        drawn to scale:
      </p>

      <FileMap />

      <p>
        The part that computes barely registers. <b>The CPU is about
        300&nbsp;KB &mdash; one tenth of one percent of the file.</b>
        Everything else is memory, written out longhand: a few short rules
        for every byte of RAM and every byte of the disk, repeated hundreds
        of thousands of times.
      </p>

      <h3 class="anatomy-head">The sliver that computes</h3>
      <p>The machine itself sits at the top of the file:</p>
      <ul class="anatomy-list">
        <li>
          <b>Utility functions</b> <span class="sz">(15 KB)</span> &mdash;
          the bit-math CSS doesn&rsquo;t have (AND, OR, shifts), rebuilt
          from plain arithmetic. How that works is on the Tricks page.
        </li>
        <li>
          <b>Instruction decode</b> <span class="sz">(48 KB)</span> &mdash;
          how to read an 8086 instruction from raw bytes: how long it is,
          which registers it names, what memory address it points at.
        </li>
        <li>
          <b>The dispatch tables</b> <span class="sz">(225 KB)</span> &mdash;
          the CPU proper. For each of the 8086&rsquo;s fourteen registers,
          one big conditional answering: <i>given this opcode, what is your
          next value?</i>
        </li>
      </ul>

      <pre class="byte-example"><code><span class="tok-prop">--AX</span>: if(style(<span class="tok-prop">--_tf</span>: <span class="tok-num">1</span>): var(--__1AX);
          style(<span class="tok-prop">--_irqActive</span>: <span class="tok-num">1</span>): var(--__1AX);  <span class="tok-comment">/* interrupt pending? */</span>
  else: if(
    style(<span class="tok-prop">--opcode</span>: <span class="tok-num">0</span>): &hellip;;   <span class="tok-comment">/* ADD r/m8, reg8 */</span>
    style(<span class="tok-prop">--opcode</span>: <span class="tok-num">1</span>): &hellip;;   <span class="tok-comment">/* ADD r/m16, reg16 */</span>
    <span class="tok-comment">/* &hellip; every opcode that can touch AX &hellip; */</span>
    else: var(<span class="tok-prop">--__1AX</span>)));    <span class="tok-comment">/* unchanged */</span></code></pre>

      <p>
        You read real arms of this table on &ldquo;The CPU&rdquo;; it
        goes on for 232 opcodes, one table per register. Note the two
        arms standing in <i>front</i> of the opcode switch: when an
        interrupt is pending, they override everything &mdash;
        that&rsquo;s how the keyboard and the timer cut in between
        instructions. Evaluating all of these tables, once, <i>is</i>
        executing an instruction.
      </p>

      <h3 class="anatomy-head">The ocean</h3>
      <p>
        The rest of the file is memory, and it comes in <b>full sweeps</b>
        &mdash; sections that must mention every single memory cell,
        because CSS gives no way to say &ldquo;and the same for the other
        650,000&rdquo;:
      </p>
      <ul class="anatomy-list">
        <li>
          <b>Declarations</b> <span class="sz">(32 MB)</span> &mdash; CSS
          requires every typed variable to be registered with
          <code>@property</code>. One block per memory cell; its
          <code>initial-value</code> is that byte&rsquo;s power-on
          contents.
        </li>
        <li>
          <b>The memory read function</b> <span class="sz">(44 MB)</span>
          &mdash; CSS has no arrays, so &ldquo;give me the byte at address
          A&rdquo; can only be built one way: a single <code>if()</code>
          with an arm for every address. About a million arms.
        </li>
        <li>
          <b>The floppy disk</b> <span class="sz">(13 MB)</span> &mdash;
          the read-only lookup shown below. The one section that
          tracks the game rather than the machine &mdash; a bigger game
          means a bigger disk section, and almost nothing else changes.
        </li>
        <li>
          <b>The write rules</b> <span class="sz">(171 MB)</span> &mdash;
          over half the file. Every cell&rsquo;s formula, asking once per
          tick: <i>did a write land on me?</i>
        </li>
        <li>
          <b>Staging sweeps</b> <span class="sz">(43 MB)</span> &mdash;
          three more passes over all of memory that keep each tick reading
          a clean snapshot &mdash; the four stages from &ldquo;The first
          stumbling block&rdquo;.
        </li>
        <li>
          <b>The pixel painter</b> <span class="sz">(6.5 MB)</span> &mdash;
          one rule per screen pixel, from &ldquo;Screen, keys, time&rdquo;.
        </li>
      </ul>

      <h3 class="anatomy-head">Everything included</h3>
      <p>
        CSS can&rsquo;t open anything at runtime &mdash; no files, no
        requests, no loading. Whatever the machine will ever need has to
        be in the stylesheet before it starts:
      </p>
      <ul class="sim-list">
        <li><span class="ok">[X]</span> The starting contents of all 640&nbsp;KB of RAM</li>
        <li><span class="ok">[X]</span> The <b>BIOS</b> &mdash; the firmware a PC runs
          before the operating system</li>
        <li><span class="ok">[X]</span> The entire <b>floppy disk</b>, byte by byte:
          DOS itself, plus the program&rsquo;s files</li>
      </ul>
      <p style="margin-top:12px">
        The disk becomes one giant read-only lookup:
      </p>
      <pre class="byte-example"><code>@function <span class="tok-prop">--readDiskByte</span>(<span class="tok-prop">--idx</span>) {'{'}
  result: if(
    style(<span class="tok-prop">--idx</span>: <span class="tok-num">0</span>): <span class="tok-num">235</span>;
    style(<span class="tok-prop">--idx</span>: <span class="tok-num">1</span>): <span class="tok-num">60</span>;
    <span class="tok-comment">/* &hellip; one arm per byte of the floppy &hellip; */</span></code></pre>
      <p>
        It adds up. The Sokoban cabinet is <b>~309&nbsp;MB</b> of plain
        text; Doom&rsquo;s is <b>~332&nbsp;MB</b>. For scale, the
        entire original Zork was about 85&nbsp;KB.
      </p>

      <MoonViz />

      <p class="punchline">
        The honest footnote: this is real, valid CSS, and a browser can
        evaluate it &mdash; but a 300&nbsp;MB stylesheet with a million
        interlinked variables grinds Chrome to a halt. So the project
        also built <b>Calcite</b>, a compiler that reads the same CSS
        and runs it fast. The stylesheet stays the source of truth;
        Calcite is just a faster way to evaluate it.
      </p>
    </div>
  {:else if nav.sub === 9}
    <TricksPage />
  {:else if nav.sub === 10}
    <!-- Credits -->
    <div class="subpage" data-subpage="10">
      <h1>Credits &amp; thanks</h1>
      <p>
        CSS-DOS stands on the shoulders of people who proved, piece by
        piece, that a browser&rsquo;s style engine could be a computer.
      </p>

      <h3 class="credits-head">Prior art &amp; kindred projects</h3>
      <ul class="credits-list">
        <li>
          <a href="https://lyra.horse/x86css/" class="ext-link" target="_blank" rel="noopener">x86CSS</a>
          &mdash; Lyra Rebane
          (<a href="https://github.com/rebane2001/x86css" class="ext-link" target="_blank" rel="noopener">rebane2001</a>).
          A working 16-bit x86 CPU in pure CSS &mdash; the original
          demonstration that the trick is possible at all. CSS-DOS grew
          out of it.
        </li>
        <li>
          <a href="https://dev.to/janeori/expert-css-the-cpu-hack-4ddj" class="ext-link" target="_blank" rel="noopener">The CSS CPU Hack</a>
          &mdash; Jane Ori. The writeup for doing real computation in CSS.
        </li>
        <li>
          <a href="https://github.com/nicknisi/emu8" class="ext-link" target="_blank" rel="noopener">emu8</a>
          &mdash; the reference 8086 emulator CSS-DOS checks itself against.
        </li>
      </ul>

      <h3 class="credits-head">Operating system</h3>
      <ul class="credits-list">
        <li>
          The booted OS is <b>EDR-DOS</b>, from the
          <a href="https://svardos.org/" class="ext-link" target="_blank" rel="noopener">SvarDOS</a>
          build &mdash; an open, freely-distributable DR-DOS descendant. CSS-DOS
          ships its <code>kernel.sys</code> and <code>command.com</code> on the
          emulated floppy.
        </li>
      </ul>

      <h3 class="credits-head">Assets</h3>
      <ul class="credits-list">
        <li>
          Font (headings, code, chrome): &ldquo;Web437 IBM VGA&rdquo; by
          VileR, from the
          <a href="https://int10h.org/oldschool-pc-fonts/" class="ext-link" target="_blank" rel="noopener">Oldschool PC Font Pack</a>
          (int10h.org) &mdash; CC&nbsp;BY-SA&nbsp;4.0.
        </li>
        <li>
          Font (body text): &ldquo;<a href="https://laemeur.sdf.org/fonts/" class="ext-link" target="_blank" rel="noopener">More Perfect DOS VGA</a>&rdquo;
          by L&AElig;MEUR, remastering Zeh Fernando&rsquo;s
          &ldquo;Perfect DOS VGA 437&rdquo;; IBM designed the glyphs.
          Free for all use.
        </li>
      </ul>
    </div>
  {/if}

  </section>
</Wizard>
