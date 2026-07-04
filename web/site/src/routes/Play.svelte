<script>
  import '../styles/_fragments/play.css';
  import Wizard from '../components/Wizard.svelte';
  import EnvNotice from '../components/EnvNotice.svelte';
  import { nav } from '../lib/router.svelte.js';
  import { health } from '../lib/health.svelte.js';

  let { strip, wizNav } = $props();

  // Calcite is the default and the player starts embedded straight
  // away — /player/calcite.html#embed hides the player's decorative
  // desktop chrome (pure-CSS :target), so the iframe is just the
  // screen + keyboard. Pop-out opens the full blue-desktop player.
  // The bridge worker (WASM engine) lives in THIS tab; mobile Chrome
  // freezes background tabs, so the old two-tab flow starved the
  // frame stream the moment the player tab took focus.
  let stopped = $state(false);
  let rawModal = $state(false);
  const playing = $derived(health.canRun && !stopped);

  // Back to the Build step's cart picker.
  function pickDifferent() {
    nav.buildSub = 1;
    nav.go(2);
  }
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && (rawModal = false)} />

<Wizard {strip} nav={wizNav}>
<button class="btn play-back" onclick={pickDifferent}>
  &larr; Select a different program
</button>

<EnvNotice />

{#if playing}
<div class="inline-player">
  <div class="inline-player-bar">
    <span class="inline-player-title">CSS-DOS</span>
    <span class="inline-player-status" class:error={health.engineError}>
      {health.engineError || health.engineStatus}
    </span>
    <a class="inline-player-pop" href="/player/calcite.html" target="_blank" rel="noopener">Pop out &#8599;</a>
    <button class="btn inline-player-stop" onclick={() => stopped = true}>Stop</button>
  </div>
  <iframe class="inline-player-frame" src="/player/calcite.html#embed" title="CSS-DOS player"></iframe>
</div>
{:else if health.canRun}
<button class="btn play-restart" onclick={() => stopped = false}>&#9654; Start the player</button>
{/if}

<p class="play-note">
  This is running through <b>Calcite</b>, a JIT compiler for CSS &mdash;
  <a href="#about/calcite">how it works, and why it isn&rsquo;t
  cheating</a>. Or
  <button class="link-btn" onclick={() => rawModal = true}>try the raw
  CSS version</button>.
</p>

{#if rawModal}
<div class="raw-overlay" role="presentation"
     onclick={(e) => e.target === e.currentTarget && (rawModal = false)}>
  <div class="window raw-modal" role="dialog" aria-modal="true" aria-label="Run the raw CSS?">
    <div class="title-bar">Run the raw CSS?</div>
    <div class="window-body">
      <p>
        This opens the same cabinet as a plain stylesheet in a plain
        tab &mdash; no Calcite, just your browser&rsquo;s own CSS engine
        chewing through 300&nbsp;MB.
      </p>
      <p>
        <b>It <u>will</u> crash the browser.</b> Expect a frame or two
        per <i>month</i> before it does. Save your work first.
      </p>
      <p class="small">
        Why it&rsquo;s this slow &mdash; and what Calcite does instead
        &mdash; is on <a href="#about/calcite"
        onclick={() => rawModal = false}>the Calcite page</a>.
      </p>
      <div class="raw-modal-btns">
        <a class="btn" href="/player/raw.html" target="_blank" rel="noopener"
           onclick={() => rawModal = false}>I understand &mdash; open it</a>
        <button class="btn" onclick={() => rawModal = false}>Cancel</button>
      </div>
    </div>
  </div>
</div>
{/if}
</Wizard>
