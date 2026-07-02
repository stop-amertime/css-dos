<script>
  // RamWrite — eight bytes of "RAM" and a button that executes MOV
  // instructions against them. Continues the --mem-00000 example from
  // the "The file" sub-page. The widget state is Svelte; the caption
  // explains how the real cabinet does the same write in CSS.
  import '../styles/_fragments/ram-write.css';

  // Initial values continue the byte-example on sub-page 4.
  let cells = $state([0, 85, 238, 0, 12, 0, 0, 7]);
  let hit = $state(-1);      // cell index that just got written
  let step = $state(0);

  // A fixed little program: each press runs the next write.
  const PROGRAM = [
    { addr: 4, val: 99 },
    { addr: 1, val: 0 },
    { addr: 7, val: 66 },
    { addr: 2, val: 17 },
    { addr: 4, val: 0 },
    { addr: 0, val: 72 },
  ];

  const next = () => PROGRAM[step % PROGRAM.length];
  const pad = (n) => String(n).padStart(5, '0');

  let hitTimer;
  function run() {
    const { addr, val } = next();
    cells[addr] = val;
    hit = -1;              // retrigger the flash even on same-cell writes
    clearTimeout(hitTimer);
    requestAnimationFrame(() => (hit = addr));
    hitTimer = setTimeout(() => (hit = -1), 700);
    step += 1;
  }
</script>

<div class="ram-write">
  <div class="ram-cells">
    {#each cells as v, i}
      <div class="ram-cell" class:hit={hit === i}>
        <span class="ram-val">{v}</span>
        <span class="ram-addr">{pad(i)}</span>
      </div>
    {/each}
  </div>

  <div class="ram-controls">
    <button class="demo-toggle" onclick={run}>
      run&nbsp; MOV [{pad(next().addr)}], {next().val}
    </button>
    <span class="dim small">a real 8086 write instruction</span>
  </div>

  <p class="caption">
    In CSS you can&rsquo;t reach over and change a variable. So a write
    works in reverse: <b>every byte re-decides its own value</b> on every
    tick of the machine, each one checking &ldquo;is this
    instruction writing to <i>my</i> address?&rdquo; The one byte that
    matches takes the new value; the other ~650,000 answer
    &ldquo;no&rdquo; and keep their old one.
  </p>
</div>
