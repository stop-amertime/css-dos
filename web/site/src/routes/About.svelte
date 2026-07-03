<script>
  // About — five short pages: the claim, what's in the box, the why,
  // the FAQs (the one-idea entrance + expandable questions), and the
  // contents of the file itself (becomes the clickable map). Copy per
  // ABOUT-SCRIPT.md.
  import '../styles/_fragments/about.css';
  import { nav } from '../lib/router.svelte.js';
  import StepDots from '../components/StepDots.svelte';
  import Wizard from '../components/Wizard.svelte';
  import Foldable from '../components/Foldable.svelte';
  import CssDemo from '../components/CssDemo.svelte';

  let { strip, wizNav } = $props();

  const SUBPAGES = [
    { label: 'Intro' },
    { label: "What's in the box" },
    { label: 'Why?' },
    { label: 'FAQs' },
    { label: "What's in the file" },
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
    <!-- What's in the box -->
    <div class="subpage" data-subpage="2">
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
    </div>
  {:else if nav.sub === 3}
    <!-- Why? -->
    <div class="subpage" data-subpage="3">
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
  {:else if nav.sub === 4}
    <!-- FAQs — the one idea, then the questions -->
    <div class="subpage" data-subpage="4">
      <h1>FAQs</h1>
      <p>
        It&rsquo;s ALL made of CSS variables, which are formulas,
        basically. Everything is a CSS variable which calculates its
        thing. The amount of complexity that that one sentence hides is
        difficult to comprehend.
      </p>
      <p>
        We have exactly one tool, and we are smacking every problem with
        it until it&rsquo;s fixed. Some problems that could be fixed with
        a very slightly different tool are smacked a million times
        instead.
      </p>

      <div class="faq-list">
        <Foldable>
          {#snippet summary()}What even is CSS?{/snippet}
          <p>
            The language that describes how web pages look. The
            page&rsquo;s HTML holds the words and pictures; the CSS is
            the list of rules saying what colour, size and position
            everything gets. It was never meant to compute anything, but
            over the years it has picked up the working parts of a
            programming language:
          </p>
          <CssDemo />
        </Foldable>

        <Foldable>
          {#snippet summary()}Wait &mdash; CSS can do maths?{/snippet}
          <p>
            Yes. A variable can hold a number, and functions like
            <code>calc()</code>, <code>mod()</code> and
            <code>round()</code> can do arithmetic on it. One variable
            can be defined in terms of others &mdash; which is what makes
            a variable a formula. That is the entire toolkit: the
            registers, the RAM, the screen and the disk are all
            variables, and everything that happens in the machine is
            those formulas being recalculated.
          </p>
        </Foldable>

        <Foldable>
          {#snippet summary()}How can there be a clock? Nothing in CSS moves.{/snippet}
          <p>
            One thing in CSS moves by itself: animations. At the very
            bottom of the file is a tiny animation whose only job is to
            flip a variable back and forth, forever. Each flip is one
            tick of the machine, one tick executes one instruction, and
            every formula in the file re-evaluates against the new state.
          </p>
        </Foldable>

        <Foldable>
          {#snippet summary()}How does it draw video?{/snippet}
          <p>
            The screen is 64,000 boxes on the page &mdash; 320 wide by
            200 tall. Each box has a rule that reads its own byte of the
            machine&rsquo;s video memory and turns the value into a
            background colour. When a program writes to video memory, the
            boxes whose bytes changed recalculate, and the picture
            changes.
          </p>
        </Foldable>

        <Foldable>
          {#snippet summary()}How do you control it? CSS can&rsquo;t see a keyboard.{/snippet}
          <p>
            It can&rsquo;t. What it can see is whether an element is
            currently being pressed &mdash; the <code>:active</code>
            selector. So the machine has an on-screen keyboard; while you
            hold one of its keys, that key&rsquo;s <code>:active</code>
            rule matches, and the CSS reads it as a keypress.
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
          {#snippet summary()}Really &mdash; no JavaScript?{/snippet}
          <p>
            Really<span class="flair-star">*</span> &mdash; the machine
            is one CSS file, and a browser can evaluate every line of it.
          </p>
          <p>
            The asterisk: at browser speed it manages about two
            instructions per second, so booting DOS would take a year and
            a half. This site runs the same file through <b>Calcite</b>,
            a compiler built for the job, which evaluates the same CSS
            roughly a hundred thousand times faster. Calcite doesn&rsquo;t
            get to change the rules: if it ever disagrees with what a
            browser would compute, Calcite is wrong.
          </p>
        </Foldable>
      </div>
    </div>
  {:else if nav.sub === 5}
    <!-- What's in the file — becomes the clickable map -->
    <div class="subpage" data-subpage="5">
      <h1>What&rsquo;s in the file</h1>
      <p>
        The whole machine is one 309&nbsp;MB stylesheet. This is what
        those megabytes are, measured from a real cabinet:
      </p>
      <table class="data-table">
        <thead>
          <tr><th>Part</th><th>Size</th></tr>
        </thead>
        <tbody>
          <tr><td>The header comment</td><td class="num">25 KB</td></tr>
          <tr><td>The CPU</td><td class="num">320 KB</td></tr>
          <tr><td>The keyboard &amp; debug display</td><td class="num">4 KB</td></tr>
          <tr><td>The screen</td><td class="num">6.5 MB</td></tr>
          <tr><td>Memory: storing and changing it</td><td class="num">203 MB</td></tr>
          <tr><td>Memory: reading it</td><td class="num">44 MB</td></tr>
          <tr><td>The disk</td><td class="num">13 MB</td></tr>
          <tr><td>The clock</td><td class="num">43 MB</td></tr>
        </tbody>
      </table>
      <p class="placeholder-note">
        [under construction: this page becomes the clickable map &mdash;
        the file drawn to scale, each part opening its own story]
      </p>
    </div>
  {/if}

  </section>
</Wizard>
