<script>
  // KeyboardDemo — the cabinet's real input mechanism, live, zero JS.
  // SplitPane: left, the actual :has(:active) rules; right, pressable
  // keys and a --keyboard readout. Holding a key matches :active, the
  // rule in kbd-demo.css sets --demo-kbd, and the readout renders it
  // via counter-reset (a CSS trick for turning a number into text —
  // this demo's own, not part of the shipped cabinet). Values are the
  // real ones from kiln/template.mjs (scancode·256 + ascii).
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
      <pre class="kbd-code"><code><span class="tok-sel">.motherboard:has(#kb-a:active)</span> {'{'}
  <span class="tok-prop">--keyboard</span>: <span class="tok-num">7777</span>;
{'}'}
<span class="tok-sel">.motherboard:has(#kb-s:active)</span> {'{'}
  <span class="tok-prop">--keyboard</span>: <span class="tok-num">8051</span>;
{'}'}
<span class="tok-sel">.motherboard:has(#kb-d:active)</span> {'{'}
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

<style>
  /* Typed so the counter-reset render below gets a clean integer. */
  @property --demo-kbd {
    syntax: '<integer>';
    inherits: true;
    initial-value: 0;
  }

  .kbd-demo {
    border: 1px solid var(--edit-black);
    background: var(--edit-white);
    box-shadow: 4px 4px 0 var(--edit-black);
    margin: 16px 0;
    --demo-kbd: 0;
  }

  /* The real cabinet mechanism, verbatim shape (ids namespaced demo-). */
  .kbd-demo:has(#demo-kb-a:active) { --demo-kbd: 7777; }
  .kbd-demo:has(#demo-kb-s:active) { --demo-kbd: 8051; }
  .kbd-demo:has(#demo-kb-d:active) { --demo-kbd: 8292; }

  .kbd-code {
    margin: 0;
    padding: 12px 16px;
    font-family: 'WebVGA', monospace; letter-spacing: normal;
    font-size: 15px;
    line-height: 20px;
    color: var(--edit-black);
    background: var(--edit-white);
    white-space: pre;
    overflow-x: auto;
    height: 100%;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }
  .kbd-code code { background: none; border: none; padding: 0; }
  .kbd-code .tok-sel     { color: var(--edit-blue); }
  .kbd-code .tok-prop    { color: var(--edit-red); }
  .kbd-code .tok-num     { color: #006600; }
  .kbd-code .tok-comment { color: #777; }

  .kbd-try {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 16px 12px;
  }
  .kbd-keys { display: flex; gap: 8px; }
  .kb-key {
    font-family: 'WebVGA', monospace; letter-spacing: normal;
    font-size: 18px;
    min-width: 44px;
    padding: 10px 12px;
    background: var(--edit-gray);
    color: var(--edit-black);
    border: 1px solid var(--edit-black);
    box-shadow: 0 3px 0 var(--edit-black);
    cursor: pointer;
    user-select: none;
    touch-action: none;
  }
  .kb-key:active {
    transform: translateY(3px);
    box-shadow: none;
    background: var(--edit-yellow);
  }

  .kbd-readout {
    font-size: 18px;
    color: var(--edit-black);
  }
  /* Render the live integer as text — counter-reset from a custom
     property, CSS's only way to turn a number into displayable text. */
  .kbd-value::after {
    counter-reset: kbdval var(--demo-kbd);
    content: counter(kbdval);
    color: var(--edit-red);
    font-weight: bold;
  }

  .kbd-demo .caption {
    margin: 0;
    padding: 10px 16px 12px;
    font-size: 16px;
    line-height: 18px;
    color: var(--edit-black);
    border-top: 1px solid var(--edit-black);
  }
</style>
