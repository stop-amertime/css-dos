<script>
  // SignDemo — the "no comparisons" trick, live. The 0/1 answer is
  // computed by real CSS (sign-demo.css evaluates
  // max(0, sign(B − A − 0.5)) into --sd-out and renders it with the
  // counter trick). JS only bumps the two inputs.
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

<style>
  @property --sd-a   { syntax: '<integer>'; inherits: true; initial-value: 5; }
  @property --sd-b   { syntax: '<integer>'; inherits: true; initial-value: 7; }
  @property --sd-out { syntax: '<integer>'; inherits: true; initial-value: 0; }

  .sign-demo {
    --sd-out: calc(max(0, sign(var(--sd-b) - var(--sd-a) - 0.5)));
    border: 1px solid var(--edit-black);
    background: var(--edit-white);
    box-shadow: 4px 4px 0 var(--edit-black);
    margin: 16px 0;
    padding: 12px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
  }

  .sd-row {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    align-items: center;
    gap: 8px;
    font-size: 16px;
  }
  .sd-num {
    display: inline-block;
    min-width: 34px;
    text-align: center;
    border: 1px solid var(--edit-black);
    background: var(--edit-gray);
    padding: 3px 4px;
  }
  .sd-gap { width: 14px; }

  /* .demo-toggle chrome comes from global.css; only sizing here. */
  .sign-demo .demo-toggle {
    font-size: 15px;
    padding: 3px 9px;
    background: var(--edit-white);
  }

  .sd-result {
    font-size: 16px;
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    justify-content: center;
  }
  .sd-out {
    display: inline-block;
    min-width: 26px;
    text-align: center;
    padding: 3px 6px;
    border: 1px solid var(--edit-black);
    background: var(--edit-yellow);
    font-weight: bold;
  }
  .sd-out::after {
    counter-reset: sdout var(--sd-out);
    content: counter(sdout);
  }

  .sign-demo .small.dim { text-align: center; }
</style>
