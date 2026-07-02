<script>
  import '../styles/_fragments/about.css';
  import { nav } from '../lib/router.svelte.js';
  import StepDots from '../components/StepDots.svelte';
  import CssDemo from '../components/CssDemo.svelte';
  import MoonViz from '../components/MoonViz.svelte';
  import PixelScreen from '../components/PixelScreen.svelte';
  import KeyboardDemo from '../components/KeyboardDemo.svelte';
  import RamWrite from '../components/RamWrite.svelte';
  import DispatchDemo from '../components/DispatchDemo.svelte';
  import AnatomyPage from '../components/AnatomyPage.svelte';
  import TickPage from '../components/TickPage.svelte';
  import TricksPage from '../components/TricksPage.svelte';

  const SUBPAGES = [
    { label: 'Intro' },
    { label: "What's CSS?" },
    { label: "Why it's strange" },
    { label: 'How it computes' },
    { label: 'Screen & keys' },
    { label: 'The file' },
    { label: 'Inside the file' },
    { label: 'One tick' },
    { label: 'Tricks' },
    { label: 'Credits' },
  ];
</script>

<section class="step learn-step" data-step="1">

  <StepDots variant="sub" items={SUBPAGES} current={nav.sub} onjump={(n) => (nav.sub = n)} />

  {#if nav.sub === 1}
    <!-- Intro -->
    <div class="subpage subpage-intro" data-subpage="1">
      <div class="intro-hero">
        <div class="intro-logo">
          <img src="/assets/css-dos-logo-narrow.png" alt="CSS-DOS">
        </div>
        <div class="intro-text">
          <h1>CSS-DOS: A full 80s PC in a stylesheet.</h1>
          <p class="lede">
            Booting <b>DOS</b>, the first ever operating system, off an
            emulated floppy disk.
          </p>
          <p class="lede">Yes, it runs <b>DOOM</b> (very poorly).</p>
          <p class="intro-claim">
            This is the first time real<a href="#intro-fn" class="fn-ref">*</a>
            production computer programs have run in CSS.
          </p>
          <p class="intro-fn small" id="intro-fn">
            * &ldquo;real&rdquo; meaning production programs &mdash; the
            command shell, early computer games, and so on. Anything that
            runs on DOS may work here.
          </p>
        </div>
      </div>
    </div>
  {:else if nav.sub === 2}
    <!-- What is CSS? -->
    <div class="subpage" data-subpage="2">
      <h1>What is CSS?</h1>
      <p>
        If you&rsquo;re on this page you likely know &mdash; but let&rsquo;s
        recap. <b>HTML</b> defines the structure of a webpage;
        <b>CSS</b> adds styles on top of it. It can do simple things,
        but also has variables, functions, and branching:
      </p>

      <CssDemo />

      <p>
        Click through to the last two tabs. Variables, arithmetic,
        conditionals &mdash; that isn&rsquo;t styling any more. Those are
        the working parts of a programming language.
      </p>
      <p class="punchline">
        In fact, CSS is technically <b>Turing-complete</b> &mdash;
        <i>in theory</i>, it can run any computation at all. The rest of
        this section is about what it takes to do that in practice.
      </p>
    </div>
  {:else if nav.sub === 3}
    <!-- Why it's strange -->
    <div class="subpage" data-subpage="3">
      <h1>Why is this so strange?</h1>
      <p>
        Because <i>can compute</i> is a very long way from <i>is a
        computer</i>. CSS was never meant for this, and it is missing
        everything a computer is made of:
      </p>
      <ul class="cross-list">
        <li><span class="no">[ ]</span> Keyboard input</li>
        <li><span class="no">[ ]</span> Graphics output</li>
        <li><span class="no">[ ]</span> Memory you can write to</li>
        <li><span class="no">[ ]</span> Files of any kind</li>
        <li><span class="no">[ ]</span> Loops, or running anything twice</li>
      </ul>

      <p class="punchline">
        Each of those has to be rebuilt from what CSS <i>does</i> have.
        The next pages take them one at a time.
      </p>

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
    <!-- How it computes: clock → memory → CPU -->
    <div class="subpage" data-subpage="4">
      <h1>How it computes</h1>
      <p>
        A program is a list of steps that run one after another. A
        stylesheet just sits there: it describes how things should look,
        all at once, and nothing in it &ldquo;runs&rdquo;. So before
        anything else, the machine needs <b>time</b>.
      </p>
      <p>
        Exactly one thing in CSS changes on its own: an
        <b>animation</b>. So the machine&rsquo;s clock is one tiny
        animation, stepping a counter forever:
      </p>
      <pre class="byte-example"><code><span class="tok-prop">.clock</span> {'{'} animation: tick <span class="tok-num">400ms</span> steps(<span class="tok-num">4</span>) infinite; {'}'}
<span class="tok-comment">/* --clock: 0, 1, 2, 3,  0, 1, 2, 3,  &hellip; */</span></code></pre>
      <p>
        Each lap of that counter is one <b>tick</b>, and per tick the
        machine executes exactly one CPU instruction. Everything on this
        page happens once per tick.
      </p>

      <h3 class="anatomy-head">Memory</h3>
      <p>
        The file declares every byte of RAM, with its starting value:
      </p>
      <pre class="byte-example"><code><span class="tok-comment">/* 640 KB of RAM, one line each */</span>
<span class="tok-prop">--mem-00000</span>: <span class="tok-num">0</span>;
<span class="tok-prop">--mem-00001</span>: <span class="tok-num">85</span>;
<span class="tok-prop">--mem-00002</span>: <span class="tok-num">238</span>;
<span class="tok-comment">/* &hellip; ~650,000 more &hellip; */</span></code></pre>
      <p>
        But here&rsquo;s the catch: a CSS variable can&rsquo;t be
        overwritten. It can only be <i>defined</i> &mdash; once &mdash;
        as a formula.
      </p>
      <p>
        So memory works like a <b>spreadsheet</b>. No instruction ever
        reaches into a byte and changes it. Instead, every byte
        <i>pulls</i>: its formula looks at the current instruction and
        computes what its own next value must be.
      </p>

      <RamWrite />

      <h3 class="anatomy-head">The CPU is a switch</h3>
      <p>
        Registers are cells in the same spreadsheet, with one
        difference: their formulas switch on the current instruction.
        This miniature is real &mdash; try it:
      </p>

      <DispatchDemo />

      <p class="punchline">
        That&rsquo;s the entire machine: the animation advances, every
        formula on the sheet re-evaluates, and exactly one
        instruction&rsquo;s worth of change appears. There is no engine
        underneath doing the work &mdash; the re-evaluation <i>is</i>
        the work.
      </p>
    </div>
  {:else if nav.sub === 5}
    <!-- Screen & keys -->
    <div class="subpage" data-subpage="5">
      <h1>The screen &amp; the keys</h1>
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
    </div>
  {:else if nav.sub === 6}
    <!-- The file: everything baked in -->
    <div class="subpage" data-subpage="6">
      <h1>One file, everything included</h1>
      <p>
        CSS can&rsquo;t open anything at runtime &mdash; no files, no
        requests, no loading. Whatever the machine will ever need has to
        be in the stylesheet before it starts:
      </p>
      <ul class="sim-list">
        <li><span class="ok">[X]</span> The starting contents of all 640&nbsp;KB of RAM
          (you saw those declarations two pages ago)</li>
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
  {:else if nav.sub === 7}
    <AnatomyPage />
  {:else if nav.sub === 8}
    <TickPage />
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

      <h3 class="credits-head">Assets</h3>
      <ul class="credits-list">
        <li>
          Font: &ldquo;Web437 IBM VGA&rdquo; by VileR, from the
          <a href="https://int10h.org/oldschool-pc-fonts/" class="ext-link" target="_blank" rel="noopener">Oldschool PC Font Pack</a>
          (int10h.org) &mdash; CC&nbsp;BY-SA&nbsp;4.0.
        </li>
      </ul>
    </div>
  {/if}

</section>
