<script>
  // Bit & byte helpers — the 21 shared @functions the file opens with:
  // bit operations, byte plumbing, packed-cell helpers, the power-of-2
  // lookup. The CPU-only helpers (decode ADT, flag arithmetic) moved to
  // the CPU section in the 2026-07-12 file-map reorg, so this section is
  // now just the genuinely-shared primitives. Extracts verbatim from
  // sokoban.css; the count (21) and size (~15 KB) measured from the same file.
  import Foldable from '../Foldable.svelte';
  import SectionHead from '../SectionHead.svelte';
  import Term from '../Term.svelte';
  import CodeCss from '../CodeCss.svelte';
  import TreeView from './tree/TreeView.svelte';
  import { UTIL_TREE, UTIL_TREE_META } from './tree/util-tree.js';

  // The AND worked example: 172 AND 102 = 36.
  const A_BITS = [1, 0, 1, 0, 1, 1, 0, 0]; // 172
  const B_BITS = [0, 1, 1, 0, 0, 1, 1, 0]; // 102

  const AND_FN = `@function --and(--a <integer>, --b <integer>) returns <integer> {
  --a1: mod(var(--a), 2);
  --a2: mod(round(down, var(--a) / 2), 2);
  --a3: mod(round(down, var(--a) / 4), 2);
  /* … sixteen bits of --a, sixteen bits of --b … */
  result: calc(
    var(--a1) * var(--b1) +
    calc(var(--a2) * var(--b2)) * 2 +
    calc(var(--a3) * var(--b3)) * 4 +
    /* … */`;

  const LESS_THAN = `max(0, sign(B - A - 0.5))    /* 1 if A < B, else 0 */`;

  const POW2 = `@function --pow2(--n <integer>) returns <integer> {
  result: if(
    style(--n: 0): 1;
    style(--n: 1): 2;
    style(--n: 2): 4;
    style(--n: 3): 8;
    /* … up to 2³¹ … */`;

  const PARITY = `@function --parity(--val <integer>) returns <integer> {
  --low8: --lowerBytes(var(--val), 8);
  result: if(
    style(--low8: 0): 4;
    style(--low8: 1): 0;
    style(--low8: 2): 0;
    style(--low8: 3): 4;
    /* … all 256 byte values … */`;
</script>

<TreeView nodes={UTIL_TREE} title="Bit &amp; byte helpers" bytes={UTIL_TREE_META.bytes} />

<p>
  After a short header comment (the build recipe, for humans opening the file), the first thing in the <Term t="cabinet">cabinet</Term> is a toolbox: <b>21 small functions</b> that everything else is built from. They exist because of a supply problem:
</p>

<div class="ops-supply">
  <div class="ops-col">
    <div class="ops-head">CSS arithmetic has</div>
    <div class="ops-row"><code>x + y</code><span class="tick">&#10003;</span></div>
    <div class="ops-row"><code>x &minus; y</code><span class="tick">&#10003;</span></div>
    <div class="ops-row"><code>x &times; y</code><span class="tick">&#10003;</span></div>
    <div class="ops-row"><code>x &divide; y</code><span class="tick">&#10003;</span></div>
    <div class="ops-row"><code>mod(x, y)</code><span class="tick">&#10003;</span></div>
    <div class="ops-row"><code>round(x)</code><span class="tick">&#10003;</span></div>
  </div>
  <div class="ops-col">
    <div class="ops-head">an 8086 needs</div>
    <div class="ops-row"><code>x AND y</code><span class="cross">&#10007;</span></div>
    <div class="ops-row"><code>x OR y</code><span class="cross">&#10007;</span></div>
    <div class="ops-row"><code>x XOR y</code><span class="cross">&#10007;</span></div>
    <div class="ops-row"><code>x &lt;&lt; n</code><span class="cross">&#10007;</span></div>
    <div class="ops-row"><code>x &lt; y</code><span class="cross">&#10007;</span></div>
  </div>
</div>

<p>
  Everything in the right-hand column has to be built out of the left-hand column.
</p>

<Foldable class="fold-bg">
  {#snippet summary()}Background: AND, OR, and why a CPU needs them{/snippet}
  <p>
    Computers store numbers as <b>bits</b> &mdash; a 16-bit number is sixteen 0-or-1 digits. AND, OR and XOR combine two numbers one bit position at a time: AND keeps a 1 only where both numbers have a 1, OR where either does, XOR where exactly one does. Programs lean on them for all their small work &mdash; testing whether one bit is set, blanking out part of a number while keeping the rest, flipping pixels &mdash; and a bit-shift (sliding all the digits left or right) is how they multiply and divide by powers of two cheaply.
  </p>
</Foldable>

<SectionHead>Bit operations from arithmetic</SectionHead>
<p>
  On single bits, AND is multiplication: 1&times;1 is 1, everything else is 0. Line two numbers up in binary and multiply each column:
</p>

<div class="and-work">
  <div class="aw-row">
    <span class="aw-lbl"></span>
    {#each A_BITS as b, i}<span class="aw-bit" class:hot={A_BITS[i] && B_BITS[i]}>{b}</span>{/each}
    <span class="aw-eq">= 172</span>
  </div>
  <div class="aw-row">
    <span class="aw-lbl">AND</span>
    {#each B_BITS as b, i}<span class="aw-bit" class:hot={A_BITS[i] && B_BITS[i]}>{b}</span>{/each}
    <span class="aw-eq">= 102</span>
  </div>
  <div class="aw-row aw-result">
    <span class="aw-lbl">=</span>
    {#each A_BITS as b, i}<span class="aw-bit" class:hot={A_BITS[i] && B_BITS[i]}>{A_BITS[i] * B_BITS[i]}</span>{/each}
    <span class="aw-eq">= 36</span>
  </div>
  <p class="aw-caption">Each column is one multiplication; only 1&nbsp;&times;&nbsp;1 survives.</p>
</div>

<p>
  So <code>--and</code> splits both numbers into their sixteen bits with divide-and-remainder, multiplies each pair, and reassembles the result:
</p>
<CodeCss code={AND_FN} />
<p>
  OR and XOR come out of the same move: per bit, OR is <code>min(1, a + b)</code> and XOR is <code>a + b &minus; 2ab</code>; NOT is <code>1 &minus; a</code>.
</p>

<SectionHead>Comparisons from sign()</SectionHead>
<p>
  &ldquo;Is A less than B?&rdquo; is built from <code>sign()</code>, which returns &minus;1, 0 or +1:
</p>
<CodeCss code={LESS_THAN} />
<p>
  <code>sign(B&nbsp;&minus;&nbsp;A)</code> is +1 when A is below B, 0 at a tie, &minus;1 above; <code>max()</code> flattens everything that isn&rsquo;t +1 to 0. A and B are whole numbers, so subtracting 0.5 pushes a tie safely below zero instead of landing on <code>sign()</code>&rsquo;s awkward middle answer. The result is a clean 0 or 1 that can be fed straight into more arithmetic. This exact line is how subtraction decides whether it had to borrow (<a href="#about/file/cpu">the CPU</a>&rsquo;s carry flag), and how <a href="#about/file/screen">the screen</a> fakes its 70-per-second retrace signal.
</p>

<p>
  A 0-or-1 answer also stands in for &ldquo;if&rdquo; inside a formula: <code>flag&nbsp;&times;&nbsp;A + (1&nbsp;&minus;&nbsp;flag)&nbsp;&times;&nbsp;B</code> picks A or B. The machine even uses it to cancel memory writes: when a write shouldn&rsquo;t happen, the same trick turns its target address into &minus;1, which no memory cell answers to, and the write lands nowhere.
</p>

<SectionHead>The prebaked tables</SectionHead>
<p>
  Some of the functions don&rsquo;t compute anything &mdash; the answers were worked out at build time and written into the file. <code>calc()</code> can&rsquo;t raise 2 to a variable power, which is needed whenever a program shifts by an amount held in a <Term t="register">register</Term>, so <code>--pow2</code> is just the answers:
</p>
<CodeCss code={POW2} />
<p>
  And the 8086&rsquo;s parity flag reports the number of 1-bits in a result. Nothing in CSS counts bits, so <code>--parity</code> carries the verdict for all 256 possible bytes:
</p>
<CodeCss code={PARITY} />
<p>
  The answers are 0 and 4 rather than 0 and 1. The parity flag sits at bit 2 of the flags register &mdash; worth 4 &mdash; so the table stores every answer already moved to its position, saving a shift on every arithmetic instruction.
</p>

<SectionHead>What else is in the box</SectionHead>
<p>
  The rest of the 66 sort into three rough families: byte plumbing, which splits and splices the two-bytes-per-cell memory (<code>--extractByte</code>, <code>--spliceByte</code>, <code>--applySlot</code> &mdash; the <a href="#about/file/memw">write-formulas section</a> shows the last one at work); instruction decoding, which picks apart x86 operand bytes (<code>--getReg16</code>, <code>--modrmLen</code>); and thirty-six flag calculators (<code>--addFlags16</code>, <code>--shrFlags8</code>, &hellip;), which <a href="#about/file/cpu">the CPU section</a> comes back to.
</p>

<style>
  .ops-supply {
    display: flex;
    gap: 0;
    margin: 12px 0;
    border: 1px solid var(--edit-black);
    background: var(--edit-white);
    box-shadow: 4px 4px 0 var(--edit-black);
    width: fit-content;
  }
  .ops-col { min-width: 190px; }
  .ops-col + .ops-col { border-left: 1px solid var(--edit-black); }
  .ops-head {
    font-family: 'WebVGA', monospace;
    letter-spacing: normal;
    font-size: 13px;
    line-height: 13px;
    padding: 6px 12px;
    background: var(--edit-black);
    color: var(--edit-yellow);
  }
  .ops-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 16px;
    padding: 5px 12px;
  }
  .ops-row code { background: none; border: none; padding: 0; }
  .ops-row .tick { color: #00aa00; }
  .ops-row .cross { color: #aa0000; font-weight: bold; }

  .and-work {
    margin: 12px 0;
    border: 1px solid var(--edit-black);
    background: var(--edit-white);
    box-shadow: 4px 4px 0 var(--edit-black);
    padding: 12px 16px 4px;
    width: fit-content;
    font-family: 'WebVGA', monospace;
    letter-spacing: normal;
  }
  .aw-row { display: flex; align-items: baseline; }
  .aw-lbl {
    width: 52px;
    text-align: right;
    padding-right: 12px;
    color: #555;
    font-size: 14px;
  }
  .aw-bit {
    width: 24px;
    text-align: center;
    font-size: 17px;
    line-height: 26px;
    color: #555;
  }
  .aw-bit.hot { color: #00aa00; font-weight: bold; }
  .aw-eq { padding-left: 14px; color: var(--edit-black); font-size: 14px; }
  .aw-result .aw-bit { border-top: 1px solid var(--edit-black); }
  .aw-result .aw-bit:not(.hot) { color: #aaa; }
  .aw-caption {
    margin: 8px 0 6px;
    font-size: 13px;
    line-height: 17px;
    color: #555;
  }
</style>
