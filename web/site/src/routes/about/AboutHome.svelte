<script>
  // Home - the landing hero (the site's front page).
  import Term from '../../components/Term.svelte';
</script>

<div class="subpage subpage-intro">
  <div class="intro-hero">
    <div class="intro-logo">
      <img src="/assets/css-dos-logo-narrow.png" alt="CSS-DOS">
    </div>
    <div class="intro-text">
      <h1>An entire &rsquo;80s PC in a stylesheet.</h1>
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
     12px/char, 38 chars + box padding + border = 516px. The
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
    background: hsl(42 36% 54%);      /* old gold, desaturated (band) */
    transform: rotate(-6deg);
    clip-path: polygon(93.42% 50.00%, 94.22% 50.93%, 94.93% 51.88%, 95.46% 52.86%, 95.76% 53.84%, 95.80% 54.81%, 95.56% 55.76%, 95.06% 56.65%, 94.34% 57.50%, 93.45% 58.29%, 92.47% 59.03%, 91.48% 59.73%, 90.56% 60.41%, 89.77% 61.10%, 89.17% 61.83%, 88.79% 62.60%, 88.64% 63.46%, 88.70% 64.39%, 88.93% 65.41%, 89.28% 66.51%, 89.67% 67.66%, 90.02% 68.83%, 90.28% 69.99%, 90.37% 71.10%, 90.24% 72.12%, 89.88% 73.03%, 89.28% 73.79%, 88.46% 74.41%, 87.45% 74.88%, 86.32% 75.25%, 85.13% 75.52%, 83.94% 75.76%, 82.82% 76.01%, 81.82% 76.32%, 80.97% 76.74%, 80.31% 77.29%, 79.83% 78.01%, 79.50% 78.89%, 79.30% 79.92%, 79.17% 81.06%, 79.05% 82.27%, 78.90% 83.49%, 78.66% 84.65%, 78.29% 85.70%, 77.77% 86.58%, 77.07% 87.26%, 76.21% 87.71%, 75.21% 87.94%, 74.09% 87.97%, 72.91% 87.84%, 71.71% 87.60%, 70.53% 87.34%, 69.40% 87.11%, 68.36% 86.99%, 67.42% 87.02%, 66.59% 87.26%, 65.86% 87.72%, 65.20% 88.39%, 64.60% 89.25%, 64.01% 90.24%, 63.42% 91.30%, 62.79% 92.35%, 62.09% 93.31%, 61.33% 94.12%, 60.49% 94.71%, 59.57% 95.05%, 58.61% 95.11%, 57.60% 94.91%, 56.57% 94.49%, 55.54% 93.89%, 54.54% 93.18%, 53.57% 92.46%, 52.63% 91.79%, 51.73% 91.26%, 50.86% 90.91%, 50.00% 90.79%, 49.14% 90.91%, 48.27% 91.26%, 47.37% 91.79%, 46.43% 92.46%, 45.46% 93.18%, 44.46% 93.89%, 43.43% 94.49%, 42.40% 94.91%, 41.39% 95.11%, 40.43% 95.05%, 39.51% 94.71%, 38.67% 94.12%, 37.91% 93.31%, 37.21% 92.35%, 36.58% 91.30%, 35.99% 90.24%, 35.40% 89.25%, 34.80% 88.39%, 34.14% 87.72%, 33.41% 87.26%, 32.58% 87.02%, 31.64% 86.99%, 30.60% 87.11%, 29.47% 87.34%, 28.29% 87.60%, 27.09% 87.84%, 25.91% 87.97%, 24.79% 87.94%, 23.79% 87.71%, 22.93% 87.26%, 22.23% 86.58%, 21.71% 85.70%, 21.34% 84.65%, 21.10% 83.49%, 20.95% 82.27%, 20.83% 81.06%, 20.70% 79.92%, 20.50% 78.89%, 20.17% 78.01%, 19.69% 77.29%, 19.03% 76.74%, 18.18% 76.32%, 17.18% 76.01%, 16.06% 75.76%, 14.87% 75.52%, 13.68% 75.25%, 12.55% 74.88%, 11.54% 74.41%, 10.72% 73.79%, 10.12% 73.03%, 9.76% 72.12%, 9.63% 71.10%, 9.72% 69.99%, 9.98% 68.83%, 10.33% 67.66%, 10.72% 66.51%, 11.07% 65.41%, 11.30% 64.39%, 11.36% 63.46%, 11.21% 62.60%, 10.83% 61.83%, 10.23% 61.10%, 9.44% 60.41%, 8.52% 59.73%, 7.53% 59.03%, 6.55% 58.29%, 5.66% 57.50%, 4.94% 56.65%, 4.44% 55.76%, 4.20% 54.81%, 4.24% 53.84%, 4.54% 52.86%, 5.07% 51.88%, 5.78% 50.93%, 6.58% 50.00%, 7.40% 49.11%, 8.16% 48.25%, 8.79% 47.41%, 9.23% 46.58%, 9.43% 45.74%, 9.40% 44.87%, 9.15% 43.97%, 8.71% 43.02%, 8.15% 42.02%, 7.53% 40.97%, 6.93% 39.90%, 6.44% 38.82%, 6.13% 37.75%, 6.04% 36.73%, 6.20% 35.77%, 6.63% 34.90%, 7.31% 34.12%, 8.19% 33.45%, 9.22% 32.86%, 10.33% 32.34%, 11.45% 31.86%, 12.49% 31.38%, 13.41% 30.87%, 14.14% 30.29%, 14.68% 29.61%, 15.00% 28.80%, 15.14% 27.87%, 15.12% 26.83%, 15.01% 25.68%, 14.87% 24.48%, 14.77% 23.26%, 14.76% 22.07%, 14.90% 20.97%, 15.24% 19.99%, 15.78% 19.18%, 16.52% 18.56%, 17.46% 18.13%, 18.54% 17.87%, 19.72% 17.75%, 20.95% 17.73%, 22.16% 17.75%, 23.31% 17.74%, 24.35% 17.64%, 25.26% 17.41%, 26.02% 17.00%, 26.65% 16.40%, 27.15% 15.61%, 27.56% 14.64%, 27.93% 13.55%, 28.29% 12.40%, 28.69% 11.24%, 29.17% 10.15%, 29.75% 9.20%, 30.45% 8.45%, 31.27% 7.93%, 32.20% 7.66%, 33.23% 7.65%, 34.33% 7.85%, 35.45% 8.23%, 36.58% 8.70%, 37.68% 9.21%, 38.74% 9.67%, 39.73% 10.01%, 40.66% 10.16%, 41.52% 10.10%, 42.33% 9.81%, 43.11% 9.29%, 43.88% 8.57%, 44.66% 7.73%, 45.46% 6.82%, 46.30% 5.92%, 47.18% 5.12%, 48.09% 4.49%, 49.04% 4.09%, 50.00% 3.95%, 50.96% 4.09%, 51.91% 4.49%, 52.82% 5.12%, 53.70% 5.92%, 54.54% 6.82%, 55.34% 7.73%, 56.12% 8.57%, 56.89% 9.29%, 57.67% 9.81%, 58.48% 10.10%, 59.34% 10.16%, 60.27% 10.01%, 61.26% 9.67%, 62.32% 9.21%, 63.42% 8.70%, 64.55% 8.23%, 65.67% 7.85%, 66.77% 7.65%, 67.80% 7.66%, 68.73% 7.93%, 69.55% 8.45%, 70.25% 9.20%, 70.83% 10.15%, 71.31% 11.24%, 71.71% 12.40%, 72.07% 13.55%, 72.44% 14.64%, 72.85% 15.61%, 73.35% 16.40%, 73.98% 17.00%, 74.74% 17.41%, 75.65% 17.64%, 76.69% 17.74%, 77.84% 17.75%, 79.05% 17.73%, 80.28% 17.75%, 81.46% 17.87%, 82.54% 18.13%, 83.48% 18.56%, 84.22% 19.18%, 84.76% 19.99%, 85.10% 20.97%, 85.24% 22.07%, 85.23% 23.26%, 85.13% 24.48%, 84.99% 25.68%, 84.88% 26.83%, 84.86% 27.87%, 85.00% 28.80%, 85.32% 29.61%, 85.86% 30.29%, 86.59% 30.87%, 87.51% 31.38%, 88.55% 31.86%, 89.67% 32.34%, 90.78% 32.86%, 91.81% 33.45%, 92.69% 34.12%, 93.37% 34.90%, 93.80% 35.77%, 93.96% 36.73%, 93.87% 37.75%, 93.56% 38.82%, 93.07% 39.90%, 92.47% 40.97%, 91.85% 42.02%, 91.29% 43.02%, 90.85% 43.97%, 90.60% 44.87%, 90.57% 45.74%, 90.77% 46.58%, 91.21% 47.41%, 91.84% 48.25%, 92.60% 49.11%);
  }
  .flair-text {
    width: 112px;
    height: 112px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: hsl(47 44% 72%);      /* mustard fill, toned down */
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
</style>
