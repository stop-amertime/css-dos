<script>
  // Browser-capability notice, shown on the Build and Play steps. Hard
  // failures (no SW / HTTPS / COOP+COEP / WASM) mean the player cannot
  // work in this browser — say so ON the page; console errors are
  // unreachable on mobile. Reasons come from lib/health.svelte.js.
  import '../styles/_fragments/env-notice.css';
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
