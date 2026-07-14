<script>
  // The memory-read exhibit, side by side: what any programming
  // language does in one line, next to a ~2000px tower of the
  // cabinet's real --readMem. All arms and counts verbatim/measured
  // from sokoban.css: 736,510 RAM arms + 6,924 ROM arms + 512 disk
  // window arms + 2 keyboard arms = 743,948, in this file order.
  // No scroll box - the height is the point.
  import SplitPane from './SplitPane.svelte';

  const RAM_CELLS = 40; // 80 RAM lines; ~100 lines total ≈ 1800px
  let slab = '@function --readMem(--at <integer>) returns <integer> {\n  result: if(\n';
  for (let i = 0; i < RAM_CELLS; i++) {
    slab += `    style(--at: ${2 * i}): mod(var(--__1mc${i}), 256);\n`;
    slab += `    style(--at: ${2 * i + 1}): round(down, var(--__1mc${i}) / 256);\n`;
  }
  slab += '\n         … 736,430 more arms like these - every byte of RAM …\n\n';
  slab += '    style(--at: 983040): 235;\n';
  slab += '    style(--at: 983041): 16;\n';
  slab += '    style(--at: 983042): 144;\n';
  slab += '    style(--at: 983043): 144;\n';
  slab += '\n         … 6,920 more baked-in BIOS ROM bytes …\n\n';
  slab += '    /* the disk window: requested sector × 512 + this arm\'s position */\n';
  slab += '    style(--at: 851968): --readDiskByte(calc((mod(var(--__1mc632), 256) + round(down, var(--__1mc632) / 256) * 256) * 512 + 0));\n';
  slab += '    style(--at: 851969): --readDiskByte(calc((mod(var(--__1mc632), 256) + round(down, var(--__1mc632) / 256) * 256) * 512 + 1));\n';
  slab += '\n         … 510 more - the 512-byte disk window …\n\n';
  slab += '  else: 0);\n}';
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
        <div class="fl-band">CSS - verbatim from the cabinet</div>
        <pre class="fl-slab"><code>{slab}</code></pre>
      </div>
    {/snippet}
  </SplitPane>
  <p class="fl-fact">
    One function, <b>743,948 arms</b> - one per address. Just this
    function, the part of the file that reads one byte, is
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
