<script>
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
      (optional) Download cabinet.css - {build.sizeMB}
    </button>
  </div>
</div>

<style>
  /* Base 96px size; build.css's .result-floppy / .result-floppy .floppy
     scales this down to 60% for the "Cabinet ready" panel - that rule
     stays global (it's applied from the parent route, Build.svelte). */
  .result-floppy .floppy {
    width: 96px; height: 96px;
    background: #1a1a1a;
    border: 2px solid var(--edit-black);
    position: relative;
    margin: 0;
  }
  .floppy-shutter {
    position: absolute; top: 6px; left: 20px;
    width: 56px; height: 24px;
    background: #aaaaaa;
    border: 1px solid var(--edit-black);
  }
  .floppy-shutter::after {
    content: '';
    position: absolute;
    top: 5px; left: 6px;
    width: 40px; height: 3px;
    background: var(--edit-black);
  }
  .floppy-label {
    position: absolute;
    bottom: 8px; left: 8px; right: 8px;
    height: 48px;
    background: var(--edit-white);
    border: 1px solid var(--edit-black);
    padding: 4px 6px;
    color: var(--edit-black);
    font-size: 12px; line-height: 13px;
  }
  .floppy-label-name {
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-bottom: 2px;
  }
  .floppy-label-sub {
    color: var(--edit-red);
    font-size: 12px; line-height: 13px;
  }
  .floppy-icon {
    display: inline-block;
    margin-right: 4px;
  }
</style>
