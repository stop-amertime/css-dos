<script>
  // SignDemo — the "no comparisons" trick, live. The 0/1 answer is
  // computed by real CSS (sign-demo.css evaluates
  // max(0, sign(B − A − 0.5)) into --sd-out and renders it with the
  // counter trick). JS only bumps the two inputs.
  import '../styles/_fragments/sign-demo.css';

  let a = $state(5);
  let b = $state(7);
  const clamp = (n) => Math.max(0, Math.min(99, n));
</script>

<div class="sign-demo" style="--sd-a: {a}; --sd-b: {b}">
  <div class="sd-row">
    <span>A =</span>
    <button class="demo-toggle" onclick={() => (a = clamp(a - 1))}>&minus;</button>
    <span class="sd-num">{a}</span>
    <button class="demo-toggle" onclick={() => (a = clamp(a + 1))}>+</button>
    <span class="sd-gap"></span>
    <span>B =</span>
    <button class="demo-toggle" onclick={() => (b = clamp(b - 1))}>&minus;</button>
    <span class="sd-num">{b}</span>
    <button class="demo-toggle" onclick={() => (b = clamp(b + 1))}>+</button>
  </div>
  <div class="sd-result">
    <code>max(0, sign(B - A - 0.5))</code>
    <span>=</span>
    <span class="sd-out"></span>
  </div>
  <span class="small dim">1 means A &lt; B &mdash; computed by real CSS <code>sign()</code>, not JS</span>
</div>
