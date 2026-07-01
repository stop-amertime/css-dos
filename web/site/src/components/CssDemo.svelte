<script>
  import '../styles/_fragments/css-demo.css';

  let current = $state('basics');
  let on = $state(false); // Branching demo live toggle
</script>

<div class="css-demo" id="css-demo">
  <div class="css-demo-tabs" role="tablist">
    <button class="css-demo-tab" class:current={current === 'basics'} onclick={() => (current = 'basics')}>Basics</button>
    <button class="css-demo-tab" class:current={current === 'variable'} onclick={() => (current = 'variable')}>Variable</button>
    <button class="css-demo-tab" class:current={current === 'function'} onclick={() => (current = 'function')}>Function</button>
    <button class="css-demo-tab" class:current={current === 'branching'} onclick={() => (current = 'branching')}>Branching</button>
  </div>

  {#if current === 'basics'}
    <!-- Basics -->
    <div class="css-demo-panel current" data-demo-panel="basics">
      <pre class="css-demo-code"><code><span class="tok-sel">.box</span> {'{'}
  background-color: blue;
  color: white;
  width: 120px;
{'}'}</code></pre>
      <div class="css-demo-result">
        <div class="demo-box" style="background:blue;color:#fff;width:120px">box</div>
        <span class="dim small">a few plain declarations</span>
      </div>
    </div>
  {:else if current === 'variable'}
    <!-- Variable -->
    <div class="css-demo-panel current" data-demo-panel="variable">
      <pre class="css-demo-code"><code><span class="tok-sel">:root</span> {'{'} <span class="tok-prop">--accent</span>: red; {'}'}

<span class="tok-sel">.box</span> {'{'}
  background-color: <span class="tok-fn">var</span>(<span class="tok-prop">--accent</span>);
{'}'}</code></pre>
      <div class="css-demo-result">
        <div class="demo-box" style="background:red;color:#fff;width:120px">box</div>
        <span class="dim small">store a value once, reuse it</span>
      </div>
    </div>
  {:else if current === 'function'}
    <!-- Function — a real custom @function with a typed parameter -->
    <div class="css-demo-panel current" data-demo-panel="function">
      <pre class="css-demo-code"><code><span class="tok-at">@function</span> <span class="tok-fn">--double</span>(<span class="tok-prop">--n</span>) {'{'}
  <span class="tok-prop">result</span>: <span class="tok-fn">calc</span>(<span class="tok-fn">var</span>(<span class="tok-prop">--n</span>) * 2);
{'}'}

<span class="tok-sel">.box</span> {'{'}
  width: <span class="tok-fn">--double</span>(60px);
{'}'}</code></pre>
      <div class="css-demo-result">
        <div class="demo-box demo-box-fn">box</div>
        <span class="dim small">define your own functions, with parameters</span>
      </div>
    </div>
  {:else if current === 'branching'}
    <!-- Branching — real if() switching on a custom property -->
    <div class="css-demo-panel current" data-demo-panel="branching">
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
        <span class="dim small">pick a value from an <code>if()</code> condition</span>
      </div>
    </div>
  {/if}
</div>
