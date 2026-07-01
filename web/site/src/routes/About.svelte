<script>
  import '../styles/_fragments/about.css';
  import { nav } from '../lib/router.svelte.js';
  import StepDots from '../components/StepDots.svelte';
  import CssDemo from '../components/CssDemo.svelte';
  import MoonViz from '../components/MoonViz.svelte';

  const SUBPAGES = [
    { label: 'Intro' },
    { label: "What's CSS?" },
    { label: "Why it's strange" },
    { label: 'The file' },
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

      <p class="punchline">
        This language is technically <b>Turing-complete</b> &mdash;
        which means, <i>in theory</i>, it can run any computation at all.
      </p>
    </div>
  {:else if nav.sub === 3}
    <!-- Why it's strange -->
    <div class="subpage" data-subpage="3">
      <h1>Why is this so strange?</h1>
      <p>
        We are very much <b>abusing</b> CSS here. It was never meant
        to do any of this. CSS has no support for:
      </p>
      <ul class="cross-list">
        <li><span class="no">[ ]</span> Keyboard input</li>
        <li><span class="no">[ ]</span> Graphics output</li>
        <li><span class="no">[ ]</span> Reading or writing memory</li>
        <li><span class="no">[ ]</span> Files of any kind</li>
        <li><span class="no">[ ]</span> Loops, or running the same rule twice</li>
      </ul>

      <p class="punchline">
        But we <i>can</i> emulate every single instruction a CPU
        executes &mdash; and once you can do that, you can emulate the
        whole machine around it.
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
        CSS-DOS is an extension of that work. On top of the CPU, it
        simulates:
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
    <!-- The file -->
    <div class="subpage" data-subpage="4">
      <h1>The file</h1>
      <p>
        The RAM is defined <b>literally, byte for byte</b>. Every cell
        of memory is one custom property:
      </p>
      <pre class="byte-example"><code><span class="tok-comment">/* 640 KB of RAM, one line each */</span>
<span class="tok-prop">--mem-00000</span>: <span class="tok-num">0</span>;
<span class="tok-prop">--mem-00001</span>: <span class="tok-num">85</span>;
<span class="tok-prop">--mem-00002</span>: <span class="tok-num">238</span>;
<span class="tok-comment">/* &hellip; ~650,000 more &hellip; */</span></code></pre>

      <p style="margin-top:12px">
        CSS cannot read files. So we have to <b>bake everything</b>
        &mdash; the entire computer, the BIOS, and your program&rsquo;s
        files themselves &mdash; into a <b>single file</b>.
      </p>
      <p>
        The Doom cabinet ends up at <b>332&nbsp;MB</b> of pure text.
        The entire original game of Zork is about <b>85&nbsp;KB</b> &mdash.
      </p>

      <MoonViz />
    </div>
  {:else if nav.sub === 5}
    <!-- Credits -->
    <div class="subpage" data-subpage="5">
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
