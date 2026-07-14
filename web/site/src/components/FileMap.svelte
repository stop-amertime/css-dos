<script>
  // FileMap — the Sokoban cabinet (~309 MB) drawn to scale, in file
  // order. Sizes measured from a real build (see CABINET-ANATOMY.md).
  // The CPU is a 3px red hairline with a zoom callout — that IS the
  // point of the figure.
  // [label, MB, colour, px width] — px pre-computed for a 680px bar
  const SEGS = [
    { x: 10,  w: 3,   c: '#aa0000' },  // CPU (exaggerated ~4x to be visible)
    { x: 13,  w: 14,  c: '#aa00aa' },  // pixel painter
    { x: 27,  w: 70,  c: '#aa5500' },  // @property declarations
    { x: 97,  w: 96,  c: '#00aaaa' },  // memory read function
    { x: 193, w: 28,  c: '#00aa00' },  // floppy disk
    { x: 221, w: 33,  c: '#aaaaaa' },  // double-buffer reads
    { x: 254, w: 374, c: '#0000aa' },  // memory write rules
    { x: 628, w: 33,  c: '#aaaaaa' },  // store keyframe
    { x: 661, w: 29,  c: '#aaaaaa' },  // execute keyframe
  ];

  const LEGEND = [
    { c: '#aa0000', label: 'the CPU — ~0.3 MB' },
    { c: '#aa00aa', label: 'pixel painter — 6.5 MB' },
    { c: '#aa5500', label: 'declarations — 32 MB' },
    { c: '#00aaaa', label: 'memory read — 44 MB' },
    { c: '#00aa00', label: 'floppy disk — 13 MB' },
    { c: '#aaaaaa', label: 'staging sweeps (×3) — 43 MB' },
    { c: '#0000aa', label: 'memory write rules — 171 MB' },
  ];
</script>

<div class="file-map">
  <svg viewBox="0 0 700 122" role="img"
       aria-label="The 309 megabyte cabinet file drawn to scale as a bar. Memory write rules take over half; the CPU is a hairline of about 300 kilobytes.">
    {#each SEGS as s}
      <rect x={s.x} y="8" width={s.w} height="44" fill={s.c}/>
    {/each}
    <rect x="10" y="8" width="680" height="44" fill="none"
          stroke="var(--edit-black)" stroke-width="1.5"/>
    <!-- labels inside the two biggest segments -->
    <text x="441" y="34" text-anchor="middle" font-size="13" fill="#fff"
          font-family="inherit">memory write rules - 171 MB</text>
    <text x="145" y="34" text-anchor="middle" font-size="12" fill="#fff"
          font-family="inherit">read - 44 MB</text>
    <!-- zoom callout for the CPU hairline -->
    <line x1="10" y1="53" x2="10" y2="82" stroke="#aa0000" stroke-width="1"/>
    <line x1="13" y1="53" x2="250" y2="82" stroke="#aa0000" stroke-width="1"/>
    <rect x="10" y="82" width="240" height="30" fill="var(--edit-white)"
          stroke="#aa0000" stroke-width="1.5"/>
    <text x="130" y="101" text-anchor="middle" font-size="13" fill="#aa0000"
          font-family="inherit">the entire CPU - ~300 KB (0.1%)</text>
  </svg>

  <div class="file-map-legend">
    {#each LEGEND as l}
      <span><span class="chip" style="background:{l.c}"></span>{l.label}</span>
    {/each}
  </div>

  <p class="caption">
    The whole file, in order, to scale. Everything except the red
    sliver is memory bookkeeping.
  </p>
</div>

<style>
  .file-map {
    border: 1px solid var(--edit-black);
    background: var(--edit-white);
    box-shadow: 4px 4px 0 var(--edit-black);
    margin: 16px 0;
    padding: 12px;
  }
  .file-map svg {
    width: 100%;
    height: auto;
    display: block;
  }

  .file-map-legend {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 16px;
    margin-top: 10px;
    font-size: 14px;
    line-height: 18px;
    color: var(--edit-black);
  }
  .file-map-legend .chip {
    display: inline-block;
    width: 11px;
    height: 11px;
    border: 1px solid var(--edit-black);
    margin-right: 5px;
    vertical-align: -1px;
  }

  .file-map .caption {
    margin: 10px 0 0;
    font-size: 14px;
    line-height: 18px;
    color: #555;
  }
</style>
