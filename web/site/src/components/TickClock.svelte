<script>
  // TickClock — the machine's clock. Left: the cabinet's actual clock
  // CSS. Right: the four beats of one tick, highlighted in turn by a
  // pure-CSS animation (tick-clock.css) — the widget runs on the same
  // mechanism it explains, 8× slower.
  import SplitPane from './SplitPane.svelte';

  const BEATS = [
    { name: 'rest',     what: 'nothing moves' },
    { name: 'copy in',  what: 'the buffer becomes the snapshot every formula reads' },
    { name: 'compute',  what: 'every formula re-derives from the fresh snapshot' },
    { name: 'copy out', what: 'the results are parked in the buffer for next tick' },
  ];
</script>

<div class="tick-clock">
  <SplitPane>
    {#snippet left()}
      <pre class="tick-code"><code><span class="tok-at">@keyframes</span> tick {'{'}
  <span class="tok-num">0%</span>   {'{'} <span class="tok-prop">--clock</span>: <span class="tok-num">0</span> {'}'}
  <span class="tok-num">25%</span>  {'{'} <span class="tok-prop">--clock</span>: <span class="tok-num">1</span> {'}'}
  <span class="tok-num">50%</span>  {'{'} <span class="tok-prop">--clock</span>: <span class="tok-num">2</span> {'}'}
  <span class="tok-num">75%</span>  {'{'} <span class="tok-prop">--clock</span>: <span class="tok-num">3</span> {'}'}
{'}'}
<span class="tok-sel">.motherboard</span> {'{'}
  animation: tick <span class="tok-num">400ms</span>
    <span class="tok-fn">steps</span>(<span class="tok-num">4</span>) infinite;
{'}'}</code></pre>
    {/snippet}
    {#snippet right()}
      <div class="tick-beats" aria-label="The four beats of one tick, highlighted in turn">
        {#each BEATS as b, i}
          <div class="tick-beat">
            <span class="beat-n">{i}</span>
            <span class="beat-name">{b.name}</span>
            <span class="beat-what">{b.what}</span>
          </div>
        {/each}
      </div>
    {/snippet}
  </SplitPane>
  <p class="caption">
    The moving highlight is itself a CSS animation - the same
    mechanism, slowed 8&times;. The cabinet&rsquo;s clock does a full lap
    every 400&nbsp;ms; Calcite runs the same lap hundreds of thousands of
    times a second.
  </p>
</div>

<style>
  .tick-clock {
    border: 1px solid var(--edit-black);
    background: var(--edit-white);
    box-shadow: 4px 4px 0 var(--edit-black);
    margin: 16px 0;
  }

  /* — left pane: the clock's actual CSS — */
  .tick-code {
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
  .tick-code code { background: none; border: none; padding: 0; }
  /* .tok-* colours come from global.css, except: @keyframes red and
     keyframe selectors green here, so the clock's two halves read apart. */
  .tick-code .tok-at      { color: var(--edit-red); }
  .tick-code .tok-sel     { color: #006600; }

  /* — right pane: the four beats — */
  .tick-beats {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 12px;
  }
  .tick-beat {
    display: grid;
    grid-template-columns: 22px 74px 1fr;
    gap: 8px;
    align-items: baseline;
    border: 1px solid var(--edit-black);
    background: var(--edit-white);
    padding: 5px 8px;
    font-size: 14px;
    line-height: 17px;
    animation: tick-beat-on 3.2s infinite;
  }
  .tick-beat .beat-n { color: var(--edit-red); }
  .tick-beat .beat-name { font-weight: bold; }
  .tick-beat .beat-what { color: #555; }

  /* Each beat is "on" for the first quarter of the cycle; delays stagger
     them so the highlight walks 1 → 2 → 3 → 4, forever. */
  .tick-beat:nth-child(2) { animation-delay: 0.8s; }
  .tick-beat:nth-child(3) { animation-delay: 1.6s; }
  .tick-beat:nth-child(4) { animation-delay: 2.4s; }
  @keyframes tick-beat-on {
    0%, 24.9%  { background: var(--edit-yellow); }
    25%, 100%  { background: var(--edit-white); }
  }

  .tick-clock .caption {
    margin: 0;
    padding: 8px 12px 10px;
    font-size: 14px;
    line-height: 18px;
    color: #555;
    border-top: 1px solid var(--edit-black);
  }
</style>
