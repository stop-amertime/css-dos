<script>
  // Why? — the epigraph, the cave-painting bit, and the fork:
  // skip straight to Build, or read on.
  import { nav, BUILD } from '../../lib/router.svelte.js';
</script>

<div class="subpage">
  <h1>Why?</h1>
  <blockquote class="epigraph">
    <p>&ldquo;Because it&rsquo;s there&rdquo;</p>
    <cite>&mdash; George Mallory, when asked why he climbed Everest.</cite>
  </blockquote>
  <!-- TODO(owner): link the Dark Souls bongos run -->
  <p>
    Cave paintings started when some spare blood was misused to represent a deer. Fifty thousand years later, someone beat <i>Dark Souls</i> using the bongo drums controller from Gamecube rhythm game <i>Donkey Konga</i>.
  </p>
  <p>
    <b>I&rsquo;m under no illusion: this project was excruciating to create and serves no practical benefit whatsoever.</b> &ldquo;Dugg, why are you wasting perfectly good blood on the cave walls, you mad idiot? We&rsquo;ll have none left for all the rituals that need doing!&rdquo; Dugg didn&rsquo;t have an answer for &lsquo;why?&rsquo;. The rituals have been lost to time, but the deer is now encased in glass. I don&rsquo;t think anyone&rsquo;s even bothered asking the <i>Dark Souls</i> bongo drums guy why he did it. I also don&rsquo;t have a good answer to the question, only one as vague and meaningless as Mallory&rsquo;s: because it <i>wasn&rsquo;t</i> there.
  </p>
  <div class="why-cta">
    <button class="btn why-cta-btn" onclick={() => nav.go(BUILD)}>
      TRY IT OUT IMMEDIATELY
      <span class="why-cta-sub">(for the impatient)</span>
    </button>
    <button class="btn primary why-cta-btn" onclick={() => nav.goHowItWorks()}>
      FIND OUT HOW IT WORKS
      <span class="why-cta-sub">(recommended)</span>
    </button>
  </div>
</div>

<style>
  .subpage {
    max-width: 680px;
    margin-inline: auto;
  }
  .epigraph {
    margin: 4px 0 18px;
    padding-left: 14px;
    border-left: 3px solid var(--edit-black);
  }
  .epigraph p { margin: 0 0 2px; font-style: italic; }
  .epigraph cite { font-style: normal; font-size: 13px; color: #555; }

  /* The fork: skip straight to Build, or read on. Stacked, matching
     widths, centred in the column, so the choice reads as THE call to
     action. */
  .why-cta {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    margin-top: 24px;
  }
  .why-cta-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 10px 20px;
    min-width: min(360px, 100%);
  }
  .why-cta-sub {
    font-size: 12px;
    line-height: 14px;
    opacity: 0.75;
  }
</style>
