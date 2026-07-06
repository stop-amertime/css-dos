<script>
  import '../styles/_fragments/play.css';
  import Wizard from '../components/Wizard.svelte';
  import EnvNotice from '../components/EnvNotice.svelte';
  import { nav } from '../lib/router.svelte.js';
  import { build } from '../lib/builder.svelte.js';
  import { health } from '../lib/health.svelte.js';
  import { getCabinet } from '/browser-builder/storage.mjs';

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

  // This page re-verifies its own precondition: the cabinet must be in
  // Cache Storage (the bridge streams it from there), and a reload, SW
  // update, or cache eviction can drop it while the route still says
  // "playable". No cabinet → bounce to the Build step's picker. The
  // freshly-built blob in memory (build.done) also counts — it's saved
  // to the cache right after the build.
  $effect(() => {
    if (!nav.canPlay) { nav.bounceFromPlay(); return; }
    getCabinet().then((hit) => {
      if (!hit && !build.done && !build.busy) {
        build.restored = false;
        nav.bounceFromPlay();
      }
    }).catch(() => {});
  });

  // Size the iframe to its content: the embed document is just the
  // screen + keyboard, and it's same-origin, so measure it instead of
  // guessing with viewport units (which left a tall dead band and
  // pushed the Calcite note off-screen). ResizeObserver follows font
  // loads and the keyboard reflowing at narrow widths.
  let frameH = $state(0);
  function fitToContent(frame) {
    let ro = null;
    const measure = () => {
      // body, not documentElement: the html element fills the iframe's
      // viewport, so its scrollHeight can never shrink below the CSS
      // fallback height. The embed body hugs the content (min-height 0).
      const h = frame.contentDocument?.body?.scrollHeight;
      if (h) frameH = h + 2; // hairline slack: keep borders from clipping
    };
    const onload = () => {
      measure();
      const body = frame.contentDocument?.body;
      if (body && typeof ResizeObserver !== 'undefined') {
        ro = new ResizeObserver(measure);
        ro.observe(body);
      }
    };
    frame.addEventListener('load', onload);
    return { destroy() { frame.removeEventListener('load', onload); ro?.disconnect(); } };
  }

  // Back to the Build step's cart picker.
  function pickDifferent() {
    nav.buildSub = 1;
    nav.go(2);
  }
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && (rawModal = false)} />

<Wizard {strip} nav={wizNav}>
<EnvNotice />

{#if playing}
<div class="inline-player">
  <div class="inline-player-bar">
    <button class="soft-btn" onclick={pickDifferent}>&larr; Change program</button>
    {#if health.engineError}
      <span class="inline-player-status error">{health.engineError}</span>
    {/if}
    <a class="inline-player-pop" href="/player/calcite.html" target="_blank" rel="noopener">Pop out &#8599;</a>
    <button class="btn inline-player-stop" onclick={() => stopped = true}>Stop</button>
  </div>
  <iframe class="inline-player-frame" use:fitToContent
          style={frameH ? `height:${frameH}px` : ''}
          src="/player/calcite.html#embed" title="CSS-DOS player"></iframe>
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
