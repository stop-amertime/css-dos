<script>
  import { build } from '../lib/builder.svelte.js';

  let fileName = $derived(
    build.source === 'file' ? build.file?.name
    : build.source === 'folder' ? `${build.folderFiles?.length} file${build.folderFiles?.length === 1 ? '' : 's'} from folder`
    : 'No file selected'
  );
</script>

<div class="custom-panel">
  <div class="custom-panel-head">Load your own program</div>
  <p class="custom-panel-lede">
    Pick a single <code>.COM</code> or <code>.EXE</code>, or a whole folder
    if your program ships with data files. It runs from a fresh DOS boot,
    exactly like the built-in carts.
  </p>
  <div class="custom-drop">
    <label class="custom-choice" for="com-file">
      <span class="custom-choice-glyph">&#128196;</span>
      <span class="custom-choice-title"><span class="hot">O</span>pen file&hellip;</span>
      <span class="custom-choice-sub">.com or .exe</span>
    </label>
    <label class="custom-choice" for="dir-file">
      <span class="custom-choice-glyph">&#128193;</span>
      <span class="custom-choice-title">Open f<span class="hot">o</span>lder&hellip;</span>
      <span class="custom-choice-sub">program + data files</span>
    </label>
  </div>
  <p class="custom-selected">
    Selected: <span class="dim">{fileName}</span>
  </p>
</div>

<input type="file" id="com-file" accept=".com,.exe"
       onchange={(e) => build.pickFile(e.currentTarget.files[0])} />
<input type="file" id="dir-file" webkitdirectory directory multiple
       onchange={(e) => build.pickFolder(e.currentTarget.files)} />
