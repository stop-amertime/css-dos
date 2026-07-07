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

  // Per-cart hints toast — display.playTips in the cart's program.json
  // (see docs/cart-format.md). Only a cart picked this session carries
  // tips; a cabinet restored after a reload has no cart metadata, so no
  // toast. Dismissal is remembered per cart, not globally, so building
  // a different cart shows its own tips.
  let tipsDismissedFor = $state(null);
  const tips = $derived(build.cart?.program?.display?.playTips ?? null);
  const tipsOpen = $derived(!!tips?.length && tipsDismissedFor !== build.cart?.name);

  // Minimal inline markdown: '[text](url)' → link segments.
  function mdSegments(line) {
    const out = [];
    let rest = line, m;
    while ((m = rest.match(/\[([^\]]+)\]\(([^)]+)\)/))) {
      if (m.index > 0) out.push({ text: rest.slice(0, m.index) });
      out.push({ text: m[1], href: m[2] });
      rest = rest.slice(m.index + m[0].length);
    }
    if (rest) out.push({ text: rest });
    return out;
  }

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
    const attach = () => {
      measure();
      // The observer must be created by the IFRAME's window, not ours: a
      // parent-window ResizeObserver watching a child-document body does
      // not fire reliably in Chrome (the frame stayed 610px tall after
      // the keyboard reflowed to 421px at phone width). Re-created on
      // every load — the old one dies with the old document.
      const win = frame.contentWindow;
      const body = frame.contentDocument?.body;
      ro?.disconnect();
      ro = null;
      if (win?.ResizeObserver && body) {
        ro = new win.ResizeObserver(measure);
        ro.observe(body);
      }
    };
    frame.addEventListener('load', attach);
    // A cached/SW-served document can finish loading before this action
    // attaches — then 'load' never fires and the frame would sit on the
    // CSS fallback height forever (the "huge gap under the keyboard").
    if (frame.contentDocument?.readyState === 'complete') attach();
    // Belt-and-braces: our own resizes always reflow the embed.
    window.addEventListener('resize', measure);
    return {
      destroy() {
        frame.removeEventListener('load', attach);
        window.removeEventListener('resize', measure);
        ro?.disconnect();
      },
    };
  }

  // Back to the Build step's cart picker.
  function pickDifferent() {
    nav.buildSub = 1;
    nav.go(2);
  }

  // Squish-to-fit: on short viewports the full-size embed (screen +
  // keyboard) can be taller than the band between the wizard's pinned
  // chrome, leaving the page scrolling and the note off-screen. Scale
  // the iframe down (transform, top-center origin — layout width is
  // untouched, so the embed never reflows and the measurement can't
  // feed back) until player + note fit with a small margin all round.
  //
  // Geometry: play.css gives the Play window a FIXED viewport-fit
  // height and bottom-pins the note with an auto margin, so the scroll
  // band's clientHeight is a constant we can size against; the flex
  // gap between player and note is measured and excluded so the
  // "everything but the player" number is scale-independent.
  let viewH = $state(typeof window !== 'undefined' ? window.innerHeight : 800);
  let availH = $state(0);
  function measureAvail() {
    const scroll = document.querySelector('.wiz-scroll');
    const vp = document.querySelector('.inline-player-viewport');
    const player = document.querySelector('.inline-player');
    const note = document.querySelector('.play-note');
    if (!scroll || !vp || !player || !note) return;
    const gap = Math.max(0, note.getBoundingClientRect().top - player.getBoundingClientRect().bottom);
    const nonPlayer = scroll.scrollHeight - vp.offsetHeight - gap;
    availH = scroll.clientHeight - nonPlayer;
  }
  $effect(() => {
    playing; frameH; viewH; // re-measure whenever the layout could move
    measureAvail();         // effects run post-DOM-update
    // …and once more after late reflows (font loads) settle. setTimeout,
    // not rAF: rAF never fires in a background tab.
    const t = setTimeout(measureAvail, 300);
    return () => clearTimeout(t);
  });
  // Belt-and-braces for band size changes that arrive without a window
  // resize event (URL bar collapse, emulated viewports, split screen).
  $effect(() => {
    if (!playing || !window.ResizeObserver) return;
    const scroll = document.querySelector('.wiz-scroll');
    if (!scroll) return;
    const ro = new ResizeObserver(measureAvail);
    ro.observe(scroll);
    return () => ro.disconnect();
  });
  const scale = $derived.by(() => {
    if (!frameH || !availH) return 1;
    return Math.max(0.45, Math.min(1, availH / frameH));
  });
</script>

<svelte:window bind:innerHeight={viewH} onkeydown={(e) => e.key === 'Escape' && (rawModal = false)} />

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
  <div class="inline-player-viewport"
       style={frameH ? `height:${Math.round(frameH * scale)}px` : ''}>
    <iframe class="inline-player-frame" use:fitToContent
            style={frameH ? `height:${frameH}px; transform:scale(${scale});` : ''}
            src="/player/calcite.html#embed" title="CSS-DOS player"></iframe>
  </div>
</div>

{#if tipsOpen}
<div class="window play-toast" role="status" aria-label="Hints for this program">
  <div class="title-bar play-toast-title">
    <span>HINTS</span>
    <button class="play-toast-close" aria-label="Dismiss hints"
            onclick={() => tipsDismissedFor = build.cart?.name}>&times;</button>
  </div>
  <div class="window-body">
    {#each tips as line (line)}
      <p>{#each mdSegments(line) as seg, i (i)}{#if seg.href}<a href={seg.href} target="_blank" rel="noopener">{seg.text}</a>{:else}{seg.text}{/if}{/each}</p>
    {/each}
  </div>
</div>
{/if}
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
