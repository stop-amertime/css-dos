<script>
  import { nav, ABOUT, PLAY, ABOUT_FILE_SUB } from './lib/router.svelte.js';
  import { build } from './lib/builder.svelte.js';
  import StepDots from './components/StepDots.svelte';
  import About from './routes/About.svelte';
  import Build from './routes/Build.svelte';
  import Play from './routes/Play.svelte';

  const STRIP = [
    { label: 'About' },
    { label: 'Build' },
    { label: 'Play' },
  ];
  const TITLES = ['About', 'Build cabinet', 'Play'];

  $effect(() => {
    document.title = nav.atStart ? 'CSS-DOS' : `CSS-DOS — ${TITLES[nav.step - 1]}`;
  });

  function onkeydown(e) {
    if (e.target?.matches?.('input, textarea, select, [contenteditable]')) return;
    // next()/prev() walk the How-it-works carousel's sections themselves,
    // so the arrows are plain page turns everywhere.
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      if (!nav.nextDisabled && !nav.isLast) nav.next();
    }
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      if (!nav.atStart) nav.prev();
    }
    if (e.key === 'Escape' && !nav.atStart) { e.preventDefault(); nav.prev(); }
  }
</script>

<svelte:window {onkeydown} />

<div class="menu-bar">
  <span class="menu-item"><span class="hot">F</span>ile</span>
  <span class="menu-item"><span class="hot">E</span>dit</span>
  <span class="menu-item"><span class="hot">V</span>iew</span>
  <span class="menu-item"><span class="hot">O</span>ptions</span>
  <span class="menu-item"><span class="hot">H</span>elp</span>
  <span class="menu-title">CSS-DOS SETUP</span>
</div>

{#snippet strip()}
  <StepDots
    variant="strip"
    items={STRIP}
    current={nav.step}
    onjump={(n) => nav.jump(n)}
    disabled={(n) => n === PLAY && !nav.canPlay}
  />
{/snippet}

{#snippet wizNav()}
  <div class="wiz-nav">
    <button class="btn" disabled={nav.atStart} onclick={() => nav.prev()}>
      « <span class="hot">B</span>ack
    </button>
    <span class="wiz-nav-spacer"></span>
    {#if nav.step === ABOUT && nav.sub === ABOUT_FILE_SUB && nav.sectionIdx() > 0}
      <!-- Deep in the File Map carousel: an exit that skips the rest of it. -->
      <button class="btn" onclick={() => nav.skipFileMap()}>
        <span class="hot">S</span>kip &raquo;&raquo;&raquo;
      </button>
    {/if}
    {#if nav.step === PLAY}
      <!-- Play is the flow's end: forward goes to the info pages, landing
           where the Why? page's skip button would have left you. -->
      <button class="btn primary" onclick={() => nav.goHowItWorks()}>
        How it <span class="hot">W</span>orks »
      </button>
    {:else}
      <button class="btn primary" disabled={nav.nextDisabled} onclick={() => nav.next()}>
        <span class="hot">N</span>ext »
      </button>
    {/if}
  </div>
{/snippet}

{#if nav.step === ABOUT}
  <About {strip} {wizNav} />
{:else if nav.step === 2}
  <Build {strip} {wizNav} />
{:else}
  <Play {strip} {wizNav} />
{/if}

<div class="status-line">
  <span class="skey"><b>←</b>=Back</span>
  <span class="skey"><b>→</b>=Next</span>
  <span class="skey"><b>Esc</b>=Back</span>
  <span class="skey" style="margin-left:auto">{build.status}</span>
</div>
