<script>
  // Home — the landing hero (formerly the About step's intro page).
  // Copy register per ABOUT-SCRIPT.md.
  import '../styles/_fragments/about.css';
  import Term from '../components/Term.svelte';
  import Wizard from '../components/Wizard.svelte';

  let { strip, wizNav } = $props();
</script>

<Wizard {strip} nav={wizNav}>
  <section class="step learn-step" data-step="1">
    <div class="subpage subpage-intro" data-subpage="1">
      <div class="intro-hero">
        <div class="intro-logo">
          <img src="/assets/css-dos-logo-narrow.png" alt="CSS-DOS">
        </div>
        <div class="intro-text">
          <h1>A complete 1980s PC, in a stylesheet.</h1>
          <p class="lede">
            An IBM PC compatible &mdash;
            <Term t="i8086">8086</Term> processor, 640&nbsp;KB of
            RAM, floppy drive, keyboard, VGA screen, and various
            less-memorable support chips &mdash; in one CSS file.
          </p>
          <p class="lede">
            It boots real <b>DOS</b> (the precursor to Windows) from an
            emulated <Term t="floppy">floppy</Term> and runs unmodified
            1980s software.
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
            text</b>. Every line is spec-compliant
            <Term t="css">CSS</Term>, albeit abused beyond recognition.
          </p>
          <p class="intro-gh">
            <a href="https://github.com/stop-amertime/css-dos" class="ext-link"
               target="_blank" rel="noopener">&#9733; View the source on GitHub</a>
          </p>
        </div>
      </div>
    </div>
  </section>
</Wizard>
