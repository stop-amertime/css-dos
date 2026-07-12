<script>
  // CpuCoverage — all fourteen register tables as one grid: a mark
  // where that register's table has a row for that opcode. Data
  // measured from sokoban.css (cpu-coverage.js): 850 rows, 232
  // distinct opcodes. Static SVG.
  import { COVERAGE } from './cpu-coverage.js';

  const REGS = Object.keys(COVERAGE); // file order
  const LEFT = 58;      // room for row labels
  const CELL = (692 - LEFT) / 256;
  const ROW = 15;
  const TOP = 20;
  const H = TOP + REGS.length * ROW + 24;
</script>

<div class="cpu-cov">
  <svg viewBox="0 0 700 {H}" role="img"
       aria-label="A grid of fourteen register rows by 256 opcode columns. A red mark shows where that register's table has a row for that opcode: 850 marks. The IP row is completely full; the segment-register rows are nearly empty.">
    <text x={LEFT} y="12" font-size="11" fill="#555" font-family="inherit">opcode 0</text>
    <text x="692" y="12" font-size="11" fill="#555" font-family="inherit" text-anchor="end">255</text>
    {#each REGS as r, ri}
      <text x={LEFT - 8} y={TOP + ri * ROW + 11} font-size="11" fill="var(--edit-black)"
            font-family="inherit" text-anchor="end">{r}</text>
      {#each COVERAGE[r] as op}
        <rect x={LEFT + op * CELL} y={TOP + ri * ROW} width={CELL * 0.82} height={ROW - 3}
              fill="#aa0000"/>
      {/each}
    {/each}
  </svg>
  <p class="caption">
    850 rows, 232 distinct opcodes &mdash; measured from the Sokoban
    cabinet. The IP row is full: every instruction has to say where the
    machine goes next. The blank columns are opcodes the 8086 never
    defined; the near-empty rows are the segment registers, which
    almost no instruction can modify.
  </p>
</div>

<style>
  .cpu-cov {
    margin: 12px 0;
    border: 1px solid var(--edit-black);
    background: var(--edit-white);
    box-shadow: 4px 4px 0 var(--edit-black);
    padding: 10px 12px 2px;
  }
  .cpu-cov svg { display: block; width: 100%; height: auto; }
  .cpu-cov .caption {
    margin: 8px 0;
    font-size: 13px;
    line-height: 17px;
    color: #555;
  }
</style>
