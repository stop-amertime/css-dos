<script>
  // TickClock — the machine's clock. Left: the cabinet's actual clock
  // CSS. Right: the four beats of one tick, highlighted in turn by a
  // pure-CSS animation (tick-clock.css) — the widget runs on the same
  // mechanism it explains, 8× slower.
  import '../styles/_fragments/tick-clock.css';
  import SplitPane from './SplitPane.svelte';

  const BEATS = [
    { name: 'read',    what: 'every formula sees last tick’s finished state' },
    { name: 'compute', what: 'fetch, decode, execute — new values appear' },
    { name: 'stage',   what: 'results parked in a staging copy' },
    { name: 'commit',  what: 'staging becomes the next tick’s snapshot' },
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
<span class="tok-sel">.cpu</span> {'{'}
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
    The moving highlight is itself a CSS animation &mdash; the same
    mechanism, slowed 8&times;. The cabinet&rsquo;s clock does a full lap
    every 400&nbsp;ms; Calcite runs the same lap hundreds of thousands of
    times a second.
  </p>
</div>
