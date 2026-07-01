<script>
  import { nav } from './lib/router.svelte.js';
  import { build } from './lib/builder.svelte.js';
  import StepDots from './components/StepDots.svelte';
  import About from './routes/About.svelte';
  import Build from './routes/Build.svelte';
  import Play from './routes/Play.svelte';

  const STRIP = [{ label: 'About' }, { label: 'Build' }, { label: 'Play' }];
  const TITLES = ['About', 'Build cabinet', 'Play'];

  $effect(() => { document.title = `CSS-DOS — ${TITLES[nav.step - 1]}`; });

  function onkeydown(e) {
    if (e.target?.matches?.('input, textarea, select, [contenteditable]')) return;
    if (e.key === 'ArrowRight' && !nextDisabled) { e.preventDefault(); nav.next(); }
    if ((e.key === 'ArrowLeft' || e.key === 'Escape') && !nav.atStart) { e.preventDefault(); nav.prev(); }
  }

  let nextDisabled = $derived(nav.step === 2 && !build.done);
  let nextLabel = $derived(nav.isLast ? ['R', 'estart'] : ['N', 'ext »']);
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

<div class="window wizard" class:play-wide={nav.step === 3}>
  <StepDots
    variant="strip"
    items={STRIP}
    current={nav.step}
    onjump={(n) => nav.jump(n)}
    disabled={(n) => n === 3 && !build.done}
  />

  <div class="window-body">
    {#if nav.step === 1}
      <About />
    {:else if nav.step === 2}
      <Build />
    {:else}
      <Play />
    {/if}
  </div>

  <div class="wiz-nav">
    <button class="btn" disabled={nav.atStart} onclick={() => nav.prev()}>
      « <span class="hot">B</span>ack
    </button>
    <span class="wiz-nav-spacer"></span>
    <button class="btn primary" disabled={nextDisabled} onclick={() => nav.next()}>
      <span class="hot">{nextLabel[0]}</span>{nextLabel[1]}
    </button>
  </div>
</div>

<div class="status-line">
  <span class="skey"><b>←</b>=Back</span>
  <span class="skey"><b>→</b>=Next</span>
  <span class="skey"><b>Esc</b>=Back</span>
  <span class="skey" style="margin-left:auto">{build.status}</span>
</div>
