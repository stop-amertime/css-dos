<script>
  // KeyboardDemo — the cabinet's real input mechanism, live. No JS at
  // all: holding a key matches :active, a :has() rule sets --demo-kbd
  // (kbd-demo.css), and the readout renders it with the same
  // counter-reset trick the cabinet's debug display uses. The scancode
  // values are the real ones from kiln/template.mjs (scancode·256+ascii).
  import '../styles/_fragments/kbd-demo.css';

  const KEYS = [
    { id: 'demo-kb-a',   label: 'A',   value: 7777 },
    { id: 'demo-kb-s',   label: 'S',   value: 8051 },
    { id: 'demo-kb-d',   label: 'D',   value: 8292 },
    { id: 'demo-kb-esc', label: 'Esc', value: 283 },
  ];
</script>

<div class="kbd-demo">
  <pre class="kbd-code"><code><span class="tok-sel">.cpu:has(#kb-a:active)</span>   {'{'} <span class="tok-prop">--keyboard</span>: <span class="tok-num">7777</span>; {'}'}
<span class="tok-sel">.cpu:has(#kb-s:active)</span>   {'{'} <span class="tok-prop">--keyboard</span>: <span class="tok-num">8051</span>; {'}'}
<span class="tok-sel">.cpu:has(#kb-d:active)</span>   {'{'} <span class="tok-prop">--keyboard</span>: <span class="tok-num">8292</span>; {'}'}
<span class="tok-sel">.cpu:has(#kb-esc:active)</span> {'{'} <span class="tok-prop">--keyboard</span>: <span class="tok-num">283</span>;  {'}'}</code></pre>

  <div class="kbd-try">
    <div class="kbd-keys">
      {#each KEYS as k}
        <button class="kb-key" id={k.id} type="button">{k.label}</button>
      {/each}
    </div>
    <div class="kbd-readout">
      --keyboard: <span class="kbd-value"></span>
    </div>
    <span class="dim small">hold a key down (this readout is itself pure CSS)</span>
  </div>

  <p class="caption">
    These are the cabinet&rsquo;s actual rules. Hold a key and
    <code>--keyboard</code> takes that key&rsquo;s number &mdash; the
    hardware scancode and the character code packed together
    (for A: 30&nbsp;&times;&nbsp;256&nbsp;+&nbsp;97&nbsp;=&nbsp;7777).
    Let go and it snaps back to <b>0</b>: the machine sees the release
    too, which is how games know when you stop moving.
  </p>
</div>
