<script>
  // CssDemo — four small proofs that CSS really has the working parts
  // of a programming language, stacked so none of them hides behind a
  // tab. The Function and Branching results are computed by REAL CSS
  // (@function / if() in css-demo.css), not JS.
  let on = $state(false); // Branching demo live toggle
</script>

<div class="css-demo" id="css-demo">
  <!-- Basics -->
  <div class="css-demo-head">plain styling</div>
  <div class="css-demo-panel" data-demo-panel="basics">
    <pre class="css-demo-code"><code><span class="tok-sel">.box</span> {'{'}
  background-color: blue;
  color: white;
  width: 120px;
{'}'}</code></pre>
    <div class="css-demo-result">
      <div class="demo-box" style="background:blue;color:#fff;width:120px">box</div>
      <span class="dim small">what CSS is for</span>
    </div>
  </div>

  <!-- Variable -->
  <div class="css-demo-head">variables</div>
  <div class="css-demo-panel" data-demo-panel="variable">
    <pre class="css-demo-code"><code><span class="tok-sel">:root</span> {'{'} <span class="tok-prop">--accent</span>: red; {'}'}

<span class="tok-sel">.box</span> {'{'}
  background-color: <span class="tok-fn">var</span>(<span class="tok-prop">--accent</span>);
{'}'}</code></pre>
    <div class="css-demo-result">
      <div class="demo-box" style="background:red;color:#fff;width:120px">box</div>
      <span class="dim small">store a value once, reuse it</span>
    </div>
  </div>

  <!-- Function -->
  <div class="css-demo-head">functions</div>
  <div class="css-demo-panel" data-demo-panel="function">
    <pre class="css-demo-code"><code><span class="tok-at">@function</span> <span class="tok-fn">--double</span>(<span class="tok-prop">--n</span>) {'{'}
  <span class="tok-prop">result</span>: <span class="tok-fn">calc</span>(<span class="tok-fn">var</span>(<span class="tok-prop">--n</span>) * 2);
{'}'}

<span class="tok-sel">.box</span> {'{'}
  width: <span class="tok-fn">--double</span>(60px);
{'}'}</code></pre>
    <div class="css-demo-result">
      <div class="demo-box demo-box-fn">box</div>
      <span class="dim small">this box is really sized by that function</span>
    </div>
  </div>

  <!-- Branching -->
  <div class="css-demo-head">branching</div>
  <div class="css-demo-panel" data-demo-panel="branching">
    <pre class="css-demo-code"><code><span class="tok-sel">.box</span> {'{'}
  background-color: <span class="tok-fn">if</span>(
    <span class="tok-fn">style</span>(<span class="tok-prop">--on</span>: 1): green;
    <span class="tok-fn">else</span>: red
  );
{'}'}</code></pre>
    <div class="css-demo-result">
      <div class="demo-box demo-box-branch" class:on id="branch-box">box</div>
      <button class="demo-toggle" id="branch-toggle" type="button" onclick={() => (on = !on)}>
        toggle --on
      </button>
      <span class="dim small">no JavaScript &mdash; the <code>if()</code> picks the colour</span>
    </div>
  </div>
</div>

<style>
  /* The boxed look is for inline <code> in prose only. Inside the Learn
     code widgets, <code> sits in a styled <pre> and must be plain.
     (.byte-example code half of this combined rule lives in about.css.) */
  .css-demo-code code {
    background: none;
    border: none;
    padding: 0;
  }

  /* — CSS code-flicker demo — */
  .css-demo {
    border: 1px solid var(--edit-black);
    background: var(--edit-white);
    box-shadow: 4px 4px 0 var(--edit-black);
    margin: 12px 0;
  }
  /* The four proofs are stacked (no tabs — nothing hides). Each gets a
     thin labelled divider strip, then a panel: code left, live result
     right. */
  .css-demo-head {
    font-family: 'WebVGA', monospace; letter-spacing: normal;
    font-size: 13px;
    line-height: 13px;
    padding: 5px 10px;
    background: var(--edit-black);
    color: var(--edit-yellow);
    border-bottom: 1px solid var(--edit-black);
  }
  .css-demo-head:not(:first-child) { border-top: 1px solid var(--edit-black); }
  .css-demo-panel {
    display: grid;
    grid-template-columns: 1fr 220px;
    align-items: stretch;
  }
  .css-demo-code {
    margin: 0;
    padding: 12px 16px;
    font-family: 'WebVGA', monospace; letter-spacing: normal;
    font-size: 16px;
    line-height: 20px;
    color: var(--edit-black);
    background: var(--edit-white);
    white-space: pre;
    overflow-x: auto;
  }
  /* .tok-* colours come from global.css. */
  .css-demo-result {
    border-left: 1px solid var(--edit-black);
    padding: 12px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    text-align: center;
  }
  .css-demo-result .demo-box {
    min-height: 72px;
    background: var(--edit-gray);
    color: var(--edit-black);
    border: 1px solid var(--edit-black);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
  }

  /* The Function panel's box is sized by a REAL custom @function — the same
     kind of @function CSS-DOS itself uses (kiln/css-lib.mjs). If the browser
     doesn't support @function it falls back to the plain width below. */
  @function --double(--n) {
    result: calc(var(--n) * 2);
  }
  .css-demo-result .demo-box-fn {
    width: 60px;                 /* fallback */
    width: --double(60px);       /* real: 120px */
    background: var(--edit-blue);
    color: var(--edit-white);
  }

  /* The Branching panel's box picks its colour with a REAL if(style())
     conditional — the same construct CSS-DOS uses for its shift/branch
     tables. #branch-toggle flips --on; falls back to red if if() is
     unsupported. */
  .css-demo-result .demo-box-branch {
    --on: 0;
    background: red;             /* fallback */
    background: if(style(--on: 1): green; else: red);
    color: var(--edit-white);
  }
  .css-demo-result .demo-box-branch.on { --on: 1; }
  /* .demo-toggle chrome comes from global.css; only sizing here. */
  .css-demo-result .demo-toggle {
    font-size: 14px;
    padding: 4px 10px;
    background: var(--edit-white);
  }
</style>
