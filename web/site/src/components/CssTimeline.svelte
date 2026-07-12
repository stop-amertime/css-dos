<script>
  // CssTimeline — thirty years of computational tools arriving in CSS,
  // as a clickable dotted timeline. Left: the moments. Right: the CSS
  // each one unlocked, with a live proof box under it. The calc()/
  // mod()/if()/@function boxes are computed by REAL CSS (in the style
  // block below), not JS.
  import { fade } from 'svelte/transition';
  let sel = $state(0);
  let on = $state(false); // if() demo live toggle

  const MOMENTS = [
    { year: '1996', label: 'Set a property' },
    { year: '2011', label: 'Simple calculations with calc()' },
    { year: '2014', label: 'Variables, as var(--x) only' },
    { year: '2022', label: 'Remainders and rounding' },
    { year: '2025', label: 'Ask yes/no questions with if()' },
    { year: '2025', label: 'Re-use a block of code with @function' },
  ];
</script>

<div class="css-tl" id="css-timeline">
  <div class="tl-rail" role="tablist" aria-label="CSS features by year">
    {#each MOMENTS as m, i}
      <button class="tl-item" class:current={sel === i} type="button"
              role="tab" aria-selected={sel === i}
              onclick={() => (sel = i)}>
        <span class="tl-year">{m.year}</span>
        <span class="tl-label">{m.label}</span>
      </button>
    {/each}
  </div>

  <div class="tl-pane" role="tabpanel">
    {#key sel}
      <div class="tl-body" in:fade={{ duration: 120 }}>
        {#if sel === 0}
          <pre class="tl-code"><code><span class="tok-sel">.box</span> {'{'}
  background-color: blue;
  color: white;
{'}'}</code></pre>
          <div class="tl-result">
            <div class="demo-box" style="background:blue;color:#fff;width:120px">box</div>
          </div>
        {:else if sel === 1}
          <pre class="tl-code"><code><span class="tok-sel">.box</span> {'{'}
  width: <span class="tok-fn">calc</span>(60px + 40px);
{'}'}</code></pre>
          <div class="tl-result">
            <div class="demo-box demo-box-calc">box</div>
          </div>
        {:else if sel === 2}
          <pre class="tl-code"><code><span class="tok-sel">:root</span> {'{'} <span class="tok-prop">--accent</span>: red; {'}'}

<span class="tok-sel">.box</span> {'{'}
  background-color: <span class="tok-fn">var</span>(<span class="tok-prop">--accent</span>);
{'}'}</code></pre>
          <div class="tl-result">
            <div class="demo-box" style="background:red;color:#fff;width:120px">box</div>
          </div>
        {:else if sel === 3}
          <pre class="tl-code"><code><span class="tok-sel">.box</span> {'{'}
  width: <span class="tok-fn">calc</span>(
    <span class="tok-fn">mod</span>(500, 360) * 1px
  );
{'}'}</code></pre>
          <div class="tl-result">
            <div class="demo-box demo-box-mod">140px</div>
          </div>
        {:else if sel === 4}
          <pre class="tl-code"><code><span class="tok-sel">.box</span> {'{'}
  background-color: <span class="tok-fn">if</span>(
    <span class="tok-fn">style</span>(<span class="tok-prop">--on</span>: 1): green;
    <span class="tok-fn">else</span>: red
  );
{'}'}</code></pre>
          <div class="tl-result">
            <div class="demo-box demo-box-branch" class:on>box</div>
            <button class="demo-toggle" type="button" onclick={() => (on = !on)}>
              toggle --on
            </button>
            <span class="dim small">no JavaScript &mdash; the <code>if()</code> picks the colour</span>
          </div>
        {:else}
          <pre class="tl-code"><code><span class="tok-at">@function</span> <span class="tok-fn">--double</span>(<span class="tok-prop">--n</span>) {'{'}
  <span class="tok-prop">result</span>: <span class="tok-fn">calc</span>(<span class="tok-fn">var</span>(<span class="tok-prop">--n</span>) * 2);
{'}'}

<span class="tok-sel">.box</span> {'{'}
  width: <span class="tok-fn">--double</span>(60px);
{'}'}</code></pre>
          <div class="tl-result">
            <div class="demo-box demo-box-fn">box</div>
          </div>
        {/if}
      </div>
    {/key}
  </div>
</div>

<style>
  /* The boxed look is for inline <code> in prose only; in the code pane
     <code> sits inside a styled <pre> and must be plain. */
  .tl-code code,
  .tl-result code {
    background: none;
    border: none;
    padding: 0;
  }

  .css-tl {
    display: flex;
    flex-wrap: wrap;
    border: 1px solid var(--edit-black);
    background: var(--edit-white);
    box-shadow: 4px 4px 0 var(--edit-black);
    margin: 12px 0 28px;
  }

  /* — the dotted rail: white pane, no separator line — */
  .tl-rail {
    flex: 1 1 0;
    min-width: 0;
    position: relative;
    padding: 10px 8px 10px 0;
    background: var(--edit-white);
  }
  /* the vertical dotted line, running dot-centre to dot-centre */
  .tl-rail::before {
    content: '';
    position: absolute;
    left: 20px;
    top: 26px;
    bottom: 30px;
    border-left: 2px dotted var(--edit-black);
  }
  .tl-item {
    display: block;
    width: 100%;
    position: relative;
    padding: 7px 6px 7px 38px;
    background: none;
    border: none;
    text-align: left;
    font-family: 'WebVGA', monospace;
    letter-spacing: normal;
    cursor: pointer;
    color: var(--edit-black);
  }
  /* selection = the DOS menu highlight — but it starts right of the
     dot column, so the timeline line and its circles stay visible */
  .tl-item.current {
    background: linear-gradient(90deg, transparent 30px, var(--edit-cyan) 30px);
  }
  /* the circle node */
  .tl-item::before {
    content: '';
    position: absolute;
    left: 14px;
    top: 13px;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--edit-white);
    border: 2px solid var(--edit-black);
  }
  .tl-item:hover::before { background: var(--edit-cyan); }
  .tl-item.current::before { background: var(--edit-black); }
  .tl-year {
    display: block;
    font-size: 14px;
    line-height: 16px;
    font-weight: bold;
  }
  .tl-label {
    display: block;
    font-size: 14px;
    line-height: 16px;
    color: #444;
  }
  .tl-item.current .tl-label { color: var(--edit-black); }

  /* — the code + proof pane — */
  .tl-pane {
    flex: 1 1 0;
    min-width: 0;
    display: flex;
    flex-direction: column;
    background: #ececec; /* a shade off the rail's white — the split, without a separator line */
  }
  .tl-body {
    flex: 1;
    display: flex;
    flex-direction: column;
  }
  .tl-code {
    margin: 0;
    padding: 12px 16px;
    font-family: 'WebVGA', monospace;
    letter-spacing: normal;
    font-size: 16px;
    line-height: 20px;
    color: var(--edit-black);
    white-space: pre;
    overflow-x: auto;
  }
  .tl-code .tok-sel  { color: var(--edit-blue); }
  .tl-code .tok-prop { color: var(--edit-red); }
  .tl-code .tok-fn   { color: #006600; }
  .tl-code .tok-at   { color: var(--edit-blue); }
  .tl-result {
    flex: 1;
    padding: 12px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    text-align: center;
  }
  .tl-result .demo-box {
    min-height: 56px;
    background: var(--edit-white);
    color: var(--edit-black);
    border: 1px solid var(--edit-black);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
  }

  /* The proof boxes below really are computed by the CSS shown — the
     same calc()/mod()/if()/@function constructs CSS-DOS is built from.
     Each carries a plain fallback for browsers without the feature. */
  .tl-result .demo-box-calc {
    width: 100px;                          /* fallback */
    width: calc(60px + 40px);
  }
  .tl-result .demo-box-mod {
    width: 140px;                          /* fallback */
    width: calc(mod(500, 360) * 1px);      /* real: 140px */
  }
  @function --double(--n) {
    result: calc(var(--n) * 2);
  }
  .tl-result .demo-box-fn {
    width: 60px;                           /* fallback */
    width: --double(60px);                 /* real: 120px */
  }
  .tl-result .demo-box-branch {
    --on: 0;
    width: 120px;
    background: red;                       /* fallback */
    background: if(style(--on: 1): green; else: red);
    color: var(--edit-white);
  }
  .tl-result .demo-box-branch.on { --on: 1; }
  .tl-result .demo-toggle {
    font-family: 'WebVGA', monospace;
    letter-spacing: normal;
    font-size: 14px;
    padding: 4px 10px;
    background: var(--edit-cyan);
    color: var(--edit-black);
    border: 1px solid var(--edit-black);
    box-shadow: 2px 2px 0 var(--edit-black);
    cursor: pointer;
  }
  .tl-result .demo-toggle:active {
    transform: translate(2px, 2px);
    box-shadow: none;
  }
</style>
