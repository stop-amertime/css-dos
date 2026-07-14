<script>
  // Memory — write formulas: the 171 MB write rules, the biggest
  // thing in the file. Main flow rewritten 2026-07-04 to the
  // ABOUT-SCRIPT.md register (the owner's canonical x = y example);
  // facts from CABINET-ANATOMY.md §6, §13. The assembled-cell
  // extract mirrors kiln/emit-css.mjs (slot cascade, slot 0
  // outermost; names tidied per the CPU section's NOTE). Multi-tick
  // subsection: owner experiment (5-10× slower); the ">100 MB" is
  // the 2-of-3 applySlot layers summed over 368,256 cells = 105.6 MB
  // (model sanity: all 3 layers = 169.6 MB vs the measured 171 MB).
  import Foldable from '../Foldable.svelte';
  import RamWrite from '../RamWrite.svelte';
  import SectionHead from '../SectionHead.svelte';
  import Term from '../Term.svelte';
  import CodeCss from '../CodeCss.svelte';

  const APPLY_SLOT = `@function --applySlot(--cell, --live, --loOff, --hiOff, --val, --width) returns <integer> {
  result: if(
    style(--live: 0): var(--cell);                /* slot idle — pass through */
    style(--width: 2) and style(--loOff: 0) and style(--hiOff: 1):
      --lowerBytes(var(--val), 16);              /* whole word, aligned */
    style(--width: 2) and style(--loOff: 1):
      calc(--lowerBytes(var(--val), 8) * 256 + mod(var(--cell), 256));   /* word straddles me: low half */
    style(--width: 2) and style(--hiOff: 0):
      calc(round(down, var(--cell) / 256) * 256 + --rightShift(var(--val), 8));   /* word straddles me: high half */
    style(--loOff: 0): calc(round(down, var(--cell) / 256) * 256 + var(--val));   /* one byte, low */
    style(--loOff: 1): calc(var(--val) * 256 + mod(var(--cell), 256));            /* one byte, high */
  else: var(--cell));
}`;

  const ASSEMBLED_CELL = `--mc5000: --applySlot(--applySlot(--applySlot(var(--mc5000-prev),
      var(--_slot2Live), calc(var(--memAddr2) - 5000 * 2),
      calc(var(--memAddr2) + 1 - 5000 * 2), var(--memVal2), var(--_writeWidth)),
    /* … slot 1, the same shape … */),
  var(--_slot0Live), calc(var(--memAddr0) - 5000 * 2),
  calc(var(--memAddr0) + 1 - 5000 * 2), var(--memVal0), var(--_writeWidth));`;
</script>

<p>
  The reason that memory-write-formulas are the largest section of the file, is covered in 'Problem 2'  of the 'How?' section previously, but lets go into more depth.
</p>
<p>
  A normal language assigns - <code>x&nbsp;=&nbsp;y</code>, and x changes. A stylesheet has no order; every rule is in force the whole time, and you only get to declare, once, what x <i>is</i>:
</p>
<CodeCss code={'--x: 5;'} />
<p>
  So each byte of memory is written as a formula that works out, every <Term t="tick">tick</Term>, what its value now is - closer to a spreadsheet cell than to a line of code. The formula asks one question - did this tick&rsquo;s instruction write to <i>my</i> address? Three <b>write slots</b> carry the answer: small shared variables holding the addresses and values of whatever the current instruction writes.
</p>

<RamWrite />

<p>
  Every byte has to re-check its formula every single tick, whether it was written or not. An instruction that writes one byte - or no bytes at all - still has all 650,000 write formulas recalculate.
</p>
<p class="punchline">
  More than half the file (171&nbsp;MB) is this single formula, written out once per memory cell.
</p>

<SectionHead>Does <i>every</i> byte really need this?</SectionHead>
<p>
  Most of RAM is the program&rsquo;s own instructions, and instructions don&rsquo;t change while they run - so couldn&rsquo;t the code be baked in as literals, the way the <a href="/about/file/memr">read section</a> bakes in the BIOS?
</p>
<p>
  The problem is that at build time, almost nothing is <i>knowably</i> code. The program ships on the floppy, and its bytes only become RAM when DOS loads them - to an address DOS picks, at runtime. Games decompress themselves. Code of this era overwrites its own instructions as a matter of course. The BIOS is the one thing whose bytes are pinned down before power-on - which is why it&rsquo;s exactly the thing that got the literal treatment.
</p>

<SectionHead>How a write actually lands</SectionHead>
<p>
  One complication we&rsquo;ve been skating over: cells hold two bytes each, so &ldquo;write this byte here&rdquo; actually means <i>splicing</i> a value into half of a cell without disturbing the other half. One function does the splicing, and every cell&rsquo;s formula calls it once per write slot - verbatim:
</p>
<CodeCss code={APPLY_SLOT} />
<p>
  The middle two cases are the awkward one: a 16-bit write to an odd address lands half in one cell and half in the next, so <i>both</i> cells fire, each splicing in its own half. And in every cell&rsquo;s formula the three slot calls are nested with slot 0 outermost, so if two slots ever hit the same cell, slot 0 wins.
</p>
<p>
  Assembled, this is one cell of the machine:
</p>
<CodeCss code={ASSEMBLED_CELL} />
<p>
  Why stop at two bytes per cell, when four would halve everything again? Arithmetic: four packed bytes can represent numbers past four billion, beyond the capacity of 32-bit signed integers. Two bytes top out at 65,535 and are always safe.
</p>

<Foldable>
  {#snippet summary()}Why exactly three write slots{/snippet}
  <p>
    The worst case is a hardware interrupt or an <code>INT</code> instruction, which pushes three 16-bit words onto the stack in a single tick - the flags, the code segment, and the return address. Everything else needs fewer, so three slots cover the whole instruction set.
  </p>
  <p>
    Each slot also carries a <b>live gate</b> - a 0/1 saying whether it fires this tick. Most instructions don&rsquo;t write memory at all, and the gate lets all 650,000 write formulas short-circuit at once: &ldquo;no slot is live, nothing changes&rdquo; - without checking a million addresses one by one.
  </p>
</Foldable>

<SectionHead>Couldn&rsquo;t big instructions just take several ticks?</SectionHead>
<p>
  Real CPUs work this way - a hard instruction takes more cycles. If INT were given three ticks for its three pushes, one write slot would cover the whole instruction set, and every one of those 650,000 formulas would shed two thirds of its nesting. That&rsquo;s over 100&nbsp;MB - a third of the entire file, gone.
</p>
<p>
  It was tried. It ran 5&ndash;10&times; slower. The catch: a tick is not a cheap unit - <i>everything</i> re-evaluates every tick, written or not, so an instruction that takes three ticks pays for three full sweeps of the machine to do one instruction&rsquo;s work. What the file saved in size, it lost several times over in re-evaluation.
</p>
<p>
  This tradeoff haunted the whole project: filesize and speed are usually in tension, and the per-tick sweep is so expensive that speed nearly always wins. The three write slots are the price of finishing everything in one.
</p>

<style>
  .punchline {
    margin-top: 16px !important;
    border-left: 4px solid var(--edit-red);
    padding-left: 12px;
    line-height: 18px !important;
  }
</style>
