<script>
  import { build } from '../lib/builder.svelte.js';

  // The builder emits ~6–8 progress stages but the exact count isn't known
  // in advance, so ease the bar toward 95%: each stage closes 30% of the
  // remaining gap. Snap to 100% once the cabinet is done. (Same easing the
  // old MutationObserver used.)
  let pct = $derived(build.done ? 100 : 95 * (1 - 0.7 ** build.progressStages));
</script>

<div class="build-progress">
  <div class="bar"><div class="bar-fill" class:failed={build.failed} style:width="{pct}%"></div></div>
  <div class="build-progress-meta">
    <span>{Math.floor(pct)}%</span>
    <span class="dim">{build.done ? build.sizeLabel.replace(/^Cabinet:\s*/, '') : ''}</span>
  </div>
</div>
{#if build.failed}
  <div class="build-error">Build failed: {build.buildError}</div>
{/if}
<pre class="build-log">{build.progressLog}</pre>

<style>
  .build-progress { display: flex; align-items: center; gap: 12px; }
  .build-progress .bar {
    flex: 1;
    height: 16px;
    background: var(--edit-white);
    border: 1px solid var(--edit-black);
    overflow: hidden;
  }
  .build-progress .bar .bar-fill {
    height: 100%; width: 0%;
    background: repeating-linear-gradient(
      90deg, var(--edit-blue) 0 6px, #0000ff 6px 8px
    );
    transition: width 240ms ease-out;
  }
  .build-progress .bar .bar-fill.failed {
    background: repeating-linear-gradient(
      90deg, #aa0000 0 6px, #ff0000 6px 8px
    );
  }

  .build-error {
    margin-top: 8px;
    border: 1px solid #aa0000;
    background: var(--edit-white);
    color: #aa0000;
    padding: 4px 8px;
    font-size: 15px;
    line-height: 16px;
    white-space: pre-wrap;
  }
  .build-progress-meta {
    display: flex; gap: 12px;
    font-size: 16px; line-height: 16px;
    color: var(--edit-black);
  }

  /* Raw log — collapsed to a scrolling pane under the progress bar. */
  .build-log {
    margin-top: 8px;
    max-height: 96px;
    overflow-y: auto;
    border: 1px solid var(--edit-black);
    background: var(--edit-white);
    color: var(--edit-black);
    padding: 4px 8px;
    font-family: 'WebVGA', monospace; letter-spacing: normal;
    font-size: 14px;
    line-height: 14px;
    white-space: pre-wrap;
  }
</style>
