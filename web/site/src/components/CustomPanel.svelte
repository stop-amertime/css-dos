<script>
  import { build } from '../lib/builder.svelte.js';

  let fileName = $derived(
    build.source === 'file' ? build.file?.name
    : build.source === 'folder' ? `${build.folderFiles?.length} file${build.folderFiles?.length === 1 ? '' : 's'} from folder`
    : 'No file selected'
  );

  // Buttons that .click() the hidden inputs, not <label for>: label
  // forwarding to a display:none input is unreliable on mobile, and
  // Android refuses to open a chooser at all for an extension-only
  // accept list (.com/.exe have no MIME mapping) — so no accept attr;
  // the picker is open, the sub-label says what belongs in it.
  let fileInput, dirInput;
</script>

<div class="custom-panel">
  <div class="custom-panel-head">Load your own program</div>
  <p class="custom-panel-lede">
    Pick a single <code>.COM</code> or <code>.EXE</code>, or a whole folder
    if your program ships with data files. It runs from a fresh DOS boot,
    exactly like the built-in carts.
  </p>
  <div class="custom-drop">
    <button type="button" class="custom-choice" onclick={() => fileInput.click()}>
      <span class="custom-choice-glyph">&#128196;</span>
      <span class="custom-choice-title"><span class="hot">O</span>pen file&hellip;</span>
      <span class="custom-choice-sub">.com or .exe</span>
    </button>
    <button type="button" class="custom-choice" onclick={() => dirInput.click()}>
      <span class="custom-choice-glyph">&#128193;</span>
      <span class="custom-choice-title">Open f<span class="hot">o</span>lder&hellip;</span>
      <span class="custom-choice-sub">program + data files</span>
    </button>
  </div>
  <p class="custom-selected">
    Selected: <span class="dim">{fileName}</span>
  </p>
</div>

<input type="file" id="com-file" bind:this={fileInput}
       onchange={(e) => build.pickFile(e.currentTarget.files[0])} />
<input type="file" id="dir-file" bind:this={dirInput} webkitdirectory multiple
       onchange={(e) => build.pickFolder(e.currentTarget.files)} />
