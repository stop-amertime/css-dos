<script>
  // About — three short pages: the claim, the why, and what's in the
  // box, ending in the fork (read on vs go build). The technical story
  // lives in HowItWorks.svelte. Copy per ABOUT-SCRIPT.md.
  import '../styles/_fragments/about.css';
  import { nav } from '../lib/router.svelte.js';
  import StepDots from '../components/StepDots.svelte';
  import Wizard from '../components/Wizard.svelte';

  let { strip, wizNav } = $props();

  const SUBPAGES = [
    { label: 'Intro' },
    { label: 'Why?' },
    { label: "What's in the box" },
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
    <!-- What's in the box + the fork -->
    <div class="subpage" data-subpage="3">
      <h1>What&rsquo;s in the box</h1>
      <p>
        One stylesheet, no JavaScript, simulating the whole machine:
      </p>
      <ul class="sim-list">
        <li><span class="ok">[X]</span> An Intel <b>8086</b> CPU</li>
        <li><span class="ok">[X]</span> 640&nbsp;KB of RAM</li>
        <li><span class="ok">[X]</span> A custom <b>BIOS</b>, booting real <b>DOS</b></li>
        <li><span class="ok">[X]</span> A FAT12 <b>floppy disk</b>, with your files on it</li>
        <li><span class="ok">[X]</span> Text mode and VGA graphics (Mode&nbsp;13h)</li>
        <li><span class="ok">[X]</span> A keyboard, a timer chip, and hardware interrupts</li>
      </ul>
      <p style="margin-top:12px">
        Faithfully enough that unmodified 1980s software can&rsquo;t tell
        the difference.
      </p>

      <div class="ext-link-box">
        <p>
          Lyra Rebane first built a working
          <a href="https://lyra.horse/x86css/" class="ext-link"
             target="_blank" rel="noopener">x86 CPU in pure CSS</a> &mdash;
          proof the trick works at all. CSS-DOS grew out of that: not a
          CPU demo, but the whole PC around one.
        </p>
      </div>

      <h3 class="anatomy-head">How deep do you want to go?</h3>
      <p>
        The next section explains how a styling language ends up running
        Doom. It&rsquo;s the interesting part, but nothing in it is
        required &mdash; you can also skip straight to building a
        cabinet of your own.
      </p>
      <div class="path-choice">
        <button class="btn primary path-btn" onclick={() => nav.go(2)}>
          Show me how it works &raquo;
        </button>
        <button class="btn path-btn" onclick={() => nav.go(3)}>
          Skip it &mdash; build me a cabinet &raquo;
        </button>
      </div>
    </div>
  {/if}

  </section>
</Wizard>
