<script>
  import '../styles/_fragments/build-progress.css';
  import { build } from '../lib/builder.svelte.js';

  // The builder emits ~6–8 progress stages but the exact count isn't known
  // in advance, so ease the bar toward 95%: each stage closes 30% of the
  // remaining gap. Snap to 100% once the cabinet is done. (Same easing the
  // old MutationObserver used.)
  let pct = $derived(build.done ? 100 : 95 * (1 - 0.7 ** build.progressStages));
</script>

<div class="build-progress">
  <div class="bar"><div class="bar-fill" style:width="{pct}%"></div></div>
  <div class="build-progress-meta">
    <span>{Math.floor(pct)}%</span>
    <span class="dim">{build.done ? build.sizeLabel.replace(/^Cabinet:\s*/, '') : ''}</span>
  </div>
</div>
<pre class="build-log">{build.progressLog}</pre>
