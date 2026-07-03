<script>
  // The memory-read exhibit, side by side: what any programming
  // language does in one line, next to a ~2000px tower of the
  // cabinet's real --readMem (verbatim text; the real thing has
  // ~1,000,000 checks). No scroll box — the height is the point.
  import SplitPane from './SplitPane.svelte';

  const CELLS = 54; // ~110 lines ≈ 2000px tall
  let slab = '@function --readMem(--at <integer>) returns <integer> {\n  result: if(\n';
  for (let i = 0; i < CELLS; i++) {
    slab += `    style(--at: ${2 * i}): mod(var(--__1mc${i}), 256);\n`;
    slab += `    style(--at: ${2 * i + 1}): round(down, var(--__1mc${i}) / 256);\n`;
  }
  slab += '    …';
</script>

<div class="fetch-ladder">
  <SplitPane>
    {#snippet left()}
      <div class="fl-col">
        <div class="fl-sticky">
          <div class="fl-band">any programming language</div>
          <pre class="fl-want"><code>opcode = memory[IP];</code></pre>
        </div>
      </div>
    {/snippet}
    {#snippet right()}
      <div class="fl-col">
        <div class="fl-band">CSS &mdash; verbatim from the cabinet</div>
        <pre class="fl-slab"><code>{slab}</code></pre>
      </div>
    {/snippet}
  </SplitPane>
  <p class="fl-fact">
    It continues like that for every address. Just this function &mdash;
    the part of the file that reads one byte &mdash; is
    <b>44 million characters</b>: nine complete works of Shakespeare.
  </p>
</div>

<style>
  .fetch-ladder {
    margin: 12px 0;
    border: 1px solid var(--edit-black);
    background: var(--edit-white);
    box-shadow: 4px 4px 0 var(--edit-black);
  }
  .fl-col {
    display: flex;
    flex-direction: column;
    height: 100%;
  }
  /* The one-liner rides along while the tower scrolls past. */
  .fl-sticky { position: sticky; top: 0; }
  .fl-band {
    font-family: 'WebVGA', monospace; letter-spacing: normal;
    font-size: 13px;
    line-height: 13px;
    padding: 5px 10px;
    background: var(--edit-black);
    color: var(--edit-yellow);
  }
  .fl-want {
    margin: 0;
    padding: 14px 16px;
    font-family: 'WebVGA', monospace; letter-spacing: normal;
    font-size: 16px;
    line-height: 20px;
    color: var(--edit-black);
    background: var(--edit-white);
    white-space: pre;
    overflow-x: auto;
  }
  .fl-want code { background: none; border: none; padding: 0; }
  .fl-slab {
    margin: 0;
    padding: 12px 16px;
    font-family: 'WebVGA', monospace; letter-spacing: normal;
    font-size: 13px;
    line-height: 18px;
    color: var(--edit-black);
    background: var(--edit-white);
    white-space: pre;
    overflow-x: auto;
  }
  .fl-slab code { background: none; border: none; padding: 0; }
  .fl-fact {
    margin: 0;
    padding: 10px 14px;
    border-top: 1px solid var(--edit-black);
    font-size: 15px;
    line-height: 20px;
  }
</style>
