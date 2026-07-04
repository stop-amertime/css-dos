<script>
  // About — six short pages: the claim, how it's possible (the
  // one-tool idea + the mechanisms), the How-it-works carousel (the
  // file dissected, with a map/overview landing page), the FAQs, the
  // why as an epilogue, and the credits. Copy register per
  // ABOUT-SCRIPT.md.
  import { fly } from 'svelte/transition';
  import '../styles/_fragments/about.css';
  import '../styles/_fragments/anatomy.css';
  import { nav, FILE_SECTIONS } from '../lib/router.svelte.js';
  import StepDots from '../components/StepDots.svelte';
  import Wizard from '../components/Wizard.svelte';
  import Foldable from '../components/Foldable.svelte';
  import CssDemo from '../components/CssDemo.svelte';
  import MoonViz from '../components/MoonViz.svelte';
  import CabinetBar from '../components/anatomy/CabinetBar.svelte';
  import { GROUPS } from '../components/anatomy/groups.js';
  import SectionMap from '../components/anatomy/SectionMap.svelte';
  import SectionUtil from '../components/anatomy/SectionUtil.svelte';
  import SectionCpu from '../components/anatomy/SectionCpu.svelte';
  import SectionKeys from '../components/anatomy/SectionKeys.svelte';
  import SectionScreen from '../components/anatomy/SectionScreen.svelte';
  import SectionMemDecl from '../components/anatomy/SectionMemDecl.svelte';
  import SectionMemWrite from '../components/anatomy/SectionMemWrite.svelte';
  import SectionMemRead from '../components/anatomy/SectionMemRead.svelte';
  import SectionDisk from '../components/anatomy/SectionDisk.svelte';
  import SectionClock from '../components/anatomy/SectionClock.svelte';

  let { strip, wizNav } = $props();

  // The cabinet carousel: the current section lives on the router
  // (nav.section) so it's addressable — #about/file/clock deep-links.
  const SECTIONS = {
    map: SectionMap, util: SectionUtil, cpu: SectionCpu, keys: SectionKeys,
    screen: SectionScreen, decl: SectionMemDecl, memw: SectionMemWrite,
    memr: SectionMemRead, disk: SectionDisk, clock: SectionClock,
  };
  // The map page isn't a file section (no bytes, no bar segment) —
  // it gets its own pane header and leaves the whole bar lit.
  const MAP_GROUP = { id: 'map', label: 'The whole file', size: '309 MB', c: '#555555' };
  const curGroup = $derived(GROUPS.find((x) => x.id === nav.section) ?? MAP_GROUP);
  const CurSection = $derived(SECTIONS[nav.section]);

  const SUBPAGES = [
    { label: 'Intro' },
    { label: 'How is this possible?' },
    { label: 'How it works' },
    { label: 'FAQs' },
    { label: 'Why?' },
    { label: 'Credits' },
  ];
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
            It boots real <b>DOS</b> (the precursor to Windows) from an
            emulated floppy and runs unmodified 1980s software.
          </p>
          <p class="lede">Yes, it runs <b>Doom</b><span class="flair-star">*</span></p>
          <div class="flair-burst">
            <div class="flair-text">
              <span>The first time real programs have run in CSS!</span>
            </div>
          </div>
          <p class="intro-fn small">
            <span class="fn-star">*</span> barely.
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
    <!-- How is this possible? -->
    <div class="subpage" data-subpage="2">
      <h1>How is this possible?</h1>
      <p>
        Everything in the machine is made of CSS variables &mdash;
        which are, basically, formulas. A variable can be defined in
        terms of other variables, so a variable can compute: every
        register, every byte of RAM, every pixel on the screen is a
        variable that works out its own value, the way a cell in a
        spreadsheet does.
      </p>

      <Foldable class="fold-bg">
        {#snippet summary()}Background: what CSS is{/snippet}
        <p>
          The language that describes how web pages look. The
          page&rsquo;s HTML holds the words and pictures; the CSS is
          the list of rules saying what colour, size and position
          everything gets. It was never meant to compute anything, but
          over the years it has picked up the working parts of a
          programming language &mdash; the newest of them,
          <code>@function</code> and <code>if()</code>, only reached
          browsers in the last couple of years:
        </p>
        <CssDemo />
      </Foldable>

      <p style="margin-top:16px">
        Six abilities, between them, cover the whole computer. Each is
        a stop on the <a href="#about/file">How-it-works tour</a>:
      </p>
      <ul class="sim-list">
        <li><code>calc()</code>, <code>mod()</code> and <code>round()</code>
          do real arithmetic &mdash; enough to build AND, OR and the rest
          of a CPU&rsquo;s toolkit (<a href="#about/file/util">utility functions</a>)</li>
        <li>one typed variable per pair of bytes holds the state
          (<a href="#about/file/decl">memory</a>)</li>
        <li>an <code>if()</code> table per register spells out what every
          instruction does to it (<a href="#about/file/cpu">the CPU</a>)</li>
        <li>64,000 <code>&lt;div&gt;</code>s each colour themselves from
          their byte of video memory (<a href="#about/file/screen">the screen</a>)</li>
        <li>the <code>:active</code> selector reads an on-screen keyboard
          (<a href="#about/file/keys">the keyboard</a>)</li>
        <li>one animation ticks a counter, and every formula in the file
          re-evaluates each tick (<a href="#about/file/clock">the clock</a>)</li>
      </ul>

      <p style="margin-top:16px">
        We have exactly one tool, and we are smacking every problem
        with it until it&rsquo;s fixed. Some problems that a very
        slightly different tool would fix in one hit get smacked a
        million times instead. All of those smacks have to be written
        down &mdash; that&rsquo;s how the file ends up at
        300&nbsp;MB of plain text:
      </p>
      <MoonViz />

      <p>
        A browser really will evaluate all of this &mdash; at about
        two instructions per second. At that speed, booting DOS takes
        a year and a half. So this site runs the same file through
        <b>Calcite</b>, a compiler that evaluates the same CSS about a
        hundred thousand times faster; the Play page explains how it
        works, and the rule that keeps it honest.
      </p>

      <div class="ext-link-box">
        <p>
          Lyra Rebane first built an
          <a href="https://lyra.horse/x86css/" class="ext-link"
             target="_blank" rel="noopener">x86 CPU in CSS</a> with a
          limited instruction set &mdash; this extends that work to a
          full machine running an unmodified OS and real programs.
        </p>
      </div>
    </div>
  {:else if nav.sub === 3}
    <!-- How it works — the bar as map, the sections as a carousel -->
    <div class="subpage" data-subpage="3">
      <h1>How it works</h1>

      <CabinetBar selected={nav.section === 'map' ? null : nav.section}
                  onselect={(g) => nav.sectionJump(g)} />

      <button class="sec-arrow sec-prev" onclick={() => nav.sectionStep(-1)}
              aria-label="Previous section" title="Previous section">&#9668;</button>
      <button class="sec-arrow sec-next" onclick={() => nav.sectionStep(1)}
              aria-label="Next section" title="Next section">&#9658;</button>
      <div class="anatomy-pane" style="--pane-c:{curGroup.c}">
        <h2 class="pane-head">
          <span class="chip" style="background:{curGroup.c}"></span>
          <span>{curGroup.label}</span>
          <span class="sz">{curGroup.size}</span>
          <span class="sec-count">{nav.sectionIdx() + 1} / {FILE_SECTIONS.length}</span>
        </h2>
        {#key nav.section}
          <div class="sec-body" in:fly={{ x: 44 * nav.sectionDir, duration: 180 }}>
            <CurSection />
          </div>
        {/key}
      </div>
    </div>
  {:else if nav.sub === 4}
    <!-- FAQs -->
    <div class="subpage" data-subpage="4">
      <h1>FAQs</h1>

      <div class="faq-list">
        <Foldable open={true}>
          {#snippet summary()}Really &mdash; no JavaScript?{/snippet}
          <p>
            Really &mdash; the machine is one CSS file, and a browser
            can evaluate every line of it; nothing you see comes from
            JavaScript. What a browser can&rsquo;t do is keep up:
            300&nbsp;MB of stylesheet is more than a tab survives, and
            even a small build runs at a couple of instructions per
            second. So this site feeds the same file to <b>Calcite</b>,
            a compiler built for the job &mdash; the Play page explains
            it, and why it isn&rsquo;t cheating.
          </p>
        </Foldable>

        <Foldable>
          {#snippet summary()}Don&rsquo;t you need an HTML page for this to work?{/snippet}
          <p>
            Yes &mdash; a small, dumb one. A tag that loads the
            stylesheet, one element for the clock, one for the CPU, and
            64,000 empty ones for the pixels. Nothing in it computes
            anything; it&rsquo;s scaffolding for the CSS to hang off.
          </p>
        </Foldable>

        <Foldable>
          {#snippet summary()}How can there be a clock? Nothing in CSS moves.{/snippet}
          <p>
            One thing in CSS moves by itself: animations. At the very
            bottom of the file a tiny animation ticks a counter &mdash;
            0, 1, 2, 3, forever &mdash; and each lap the machine
            advances by one instruction. The
            <a href="#about/file/clock">clock section</a> has the real
            keyframes, and the trick that lets 368,256 memory cells
            change at once.
          </p>
        </Foldable>

        <Foldable>
          {#snippet summary()}How does it draw video?{/snippet}
          <p>
            The screen is 64,000 boxes, 320 wide by 200 tall, each with
            a rule that turns its own byte of video memory into a
            background colour. The
            <a href="#about/file/screen">screen section</a> has the
            rules, the palette, and the faked electron beam.
          </p>
        </Foldable>

        <Foldable>
          {#snippet summary()}How do you control it? CSS can&rsquo;t see a keyboard.{/snippet}
          <p>
            It can&rsquo;t. What it can see is whether an element is
            currently being pressed &mdash; the <code>:active</code>
            selector &mdash; so the machine has an on-screen keyboard
            whose keys are real buttons. The
            <a href="#about/file/keys">keyboard section</a> shows the
            actual rules, live.
          </p>
        </Foldable>

        <Foldable>
          {#snippet summary()}Why is there no sound?{/snippet}
          <p>
            CSS has nothing that makes noise &mdash; there is no audio
            property to abuse the way animations get abused for time.
            The PC speaker stays silent, so Doom runs mute.
          </p>
        </Foldable>

        <Foldable>
          {#snippet summary()}Is Doom actually playable?{/snippet}
          <p>
            Barely &mdash; the asterisk on the intro page is honest.
            Through Calcite it manages a frame or two per second:
            enough to walk, open doors and shoot, a long way from
            comfortable.
          </p>
        </Foldable>

        <Foldable>
          {#snippet summary()}Can it run my own programs?{/snippet}
          <p>
            Yes &mdash; that&rsquo;s the Build step. Hand the builder
            any DOS program small enough for a floppy and it bakes the
            machine and your files into a fresh cabinet. The presets on
            the Build page were made the same way.
          </p>
        </Foldable>
      </div>
    </div>
  {:else if nav.sub === 5}
    <!-- Why? -->
    <div class="subpage" data-subpage="5">
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
        game, which only has three buttons and a microphone.
      </p>
      <p>
        I&rsquo;m under no illusion here: this project was excruciating
        to create and serves no practical benefit whatsoever. But it sits
        in that special nook between &lsquo;might be technically
        possible&rsquo; and &lsquo;impossible&rsquo; that draws the
        foolish and the brave recklessly in.
      </p>
    </div>
  {:else if nav.sub === 6}
    <!-- Credits (restored 2026-07-04 from the retired How-it-works route) -->
    <div class="subpage" data-subpage="6">
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
