<script>
  // RamWrite — how a memory write works when nothing can write.
  // SplitPane: left, the one formula every byte of RAM is defined by
  // (pseudocode); right, six bytes, a MOV button, and a feed that
  // replays the browser re-evaluating each byte's formula — every one
  // comes out unchanged except the write's target.
  import '../styles/_fragments/ram-write.css';
  import SplitPane from './SplitPane.svelte';
  import { onDestroy } from 'svelte';

  // Initial values continue the byte-example on "The file" sub-page.
  let cells = $state([0, 85, 238, 0, 12, 7]);
  let feed = $state([]);     // revealed feed lines
  let hit = $state(-1);      // cell that just took a new value
  let step = $state(0);
  let running = $state(false);

  // A fixed little program: each press runs the next write.
  const PROGRAM = [
    { addr: 4, val: 99 },
    { addr: 1, val: 0 },
    { addr: 5, val: 66 },
    { addr: 2, val: 17 },
    { addr: 4, val: 0 },
    { addr: 0, val: 72 },
  ];

  const next = () => PROGRAM[step % PROGRAM.length];
  const pad = (n) => String(n).padStart(5, '0');

  let timer;
  function run() {
    if (running) return;
    const { addr, val } = next();
    step += 1;
    feed = [];
    hit = -1;
    running = true;
    let i = 0;
    timer = setInterval(() => {
      if (i < cells.length) {
        const target = i === addr;
        feed = [...feed, { i, target, old: cells[i], val }];
        if (target) { cells[i] = val; hit = i; }
        i += 1;
      } else {
        feed = [...feed, { tail: true }];
        running = false;
        clearInterval(timer);
      }
    }, 170);
  }
  onDestroy(() => clearInterval(timer));
</script>

<div class="ram-write">
  <SplitPane>
    {#snippet left()}
      <pre class="ram-formula"><code><span class="tok-comment">/* every byte of RAM is this formula */</span>

<span class="tok-prop">byte N</span> = <span class="tok-fn">IF</span> this instruction
           writes to address N:
             <span class="tok-num">the value being written</span>
       <span class="tok-fn">ELSE</span>:
             <span class="tok-num">last tick&rsquo;s value of N</span></code></pre>
    {/snippet}
    {#snippet right()}
      <div class="ram-try">
        <div class="ram-cells">
          {#each cells as v, i}
            <div class="ram-cell" class:hit={hit === i}>
              <span class="ram-val">{v}</span>
              <span class="ram-addr">{pad(i)}</span>
            </div>
          {/each}
        </div>
        <button class="demo-toggle" onclick={run} disabled={running}>
          run&nbsp; MOV [{pad(next().addr)}], {next().val}
        </button>
        <div class="ram-feed">
          {#if feed.length === 0}
            <span class="dim small">press run &mdash; watch every formula re-evaluate</span>
          {/if}
          {#each feed as line}
            {#if line.tail}
              <div class="ram-feed-line tail">&hellip;and ~650,000 more, checked every tick.</div>
            {:else if line.target}
              <div class="ram-feed-line yes">byte {pad(line.i)}: written this tick? <b>YES</b> &rarr; becomes {line.val}</div>
            {:else}
              <div class="ram-feed-line">byte {pad(line.i)}: written this tick? no &rarr; stays {line.old}</div>
            {/if}
          {/each}
        </div>
      </div>
    {/snippet}
  </SplitPane>
</div>
