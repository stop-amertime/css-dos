<script>
  // Browser-capability notice, shown on the Build and Play steps. Hard
  // failures (no SW / HTTPS / COOP+COEP / WASM) mean the player cannot
  // work in this browser - say so ON the page; console errors are
  // unreachable on mobile. Reasons come from lib/health.svelte.js.
  import { health } from '../lib/health.svelte.js';
</script>

{#if !health.canRun}
<div class="env-fail">
  <div class="env-fail-head"><span class="warn-glyph">&#9888;</span> This browser can&rsquo;t run the player</div>
  <ul class="env-fail-list">
    {#each health.hardFailures as reason}<li>{reason}</li>{/each}
  </ul>
  <p class="dim small">A recent Chrome, Edge or Firefox over HTTPS should work.
  You can still build cabinets and download the <code>.css</code> file.</p>
</div>
{:else if health.softWarnings.length}
<div class="env-warn">
  {#each health.softWarnings as w}<div><span class="warn-glyph">&#9888;</span> {w}</div>{/each}
</div>
{/if}

<style>
  /* .env-fail = the player cannot work here (missing SW / HTTPS /
     COOP+COEP / WASM); .env-warn = it can, but shakily (low memory). */
  .env-fail {
    margin-bottom: 16px;
    border: 1px solid var(--edit-red);
    background: #ffeeee;
    padding: 10px 12px;
  }
  .env-fail-head {
    color: var(--edit-red);
    font-weight: bold;
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .env-fail .warn-glyph, .env-warn .warn-glyph {
    color: var(--edit-red);
    font-size: 22px;
    line-height: 16px;
    flex-shrink: 0;
  }
  .env-fail-list {
    margin: 8px 0;
    padding-left: 22px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .env-fail p { margin: 0; }
  .env-warn {
    margin-bottom: 16px;
    border: 1px solid var(--edit-black);
    background: #ffffdd;
    padding: 8px 10px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .env-warn > div { display: flex; gap: 8px; align-items: flex-start; }
</style>
