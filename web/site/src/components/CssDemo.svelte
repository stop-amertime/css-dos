<script>
  // CssDemo — four small proofs that CSS really has the working parts
  // of a programming language, stacked so none of them hides behind a
  // tab. The Function and Branching results are computed by REAL CSS
  // (@function / if() in css-demo.css), not JS.
  import '../styles/_fragments/css-demo.css';

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
