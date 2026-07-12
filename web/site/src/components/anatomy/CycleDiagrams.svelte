<script>
  // CycleDiagrams — the three diagrams of the "why four variables"
  // argument, rendered one at a time via the `panel` prop so prose can
  // interleave (SectionClock.svelte):
  //   panel="self" — a variable referencing itself, banned
  //   panel="pair" — two variables feeding each other: a cycle of any
  //                  length is still detected and ignored
  //   panel="ring" — the machine's answer: a ring of four (--X and its
  //                  numbered copies) where the two keyframe links only
  //                  conduct during their own quarter of the clock lap,
  //                  so the ring is never fully connected
  // The ring animates on the same 3.2s lap as TickClock and, like it,
  // runs on the very mechanism it explains (pure CSS keyframes).
  let { panel } = $props();

  const KEYFRAMES = [
    { n: '0%',  name: 'rest',    what: 'nothing runs — a spacer' },
    { n: '25%', name: 'store',   what: '--X_2 ← --X_1 — every formula reacts and recomputes' },
    { n: '50%', name: 'rest',    what: 'nothing runs — the recomputation finishes' },
    { n: '75%', name: 'execute', what: '--X_1 ← --X' },
  ];
</script>

{#if panel === 'self'}
  <figure class="cd-fig cd-duo">
    <pre class="cd-code"><code><span class="tok-prop">--X</span>: <span class="tok-fn">calc</span>(<span class="tok-fn">var</span>(<span class="tok-prop">--X</span>) + <span class="tok-num">1</span>);</code></pre>
    <svg class="cd-self" viewBox="0 0 200 130" role="img"
         aria-label="One box labelled dash dash X with an arrow looping back to itself, struck through by a red prohibition sign.">
      <path class="cd-loop" d="M 128 68 C 168 22, 32 22, 70 62" />
      <polygon class="cd-loophead" points="72,66 65,56 77,55" />
      <circle class="cd-ban" cx="100" cy="34" r="15" />
      <line class="cd-ban" x1="89.4" y1="44.6" x2="110.6" y2="23.4" />
      <rect class="cd-box" x="60" y="68" width="80" height="34" />
      <text class="cd-name" x="100" y="90">--X</text>
    </svg>
  </figure>
{:else if panel === 'pair'}
  <figure class="cd-fig cd-duo">
    <pre class="cd-code"><code><span class="tok-prop">--X</span>: <span class="tok-fn">calc</span>(<span class="tok-fn">var</span>(<span class="tok-prop">--X-prev</span>) + <span class="tok-num">1</span>);

<span class="tok-comment">/* …and, elsewhere… */</span>
<span class="tok-prop">--X-prev</span>: <span class="tok-fn">var</span>(<span class="tok-prop">--X</span>);</code></pre>
    <svg class="cd-pair" viewBox="0 0 240 130" role="img"
         aria-label="Two boxes, dash dash X and dash dash X-prev, with arrows feeding each into the other, struck through by a red prohibition sign.">
      <path class="cd-loop" d="M 152 50 C 136 26, 104 26, 91 46" />
      <polygon class="cd-loophead" points="88,50 92,38 100,44" />
      <path class="cd-loop" d="M 88 80 C 104 104, 136 104, 149 84" />
      <polygon class="cd-loophead" points="152,80 148,92 140,86" />
      <circle class="cd-ban" cx="120" cy="65" r="14" />
      <line class="cd-ban" x1="110.1" y1="74.9" x2="129.9" y2="55.1" />
      <rect class="cd-box" x="12" y="48" width="76" height="34" />
      <text class="cd-name" x="50" y="70">--X</text>
      <rect class="cd-box" x="152" y="48" width="76" height="34" />
      <text class="cd-name" x="190" y="70">--X-prev</text>
    </svg>
  </figure>
{:else if panel === 'ring'}
  <figure class="cd-fig cd-ringfig">
    <div class="cd-beats" aria-label="The four keyframes of one clock lap, highlighted in turn">
      {#each KEYFRAMES as b}
        <div class="cd-beat">
          <span class="beat-n">{b.n}</span>
          <span class="beat-name">{b.name}</span>
          <span class="beat-what">{b.what}</span>
        </div>
      {/each}
    </div>
    <svg class="cd-ring" viewBox="0 0 360 230" role="img"
         aria-label="Four boxes in a ring: dash dash X and its three numbered copies, clockwise. The X-to-X_1 and X_1-to-X_2 links light up only during their own keyframe; the links from X_2 to X_3 and X_3 back to X are always on — so the ring is never fully connected.">
      <!-- execute latch: X → X_1, conducts during the 75% keyframe only -->
      <line class="cd-latch cd-exec" x1="130" y1="44" x2="226" y2="44" />
      <polygon class="cd-lhead cd-exec-head" points="234,44 224,39 224,49" />
      <text class="cd-lab" x="180" y="34" text-anchor="middle">execute &middot; at 75%</text>

      <!-- store latch: X_1 → X_2, conducts during the 25% keyframe only -->
      <line class="cd-latch cd-store" x1="284" y1="66" x2="284" y2="146" />
      <polygon class="cd-lhead cd-store-head" points="284,154 279,144 289,144" />
      <text class="cd-lab" x="294" y="104" text-anchor="start">store</text>
      <text class="cd-lab" x="294" y="118" text-anchor="start">at 25%</text>

      <!-- rule links: always live -->
      <line class="cd-link" x1="230" y1="172" x2="134" y2="172" />
      <polygon class="cd-head" points="126,172 136,167 136,177" />
      <text class="cd-lab" x="180" y="164" text-anchor="middle">always</text>

      <line class="cd-link" x1="76" y1="150" x2="76" y2="72" />
      <polygon class="cd-head" points="76,64 71,74 81,74" />
      <text class="cd-lab" x="66" y="112" text-anchor="end">always</text>

      <!-- the four variables, clockwise in flow order -->
      <rect class="cd-box" x="28" y="28" width="96" height="32" />
      <text class="cd-name" x="76" y="49">--X</text>
      <rect class="cd-box" x="236" y="28" width="96" height="32" />
      <text class="cd-name" x="284" y="49">--X_1</text>
      <rect class="cd-box" x="236" y="156" width="96" height="32" />
      <text class="cd-name" x="284" y="177">--X_2</text>
      <rect class="cd-box" x="28" y="156" width="96" height="32" />
      <text class="cd-name" x="76" y="177">--X_3</text>
    </svg>
    <figcaption>
      Black links are formulas, always in force. The grey links only
      conduct during their own keyframe &mdash; and the two keyframes
      never overlap, so the circle is never complete: CSS never sees a
      cycle. Yet across one lap, a value travels all the way round.
    </figcaption>
  </figure>
{/if}

<style>
  .cd-fig {
    border: 1px solid var(--edit-black);
    background: var(--edit-white);
    box-shadow: 4px 4px 0 var(--edit-black);
    margin: 16px 0;
    padding: 10px 12px;
  }

  /* Panels 1–2: the offending code on the left, its diagram on the
     right; stacks on phones. Matched displayed box size (the two
     viewBoxes differ, so max-widths differ by the same ratio). */
  .cd-duo {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px 28px;
    flex-wrap: wrap;
  }
  .cd-code {
    margin: 0;
    font-family: 'WebVGA', monospace; letter-spacing: normal;
    font-size: 15px;
    line-height: 20px;
    color: var(--edit-black);
    white-space: pre;
    overflow-x: auto;
    max-width: 100%;
  }
  .cd-code code { background: none; border: none; padding: 0; }
  .cd-code .tok-prop    { color: var(--edit-red); }
  .cd-code .tok-num     { color: var(--edit-blue); }
  .cd-code .tok-fn      { color: #006600; }
  .cd-code .tok-comment { color: #777; }
  .cd-self { width: 100%; max-width: 230px; height: auto; display: block; flex: 0 1 200px; }
  .cd-pair { width: 100%; max-width: 276px; height: auto; display: block; flex: 0 1 240px; }

  .cd-ring {
    width: 100%;
    max-width: 440px;
    height: auto;
    display: block;
    margin: 10px auto 0;
  }

  figcaption {
    margin-top: 6px;
    font-size: 14px;
    line-height: 18px;
    color: #555;
  }

  /* — shared diagram pieces — */
  .cd-box  { fill: var(--edit-white); stroke: var(--edit-black); stroke-width: 1.5; }
  .cd-name {
    fill: var(--edit-black);
    font-family: 'WebVGA', monospace;
    font-size: 14px;
    text-anchor: middle;
  }
  .cd-lab  { fill: #555; font-size: 12px; }
  .cd-loop { fill: none; stroke: var(--edit-black); stroke-width: 2; }
  .cd-loophead { fill: var(--edit-black); }
  .cd-ban  { stroke: var(--edit-red); stroke-width: 3.5; fill: none; }

  /* — ring links — */
  .cd-link { stroke: var(--edit-black); stroke-width: 2; }
  .cd-head { fill: var(--edit-black); }
  .cd-latch { stroke-width: 2.5; }

  /* The two latches: frozen (grey, dashed) except during their own
     quarter of the 3.2s lap — store at 25%, execute at 75%.
     0.1%-apart keyframes make the switch effectively instant. */
  .cd-store      { animation: cd-store-on 3.2s infinite; }
  .cd-store-head { animation: cd-store-head-on 3.2s infinite; }
  @keyframes cd-store-on {
    0%, 24.9%  { stroke: #999; stroke-dasharray: 5 4; }
    25%, 49.9% { stroke: var(--edit-red); stroke-dasharray: 1 0; }
    50%, 100%  { stroke: #999; stroke-dasharray: 5 4; }
  }
  @keyframes cd-store-head-on {
    0%, 24.9%  { fill: #999; }
    25%, 49.9% { fill: var(--edit-red); }
    50%, 100%  { fill: #999; }
  }

  .cd-exec      { animation: cd-exec-on 3.2s infinite; }
  .cd-exec-head { animation: cd-exec-head-on 3.2s infinite; }
  @keyframes cd-exec-on {
    0%, 74.9% { stroke: #999; stroke-dasharray: 5 4; }
    75%, 100% { stroke: var(--edit-red); stroke-dasharray: 1 0; }
  }
  @keyframes cd-exec-head-on {
    0%, 74.9% { fill: #999; }
    75%, 100% { fill: var(--edit-red); }
  }

  /* — beat strip: same walking highlight as TickClock — */
  .cd-beats {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  .cd-beat {
    display: grid;
    grid-template-columns: 34px 66px 1fr;
    gap: 8px;
    align-items: baseline;
    border: 1px solid var(--edit-black);
    padding: 4px 8px;
    font-size: 14px;
    line-height: 17px;
    animation: cd-beat-on 3.2s infinite;
  }
  .cd-beat .beat-n { color: var(--edit-red); }
  .cd-beat .beat-name { font-weight: bold; }
  .cd-beat .beat-what { color: #555; }
  .cd-beat:nth-child(2) { animation-delay: 0.8s; }
  .cd-beat:nth-child(3) { animation-delay: 1.6s; }
  .cd-beat:nth-child(4) { animation-delay: 2.4s; }
  @keyframes cd-beat-on {
    0%, 24.9% { background: var(--edit-yellow); }
    25%, 100% { background: var(--edit-white); }
  }
</style>
