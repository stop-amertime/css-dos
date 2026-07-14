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
  // accept list (.com/.exe have no MIME mapping) - so no accept attr;
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

<style>
  /* Custom-program upload panel - surfaced only when the Custom card is
     selected. A substantial bordered panel, not a one-line link. */
  .custom-panel {
    margin-top: 16px;
    border: 2px solid var(--edit-black);
    background: var(--edit-white);
    box-shadow: 4px 4px 0 var(--edit-black);
    padding: 16px 20px 18px;
  }
  .custom-panel-head {
    font-size: 16px;
    line-height: 16px;
    color: var(--edit-black);
    margin-bottom: 8px;
  }
  .custom-panel-lede {
    font-size: 14px;
    line-height: 18px;
    color: #333;
    margin: 0 0 14px;
  }
  .custom-drop {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }
  /* A real <button> (it .click()s the hidden input) - reset the native
     chrome, keep the dashed drop-target look. */
  .custom-choice {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    text-align: center;
    padding: 20px 12px;
    border: 1px dashed var(--edit-black);
    background: var(--edit-gray);
    cursor: pointer;
    user-select: none;
    font: inherit;
    width: 100%;
  }
  .custom-choice:hover { background: #ddddff; }
  .custom-choice-glyph { font-size: 40px; line-height: 1; }
  .custom-choice-title { font-size: 16px; line-height: 16px; color: var(--edit-black); }
  .custom-choice-sub { font-size: 12px; line-height: 12px; color: #555; }
  .custom-selected {
    margin: 14px 0 0;
    font-size: 14px;
    line-height: 16px;
    color: var(--edit-black);
  }
</style>
