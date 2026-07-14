<script>
  // PixelScreen — how the display works: one CSS rule per pixel. Split
  // pane: left, the first three rules (trailing off to "…63,997 more");
  // right, the 320×200 screen with those pixels drawn in the corner and
  // dimension arrows. Colour chips link each rule to its pixel.
  import SplitPane from './SplitPane.svelte';

  const PX = [
    { colour: '#55ff55' }, // pixel 0 — green
    { colour: '#55ffff' }, // pixel 1 — cyan
    { colour: '#ff55ff' }, // pixel 2 — magenta
  ];
</script>

<div class="pixel-screen">
  <SplitPane>
    {#snippet left()}
      <pre class="pixel-code"><code>{#each PX as p, i}<span class="px-chip" style="background:{p.colour}"></span><span class="tok-sel">#pixel-{i}</span> {'{'}
  background: <span class="tok-fn">--palette</span>(<span class="tok-fn">var</span>(<span class="tok-prop">--vram-{i}</span>));
{'}'}
{/each}<span class="tok-comment">/* … 63,997 more, one per pixel … */</span></code></pre>
    {/snippet}
    {#snippet right()}
      <svg class="pixel-diagram" viewBox="0 0 360 250" role="img"
           aria-label="A 320 by 200 pixel screen; the first three pixels in the top-left corner match the three CSS rules; 64,000 divs in total.">
        <!-- the screen -->
        <rect x="20" y="16" width="288" height="180" fill="#000" stroke="var(--edit-black)" stroke-width="2"/>
        <!-- first pixels, top-left, exaggerated -->
        {#each PX as p, i}
          <rect x={23 + i * 17} y="19" width="16" height="16" fill={p.colour}/>
        {/each}
        <rect x={23 + 3 * 17} y="19" width="16" height="16" fill="#333"/>
        <text x={23 + 4 * 17 + 4} y="32" font-size="13" fill="#888" font-family="inherit">&#8230;</text>
        <!-- second row, fading out -->
        <rect x="23" y="36" width="16" height="16" fill="#222"/>
        <rect x="40" y="36" width="16" height="16" fill="#181818"/>
        <rect x="57" y="36" width="16" height="16" fill="#101010"/>
        <text x="80" y="62" font-size="14" fill="#555" font-family="inherit">&#8945;</text>
        <!-- the payoff, on the screen itself -->
        <text x="164" y="112" text-anchor="middle" font-size="17" fill="#55ff55" font-family="inherit">= 64,000</text>
        <text x="164" y="132" text-anchor="middle" font-size="17" fill="#55ff55" font-family="inherit">&lt;div&gt;s</text>
        <!-- horizontal dimension: 320 across -->
        <line x1="20" y1="212" x2="308" y2="212" stroke="var(--edit-black)" stroke-width="1"/>
        <path d="M20 212 l7 -4 v8 z" fill="var(--edit-black)"/>
        <path d="M308 212 l-7 -4 v8 z" fill="var(--edit-black)"/>
        <text x="164" y="230" text-anchor="middle" font-size="13" fill="var(--edit-black)" font-family="inherit">320 pixels</text>
        <!-- vertical dimension: 200 down -->
        <line x1="322" y1="16" x2="322" y2="196" stroke="var(--edit-black)" stroke-width="1"/>
        <path d="M322 16 l-4 7 h8 z" fill="var(--edit-black)"/>
        <path d="M322 196 l-4 -7 h8 z" fill="var(--edit-black)"/>
        <text x="334" y="106" font-size="13" fill="var(--edit-black)" font-family="inherit"
              transform="rotate(90 334 106)" text-anchor="middle">200 rows</text>
      </svg>
    {/snippet}
  </SplitPane>

  <p class="caption">
    Each rule reads its pixel&rsquo;s byte of video memory
    (<code>--vram-&hellip;</code>) and looks the colour up in the
    palette. No image, no canvas - when a game draws, it writes
    bytes, and divs change colour.
  </p>
</div>

<style>
  .pixel-screen {
    border: 1px solid var(--edit-black);
    background: var(--edit-white);
    box-shadow: 4px 4px 0 var(--edit-black);
    margin: 16px 0;
  }

  .pixel-code {
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
  .pixel-code code { background: none; border: none; padding: 0; }
  /* .tok-* colours come from global.css. */

  /* Colour chip linking a rule to its pixel in the diagram. */
  .px-chip {
    display: inline-block;
    width: 10px;
    height: 10px;
    margin-right: 6px;
    border: 1px solid var(--edit-black);
    vertical-align: baseline;
  }

  .pixel-diagram {
    display: block;
    width: 100%;
    height: auto;
    padding: 8px 10px;
    box-sizing: border-box;
  }

  .pixel-screen .caption {
    margin: 0;
    padding: 10px 16px 12px;
    font-size: 16px;
    line-height: 18px;
    color: var(--edit-black);
    border-top: 1px solid var(--edit-black);
  }
</style>
