<script>
  import '../styles/_fragments/result-floppy.css';
  import { build } from '../lib/builder.svelte.js';
</script>

<div class="result-row">
  <div class="result-floppy" aria-hidden="true">
    <div class="floppy">
      <div class="floppy-shutter"></div>
      <div class="floppy-label">
        <div class="floppy-label-name">{build.floppyName}</div>
        <div class="floppy-label-sub">CSS-DOS 1.0</div>
      </div>
    </div>
  </div>
  <div class="result-info">
    <h3 class="result-ok"><span class="result-tick" aria-hidden="true">&#10004;</span> CSS file built</h3>
    <button class="result-dl" onclick={() => build.download()}>
      (optional) Download cabinet.css &mdash; {build.sizeMB}
    </button>
  </div>
</div>
