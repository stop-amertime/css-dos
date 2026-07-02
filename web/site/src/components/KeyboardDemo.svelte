<script>
  // KeyboardDemo — the cabinet's real input mechanism, live, zero JS.
  // SplitPane: left, the actual :has(:active) rules; right, pressable
  // keys and a --keyboard readout. Holding a key matches :active, the
  // rule in kbd-demo.css sets --demo-kbd, and the readout renders it
  // via counter-reset (the cabinet's own debug-display trick). Values
  // are the real ones from kiln/template.mjs (scancode·256 + ascii).
  import '../styles/_fragments/kbd-demo.css';
  import SplitPane from './SplitPane.svelte';

  const KEYS = [
    { id: 'demo-kb-a', label: 'A' },
    { id: 'demo-kb-s', label: 'S' },
    { id: 'demo-kb-d', label: 'D' },
  ];
</script>

<div class="kbd-demo">
  <SplitPane>
    {#snippet left()}
      <pre class="kbd-code"><code><span class="tok-sel">.cpu:has(#kb-a:active)</span> {'{'}
  <span class="tok-prop">--keyboard</span>: <span class="tok-num">7777</span>;
{'}'}
<span class="tok-sel">.cpu:has(#kb-s:active)</span> {'{'}
  <span class="tok-prop">--keyboard</span>: <span class="tok-num">8051</span>;
{'}'}
<span class="tok-sel">.cpu:has(#kb-d:active)</span> {'{'}
  <span class="tok-prop">--keyboard</span>: <span class="tok-num">8292</span>;
{'}'}
<span class="tok-comment">/* … one rule per key … */</span></code></pre>
    {/snippet}
    {#snippet right()}
      <div class="kbd-try">
        <div class="kbd-keys">
          {#each KEYS as k}
            <button class="kb-key" id={k.id} type="button">{k.label}</button>
          {/each}
        </div>
        <div class="kbd-readout">
          --keyboard: <span class="kbd-value"></span>
        </div>
        <span class="dim small">hold a key &mdash; even this readout is pure CSS</span>
      </div>
    {/snippet}
  </SplitPane>

  <p class="caption">
    Each number packs the key&rsquo;s hardware scancode with its text
    character (A: 30&nbsp;&times;&nbsp;256&nbsp;+&nbsp;97 = 7777).
    Release, and it snaps back to <b>0</b> &mdash; that&rsquo;s how games
    see you let go.
  </p>
</div>
