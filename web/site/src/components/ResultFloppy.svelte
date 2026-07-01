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
    <h3>Cabinet built.</h3>
    <p class="dim">{build.sizeLabel}</p>
    <p class="dim">
      One <code>.css</code> file. Open it in Chrome (slow) or hand it to
      Calcite (fast) on the next step.
    </p>
    <div class="row">
      <button class="btn" onclick={() => build.download()}>
        <span class="floppy-icon" aria-hidden="true">&#128190;</span>
        <span class="hot">S</span>ave cabinet.css
      </button>
    </div>
  </div>
</div>
