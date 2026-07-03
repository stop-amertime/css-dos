<script>
  // How it works — the technical story, in reading order. Facts from
  // CABINET-ANATOMY.md (sizes, mechanisms) and real cabinet exhibits;
  // register and copy rules per ABOUT-SCRIPT.md.
  import '../styles/_fragments/about.css';
  import '../styles/_fragments/anatomy.css';
  import { nav } from '../lib/router.svelte.js';
  import StepDots from '../components/StepDots.svelte';
  import Wizard from '../components/Wizard.svelte';
  import CssDemo from '../components/CssDemo.svelte';
  import RamWrite from '../components/RamWrite.svelte';
  import TickClock from '../components/TickClock.svelte';
  import TickFlow from '../components/TickFlow.svelte';
  import PixelScreen from '../components/PixelScreen.svelte';
  import KeyboardDemo from '../components/KeyboardDemo.svelte';
  import FileMap from '../components/FileMap.svelte';
  import MoonViz from '../components/MoonViz.svelte';
  import TricksPage from '../components/TricksPage.svelte';

  let { strip, wizNav } = $props();

  const SUBPAGES = [
    { label: 'What is CSS?' },
    { label: 'Stumbling block' },
    { label: "Where's the computer?" },
    { label: 'The CPU' },
    { label: 'Screen, keys, time' },
    { label: 'The 300 MB question' },
    { label: 'Tricks' },
    { label: 'Credits' },
  ];

  // The URL hash belongs to the router, so in-page jumps scroll instead.
  function skipCssIntro() {
    document.getElementById('css-anything')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
</script>

{#snippet subhead()}
  <StepDots variant="sub" items={SUBPAGES} current={nav.howSub} onjump={(n) => (nav.howSub = n)} />
{/snippet}

<Wizard {strip} {subhead} nav={wizNav}>
  <section class="step learn-step" data-step="2">

  {#if nav.howSub === 1}
    <!-- What is CSS? -->
    <div class="subpage" data-subpage="1">
      <h1>What is CSS?</h1>
      <p class="skip-note small">
        Know this already? <button onclick={skipCssIntro}>Skip ahead &darr;</button>
      </p>
      <p>
        HTML declares what is <i>on</i> a webpage, and CSS declares how
        it should <i>appear</i>. Most of it does exactly what it says on
        the tin. But over the years CSS has quietly accumulated tools:
        variables, <code>calc()</code> for arithmetic &mdash; and very
        recently custom functions and a rudimentary <code>if()</code>.
        All four are real, running in your browser right now:
      </p>

      <CssDemo />

      <h3 class="anatomy-head" id="css-anything">CSS can technically run anything</h3>
      <p>
        Variables, arithmetic, conditionals: that&rsquo;s enough. CSS is
        technically <b>Turing-complete</b>, meaning that
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
        <li><span class="no">[ ]</span> Memory you can write to</li>
        <li><span class="no">[ ]</span> Loops &mdash; or any way to run anything twice</li>
        <li><span class="no">[ ]</span> Keyboard input</li>
        <li><span class="no">[ ]</span> Pixels you can draw</li>
        <li><span class="no">[ ]</span> Files</li>
      </ul>
      <p>
        The rest of this section is that list, crossed off one item at a
        time.
      </p>
    </div>
  {:else if nav.howSub === 2}
    <!-- The first stumbling block -->
    <div class="subpage" data-subpage="2">
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
      <p>
        Why four beats and not one? Because of that duplicate memory:
        results land in a <b>buffer</b>, and the buffer only becomes the
        next <b>snapshot</b> &mdash; the copy every formula reads &mdash;
        after everything has finished reading the old one. Nothing is
        ever copied from and written to at the same moment.
      </p>

      <TickClock />
    </div>
  {:else if nav.howSub === 3}
    <!-- Where's the computer? -->
    <div class="subpage" data-subpage="3">
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
      <div class="callout">
        <span class="callout-label">NOTE</span>
        <p>
          Code on these pages is real cabinet code, structurally exact
          &mdash; only the variable names are tidied for reading:
          <code>--__1IP</code> becomes <code>--snapshot-IP</code>.
        </p>
      </div>
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

      <TickFlow />

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
  {:else if nav.howSub === 4}
    <!-- The CPU -->
    <div class="subpage" data-subpage="4">
      <h1>The CPU</h1>
      <p>
        The fetch hands us <code>--opcode</code>. Now something has to
        <i>do</i> the instruction. On the 8086, every instruction is a
        little circuit etched into silicon. Here, every register gets a
        table: one switch on the opcode, with an arm for each instruction
        that can touch it.
      </p>
      <pre class="byte-example"><code><span class="tok-prop">--AX</span>: if(
  style(<span class="tok-prop">--_irqActive</span>: <span class="tok-num">1</span>): var(<span class="tok-prop">--snapshot-AX</span>);  <span class="tok-comment">/* interrupt pending — hardware outranks the program this tick */</span>
  else: if(
    style(<span class="tok-prop">--opcode</span>: <span class="tok-num">0</span>): &hellip;;    <span class="tok-comment">/* ADD, one flavour */</span>
    style(<span class="tok-prop">--opcode</span>: <span class="tok-num">1</span>): &hellip;;    <span class="tok-comment">/* ADD, another */</span>
    &hellip;                     <span class="tok-comment">/* every opcode that can touch AX */</span>
    else: var(<span class="tok-prop">--snapshot-AX</span>)));   <span class="tok-comment">/* untouched: keep the old value */</span></code></pre>
      <p>
        Fourteen of these tables &mdash; one per register, including the
        IP table from the last page. Evaluating all of them, once, is the
        machine executing one instruction. (The arm standing in front of
        the switch is how a keypress or a timer tick cuts in <i>between</i>
        instructions: when an interrupt is pending, every register takes
        its interrupt value instead of the decoded one.)
      </p>

      <h3 class="anatomy-head">One instruction, all the way through</h3>
      <p>
        Take the instruction everybody knows: ADD. Opcode 5 is
        &ldquo;add a number to AX&rdquo;. When the snapshot says
        <code>--opcode: 5</code>, this arm fires in the AX table:
      </p>
      <pre class="byte-example"><code>style(<span class="tok-prop">--opcode</span>: <span class="tok-num">5</span>): --lowerBytes(calc(var(<span class="tok-prop">--snapshot-AX</span>) + var(<span class="tok-prop">--imm16</span>)), <span class="tok-num">16</span>);   <span class="tok-comment">/* ADD AX, imm16 */</span></code></pre>
      <p>
        New AX = old AX plus the number that followed the opcode in
        memory (<code>--imm16</code>), trimmed back to 16 bits because
        registers wrap. IP&rsquo;s arm steps 3 bytes forward &mdash; you
        saw it on the last page. That&rsquo;s the whole instruction, on
        the surface.
      </p>
      <p>
        But a real ADD circuit also reports on itself, for free, as side
        effects of the silicon: did the sum overflow? hit zero? go
        negative? These reports are the <b>flags</b>, and programs check
        them constantly &mdash; every &ldquo;if&rdquo; in every program
        ends up as a flag check. We get no side effects, so the flags
        table has its own arm for opcode 5, and it calls this &mdash; the
        machine&rsquo;s real 16-bit ADD flag function, in full:
      </p>
      <pre class="byte-example"><code>@function <span class="tok-prop">--addFlags16</span>(<span class="tok-prop">--dst</span> &lt;integer&gt;, <span class="tok-prop">--src</span> &lt;integer&gt;) returns &lt;integer&gt; {'{'}
  <span class="tok-prop">--raw</span>: calc(var(--dst) + var(--src));
  <span class="tok-prop">--res</span>: --lowerBytes(var(--raw), <span class="tok-num">16</span>);
  <span class="tok-prop">--cf</span>: min(<span class="tok-num">1</span>, round(down, var(--raw) / <span class="tok-num">65536</span>));
  <span class="tok-prop">--pf</span>: --parity(var(--res));
  <span class="tok-prop">--zfsf</span>: calc(if(style(--res: <span class="tok-num">0</span>): <span class="tok-num">64</span>; else: <span class="tok-num">0</span>) + --bit(var(--res), <span class="tok-num">15</span>) * <span class="tok-num">128</span>);
  <span class="tok-prop">--of</span>: --addOF16(var(--dst), var(--src), var(--res));
  result: calc(var(--cf) + var(--pf)
    + calc(round(down, max(<span class="tok-num">0</span>, sign(mod(var(--dst), <span class="tok-num">16</span>)
        + mod(var(--src), <span class="tok-num">16</span>) - <span class="tok-num">15.5</span>)) + <span class="tok-num">0.5</span>) * <span class="tok-num">16</span>)
    + var(--zfsf) + var(--of) + <span class="tok-num">2</span>);
{'}'}</code></pre>
      <p>
        Reading it out: <code>--cf</code> asks &ldquo;did the true sum
        pass 65,535?&rdquo; &mdash; divide by 65,536, round down, and you
        have the <b>carry flag</b> as a 1 or a 0. <code>--zfsf</code>
        asks &ldquo;is the result zero?&rdquo; and &ldquo;is its top bit
        set?&rdquo; (a 16-bit number&rsquo;s way of being negative)
        &mdash; the <b>zero</b> and <b>sign</b> flags, each parked at its
        own bit position. <code>--pf</code>, the <b>parity flag</b>,
        wants the number of 1-bits in the result &mdash; nobody counts
        bits in CSS, so the answer comes from a 256-entry table baked
        into the file. The long line in the middle is the
        <b>half-carry</b> flag: &ldquo;did the bottom four bits
        overflow?&rdquo;, built out of <code>sign()</code> because CSS
        has no <code>&lt;</code>. And the <code>+ 2</code> at the end is
        a bit the 8086 keeps permanently switched on.
      </p>
      <p>
        So one ADD is the sum, the new IP, six flags, and a lookup
        table. ADD is among the <i>easiest</i> instructions.
      </p>

      <h3 class="anatomy-head">The less reasonable ones</h3>
      <p>
        DIV divides a 32-bit number &mdash; held across two registers,
        DX and AX &mdash; producing a quotient and a remainder at once.
        Two tables catch its output:
      </p>
      <pre class="byte-example"><code><span class="tok-comment">/* AX takes the quotient */</span>
round(down, calc((var(<span class="tok-prop">--snapshot-DX</span>) * <span class="tok-num">65536</span> + var(<span class="tok-prop">--snapshot-AX</span>)) / max(<span class="tok-num">1</span>, var(<span class="tok-prop">--rmVal16</span>))))
<span class="tok-comment">/* DX takes the remainder */</span>
mod(calc(var(<span class="tok-prop">--snapshot-DX</span>) * <span class="tok-num">65536</span> + var(<span class="tok-prop">--snapshot-AX</span>)), max(<span class="tok-num">1</span>, var(<span class="tok-prop">--rmVal16</span>)))</code></pre>
      <p>
        The <code>max(1, &hellip;)</code> is there because a program can
        ask to divide by zero, and the formula has to stay legal CSS when
        it does.
      </p>
      <p>
        And the instruction set doesn&rsquo;t stop at the reasonable
        ones. This is DAA, &ldquo;decimal adjust AL&rdquo; &mdash; a
        calculator-era relic that patches up sums done on numbers stored
        as decimal digits. DOS-era programs really use it, so:
      </p>
      <pre class="byte-example"><code>style(<span class="tok-prop">--opcode</span>: <span class="tok-num">39</span>): calc(round(down, var(<span class="tok-prop">--snapshot-AX</span>) / <span class="tok-num">256</span>) * <span class="tok-num">256</span>
  + mod(calc(var(--AL)
  + calc(min(<span class="tok-num">1</span>, calc(round(down, mod(var(--AL), <span class="tok-num">16</span>) / <span class="tok-num">10</span>)
  + mod(round(down, var(<span class="tok-prop">--snapshot-flags</span>) / <span class="tok-num">16</span>), <span class="tok-num">2</span>))) * <span class="tok-num">6</span>)
  + calc(min(<span class="tok-num">1</span>, calc(round(down, var(--AL) / <span class="tok-num">154</span>)
  + mod(var(<span class="tok-prop">--snapshot-flags</span>), <span class="tok-num">2</span>))) * <span class="tok-num">96</span>)), <span class="tok-num">256</span>))</code></pre>
      <p>
        Nobody said it was pretty. It goes on like this for <b>232
        distinct opcodes &mdash; 1,094 arms</b> across the register
        tables.
      </p>

      <h3 class="anatomy-head">Not just the CPU</h3>
      <p>
        A PC was never one chip, and programs talk to the rest of the
        machine directly: they program a <b>timer chip</b> to interrupt
        them 18.2 times a second, tell the <b>interrupt controller</b>
        which events to let through, stream colours into the <b>VGA
        palette</b>. Each of those chips is simulated the same way the
        registers are &mdash; a few more variables, with tables
        describing what the silicon would have done:
      </p>
      <pre class="byte-example"><code><span class="tok-prop">--AX --CX --DX --BX --SP --BP --SI --DI</span>   <span class="tok-comment">/* the registers &hellip; */</span>
<span class="tok-prop">--CS --DS --ES --SS --IP --flags</span>          <span class="tok-comment">/* &hellip; all fourteen */</span>
<span class="tok-prop">--picMask --picPending --picInService</span>     <span class="tok-comment">/* interrupt controller */</span>
<span class="tok-prop">--pitMode --pitReload --pitCounter</span> &hellip;      <span class="tok-comment">/* timer chip */</span>
<span class="tok-prop">--prevKeyboard --kbdScancodeLatch</span>         <span class="tok-comment">/* keyboard */</span>
<span class="tok-prop">--dacWriteIndex --dacSubIndex</span> &hellip;           <span class="tok-comment">/* VGA palette chip */</span></code></pre>

      <h3 class="anatomy-head">Debugging this</h3>
      <p>
        A wrong bit anywhere in the tables above corrupts the machine
        silently, and none of a programmer&rsquo;s normal tools exist
        inside a stylesheet &mdash; no breakpoints, no logging, no
        stepping. The machine&rsquo;s one debugging aid: the CPU prints
        its own registers to the screen using CSS <b>counters</b>,
        because <code>counter()</code> is the only way CSS can turn a
        number into visible text. Fourteen numbers on screen, updating
        as it runs. That read-out is what this project was built with.
      </p>
    </div>
  {:else if nav.howSub === 5}
    <!-- Screen, keys, time -->
    <div class="subpage" data-subpage="5">
      <h1>Screen, keys, time</h1>
      <p>
        CSS can&rsquo;t draw pixels. It can colour elements. So the
        screen is <b>one &lt;div&gt; per pixel</b> &mdash; 64,000 of them
        &mdash; each with a rule that reads its own byte of video memory:
      </p>

      <PixelScreen />

      <h3 class="anatomy-head">The palette</h3>
      <p>
        The palette isn&rsquo;t a fixed table of 256 colours &mdash; the
        running program loads its own, and the machine accepts it exactly
        the way real VGA hardware did: to set one colour, the program
        writes three bytes &mdash; red, green, blue &mdash; to a single
        port, while a small counter steps 0, 1, 2 and rolls over to the
        next colour slot. When a game fades to black, it is re-streaming
        the whole table a little darker, over and over.
      </p>

      <h3 class="anatomy-head">The keys</h3>
      <p>
        Input has no events either. The one thing CSS can ask is
        <b><code>:active</code></b> &mdash; &ldquo;is this element being
        pressed, right now?&rdquo; The player&rsquo;s on-screen keys are
        real buttons, and these are the cabinet&rsquo;s actual rules:
      </p>

      <KeyboardDemo />

      <p>
        One wrinkle. Real keyboards also send a <i>release</i> code when
        a key comes back up, and games depend on it &mdash; it&rsquo;s
        how Doom knows you stopped moving. But <code>:active</code> only
        stops matching for the single instant you let go, and programs
        usually don&rsquo;t check the keyboard until a few ticks later
        &mdash; by then that instant is gone, and the key would look held
        down forever. So the machine keeps a <b>latch</b>: one variable
        holding the most recent key event, press or release, until the
        next one replaces it.
      </p>
      <div class="callout">
        <span class="callout-label">HONEST LIMITS</span>
        <p>
          CSS cannot see your physical keyboard &mdash; no selector
          reacts to a real keypress, so every program is piloted from
          the on-screen keys. And CSS cannot make sound &mdash; the PC
          speaker stays silent.
        </p>
      </div>

      <h3 class="anatomy-head">No clock on the wall</h3>
      <p>
        DOS programs expect two heartbeats the real PC had: a timer chip
        interrupting 18.2 times a second (how DOS keeps the time of day,
        and how games pace themselves), and the screen&rsquo;s
        70-per-second refresh signal. CSS can&rsquo;t read a real clock.
        Both are instead derived from a number the CPU already tracks:
        how many cycles each instruction <i>would have cost</i> on a real
        4.77&nbsp;MHz 8086. Time, in this machine, is measured in work
        done &mdash; not in seconds.
      </p>
    </div>
  {:else if nav.howSub === 6}
    <!-- The 300 MB question -->
    <div class="subpage" data-subpage="6">
      <h1>The 300 MB question</h1>
      <p>
        Why is a PC 300 megabytes of text? Here is everything inside the
        Sokoban cabinet &mdash; all 309&nbsp;MB of it, drawn to scale:
      </p>

      <FileMap />

      <p>
        The CPU &mdash; the fetch, the fourteen register tables, the flag
        functions, all of it &mdash; is about <b>300&nbsp;KB. One tenth
        of one percent of the file.</b> The rest is memory, written out
        longhand, because CSS gives no way to say &ldquo;and the same for
        the other 650,000 cells&rdquo;. Every cell of RAM appears in the
        file four separate times:
      </p>
      <table class="data-table">
        <thead>
          <tr><th>Every cell of RAM is&hellip;</th><th>Size</th><th>Because</th></tr>
        </thead>
        <tbody>
          <tr>
            <td><b>declared</b></td><td class="num">32 MB</td>
            <td>one <code>@property</code> block per cell; its
              <code>initial-value</code> is the byte&rsquo;s power-on contents</td>
          </tr>
          <tr>
            <td><b>readable</b></td><td class="num">44 MB</td>
            <td>&ldquo;the byte at address A&rdquo; can only be one giant
              <code>if()</code> &mdash; about a million arms</td>
          </tr>
          <tr>
            <td><b>writable</b></td><td class="num">171 MB</td>
            <td>the formula from &ldquo;The first stumbling block&rdquo;,
              once per cell &mdash; over half the file</td>
          </tr>
          <tr>
            <td><b>staged</b></td><td class="num">43 MB</td>
            <td>three more sweeps that keep each tick reading a clean
              snapshot</td>
          </tr>
        </tbody>
      </table>
      <div class="callout">
        <span class="callout-label">THE ONE OPTIMISATION</span>
        <p>
          Memory is <b>packed two bytes per variable</b>, so every sweep
          above mentions half as many cells as there are bytes. Without
          it, all four numbers double.
        </p>
      </div>

      <h3 class="anatomy-head">The floppy</h3>
      <p>
        CSS can&rsquo;t open anything at runtime &mdash; no files, no
        requests, no loading. Whatever the machine will ever need has to
        be in the stylesheet before it starts: the BIOS, DOS itself, and
        the entire floppy disk. The disk is a real, bootable FAT12 image,
        assembled from your files at build time, then baked in byte by
        byte &mdash; one <code>if()</code> arm each:
      </p>
      <pre class="byte-example"><code>@function <span class="tok-prop">--readDiskByte</span>(<span class="tok-prop">--idx</span>) {'{'}
  result: if(
    style(<span class="tok-prop">--idx</span>: <span class="tok-num">0</span>): <span class="tok-num">235</span>;
    style(<span class="tok-prop">--idx</span>: <span class="tok-num">1</span>): <span class="tok-num">60</span>;
    <span class="tok-comment">/* &hellip; one arm per byte of the floppy &hellip; */</span></code></pre>
      <p>
        That&rsquo;s 13&nbsp;MB for Sokoban&rsquo;s disk, and it&rsquo;s
        the one section that grows with the game &mdash; Doom&rsquo;s
        1.3&nbsp;MB floppy takes its cabinet to ~330&nbsp;MB. It
        doesn&rsquo;t shrink much either: the machine itself costs
        ~296&nbsp;MB before any game arrives, so Zork &mdash;
        85&nbsp;KB of words on a screen &mdash; still comes out around
        300&nbsp;MB.
      </p>

      <h3 class="anatomy-head">How big is that, really?</h3>
      <table class="data-table">
        <tbody>
          <tr><td>A typical website&rsquo;s entire stylesheet</td><td class="num">~50 KB</td></tr>
          <tr><td>The complete works of Shakespeare</td><td class="num">~5 MB</td></tr>
          <tr><td><b>One CSS-DOS cabinet</b></td><td class="num"><b>~309 MB</b></td></tr>
        </tbody>
      </table>
      <p>
        Sixty Shakespeares of stylesheet. Or, on foot:
      </p>

      <MoonViz />

      <p class="punchline">
        And here is the bill. Every line of the file is CSS a browser
        can evaluate &mdash; that&rsquo;s the project&rsquo;s one
        non-negotiable rule &mdash; but in practice a 300&nbsp;MB
        stylesheet with a million interlinked variables crashes Chrome.
        Even where it survives, the pure-CSS clock runs at 2.5
        instructions per second, and booting DOS takes around a hundred
        million instructions: a year and a half to reach the
        <code>A:\</code> prompt. So the project also built
        <b>Calcite</b> &mdash; a compiler that reads the same stylesheet
        and evaluates it fast enough to play. The CSS stays the source of
        truth; Calcite is a faster way of evaluating the same file.
      </p>
    </div>
  {:else if nav.howSub === 7}
    <TricksPage />
  {:else if nav.howSub === 8}
    <!-- Credits -->
    <div class="subpage" data-subpage="8">
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
