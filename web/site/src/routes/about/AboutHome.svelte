<script module>
  // Once per page load: the first time the hero is shown counts as
  // "landed on the landing page" (deep links elsewhere never fire it).
  let landed = false;
</script>

<script>
  // Home - the landing hero (the site's front page).
  import Term from '../../components/Term.svelte';
  import { track } from '../../lib/analytics.js';

  if (!landed) { landed = true; track('landing'); }
</script>

<div class="subpage subpage-intro">
  <div class="intro-hero">
    <div class="intro-logo">
      <img src="/assets/css-dos-logo-narrow.png" alt="CSS-DOS">
    </div>
    <div class="intro-text">
      <h1>An entire &rsquo;80s PC implemented in pure <Term t="css">CSS</Term>.</h1>
      <p class="lede">
        An <Term t="i8086">8086</Term> CPU, chipset, 640&nbsp;KB RAM, floppy, keyboard and VGA screen in one <code>.css</code> file.
      </p>
      <p class="lede">
        It&rsquo;s a morbidly obese <b>300+&nbsp;MB</b> of spec-compliant <Term t="css">CSS</Term>, abused beyond recognition; some of the most delightfully painful and wasteful code ever cursed to exist.
      </p>
      <p class="lede">
        It boots <b>Microsoft Windows 1.0</b> and its namesake MS-DOS, and runs real &rsquo;80s software.
      </p>
      <p class="lede">Yes, it runs <b>DOOM</b><span class="flair-star">*</span></p>
      <div class="flair-burst">
        <div class="flair-text">
          <span><span class="fl-1">The</span><span
            class="fl-2">first time</span><span
            class="fl-3">real software</span><span
            class="fl-4">has run</span><span
            class="fl-5">in CSS!</span></span>
        </div>
      </div>
      <p class="intro-fn small">
        <span class="fn-star">*</span> barely.
      </p>
      <div class="intro-links">
        <a href="https://github.com/stop-amertime/css-dos" target="_blank" rel="noopener">
          <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"/></svg>Source</a>
        <a href="https://ahmedamer.co.uk" target="_blank" rel="noopener">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true"><circle cx="8" cy="8" r="6.6"/><ellipse cx="8" cy="8" rx="3" ry="6.6"/><path d="M1.6 8h12.8M2.5 4.6h11M2.5 11.4h11"/></svg>My site</a>
        <a href="https://ahmedamer.co.uk/#contact" target="_blank" rel="noopener">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true"><rect x="1.4" y="3.2" width="13.2" height="9.6"/><path d="M1.8 3.8 8 8.8l6.2-5"/></svg>Contact me</a>
        <a href="/about/faqs/ai">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true"><path d="M8 2.6C7.5 1.8 6.4 1.5 5.5 2 4.4 2.1 3.5 3 3.5 4.1c0 .3.06.6.18.85C2.7 5.3 2 6.2 2 7.3c0 .9.5 1.7 1.2 2.1-.13.3-.2.63-.2.95C3 11.6 4 12.6 5.2 12.6c.16 0 .3-.02.46-.05C5.9 13.4 6.7 14 7.6 14H8M8 2.6c.5-.8 1.6-1.1 2.5-.6 1.1.1 2 1 2 2.1 0 .3-.06.6-.18.85C13.3 5.3 14 6.2 14 7.3c0 .9-.5 1.7-1.2 2.1.13.3.2.63.2.95 0 1.25-1 2.25-2.2 2.25-.16 0-.3-.02-.46-.05-.24.85-1.04 1.45-1.94 1.45M8 2.6V14"/></svg>Is this AI?</a>
      </div>
    </div>
  </div>
</div>

<style>
  /* Prose sub-pages read as a centred column: text stays left-aligned
     inside it, but the column itself sits centred in the dialog. */
  .subpage {
    max-width: 680px;
    margin-inline: auto;
  }
  /* Only this sub-page fills the body height; the others keep their
     natural top-aligned flow. (window-body min-height 480 − 40 pad.) */
  .subpage-intro {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 420px;
  }
  .intro-hero {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;
  }
  .intro-logo img {
    width: 160px;
    height: 160px;
    display: block;
    image-rendering: pixelated;
  }
  .intro-text {
    /* The readable measure (owner: readability beats a bigger title). */
    max-width: 520px;
    text-align: left;
  }
  /* The hero h1 keeps the global TUI title box (owner likes it) - sized
     so the title fits the 520px column on one line: 24px WebVGA =
     12px/char, 42 chars = 504px, a 4px squeak inside the box's 508px
     content width - lengthening the title AT ALL breaks the line. The
     :global(.window.wizard) prefix keeps this ahead of global.css's
     `.window.wizard h1` in specificity, as the old fragment rule was. */
  :global(.window.wizard) .intro-hero h1 {
    font-size: 24px;
    line-height: 24px;
    white-space: nowrap;
    /* Full column width, not fit-content: the box's edges line up
       exactly with the prose measure below it. */
    width: 100%;
  }
  .intro-hero .lede {
    font-size: 16px;
    line-height: 20px;
    margin-bottom: 10px;
  }
  /* 80s game-box flash - a seal-of-approval sticker whose edge is a
     TRUE radial sine wave: r(θ) = 66px + 4px·sin(15θ), sampled at 300
     points into a clip-path polygon. (Compositing circles cannot make
     this shape - unions give convex petals, bites give bottle caps;
     both were tried and pulled.) Regenerate the polygon with:
       node -e "const p=[];for(let i=0;i<300;i++){const t=i/300*2*Math.PI,
       r=66+4*Math.sin(15*t);p.push((50+r*Math.cos(t)/1.52).toFixed(2)+'% '+
       (50+r*Math.sin(t)/1.52).toFixed(2)+'%')};console.log(p.join(', '))"
     - percentages of the 152px box, so it scales with the element. */
  .flair-burst {
    width: 152px;
    height: 152px;
    margin: 10px 24px 8px auto;
    display: grid;
    place-items: center;
    background: var(--seal-gold-band);
    transform: rotate(-6deg);
    clip-path: var(--seal-wiggle);
  }
  .flair-text {
    width: 112px;
    height: 112px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: var(--seal-gold-fill);
  }
  /* Five lines set to the circle's chords, so the text fills the disc
     (widths: 30 → 90 → 104 → 72 → 56px against a 112px disc; each
     line's width sits just inside the chord at its own height). The
     spans are blocks (base rule below) - no <br>s, which would insert
     empty line boxes and blow the leading apart. line-height ==
     font-size keeps the stack tight. */
  .flair-text .fl-1 { font-size: 20px; line-height: 20px; }
  .flair-text .fl-2 { font-size: 18px; line-height: 18px; }
  .flair-text .fl-3 { font-size: 16px; line-height: 16px; }
  .flair-text .fl-4 { font-size: 18px; line-height: 18px; }
  .flair-text .fl-5 { font-size: 16px; line-height: 16px; }
  .flair-text span {
    display: block;
    text-align: center;
    color: var(--edit-black);
    /* 14px: the longest forced line (HAVE RUN IN CSS!) has to clear the
       122px inner disc's chord one row below centre. */
    font-size: 14px;
    line-height: 16px;
    letter-spacing: -0.3px;
    text-transform: uppercase;
  }
  .flair-star {
    color: var(--edit-red);
    text-decoration: none;
    vertical-align: super;
    font-size: 11px;
  }
  .intro-fn {
    margin: 0;
    color: #555;
    line-height: 14px;
    align-self: flex-start;
  }
  .intro-fn .fn-star { color: var(--edit-red); }
  /* The hero's footer links: Source / My site / Contact me, icon + word
     each, side by side (wrapping on narrow phones). */
  .intro-links {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 22px;
    margin: 12px 0 0;
    font-size: 14px;
    line-height: 16px;
  }
  .intro-links a {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: var(--edit-blue);
    text-decoration: none;
    /* A link never breaks internally ("Contact\nme" read as two rows) -
       the row wraps between links or not at all. */
    white-space: nowrap;
  }
  .intro-links a:hover { text-decoration: underline; }
  .intro-links svg { width: 15px; height: 15px; flex: none; }

  @media (max-width: 640px) {
    /* Phone: the one-line title box (24px, nowrap) is wider than the
       screen and its min-content width drags the whole dialog into
       horizontal overflow - let it wrap at the global phone h1 size. */
    :global(.window.wizard) .intro-hero h1 {
      white-space: normal;
      font-size: 22px;
      line-height: 24px;
    }
  }

  @media (max-width: 460px) {
    /* Narrow phones: the four links can't share one row, and free flex
       wrap breaks 3+1 (a lonely "Is this AI?" on its own row). Two
       tidy content-sized columns instead. Above this width one row
       fits and the flex layout stays. */
    .intro-links {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, auto));
      justify-content: start;
      gap: 8px 28px;
    }
  }
</style>
