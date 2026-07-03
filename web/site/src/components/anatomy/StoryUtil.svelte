<script>
  // Utility functions — the 66 @functions the file opens with: bit
  // operations, byte plumbing, decode helpers, flag calculators, and
  // the prebaked lookup tables. Split out of the CPU story 2026-07-03.
  // Extracts verbatim from sokoban.css; the count (66) and size
  // (~60 KB, offsets 28,218–90,652) measured from the same file.
  import Foldable from '../Foldable.svelte';
  import SignDemo from '../SignDemo.svelte';
</script>

<p>
  After the header comment, the first thing in the file is a toolbox:
  <b>66 small functions</b> that everything else is built from. They
  exist because CSS arithmetic can add, subtract, multiply, divide,
  round, and take a remainder &mdash; and that is the entire list.
  There is no AND, no OR, no bit-shift, and no way to ask whether A is
  less than B. An 8086 uses all of those constantly, so the missing
  operations have to be built out of the arithmetic that does exist.
</p>

<Foldable class="fold-bg">
  {#snippet summary()}Background: AND, OR, and why a CPU needs them{/snippet}
  <p>
    Computers store numbers as <b>bits</b> &mdash; a 16-bit number is
    sixteen 0-or-1 digits. AND, OR and XOR combine two numbers one bit
    position at a time: AND keeps a 1 only where both numbers have a 1,
    OR where either does, XOR where exactly one does. Programs lean on
    them for all their small work &mdash; testing whether one bit is
    set, blanking out part of a number while keeping the rest, flipping
    pixels &mdash; and a bit-shift (sliding all the digits left or
    right) is how they multiply and divide by powers of two cheaply.
  </p>
</Foldable>

<h3 class="anatomy-head">Bit operations from arithmetic</h3>
<p>
  On single bits, AND is multiplication: 1&times;1 is 1, everything
  else is 0. So <code>--and</code> splits both numbers into their
  sixteen bits with divide-and-remainder, multiplies each pair, and
  reassembles the result:
</p>
<pre class="byte-example"><code>@function <span class="tok-prop">--and</span>(<span class="tok-prop">--a</span> &lt;integer&gt;, <span class="tok-prop">--b</span> &lt;integer&gt;) returns &lt;integer&gt; {'{'}
  <span class="tok-prop">--a1</span>: mod(var(--a), <span class="tok-num">2</span>);
  <span class="tok-prop">--a2</span>: mod(round(down, var(--a) / <span class="tok-num">2</span>), <span class="tok-num">2</span>);
  <span class="tok-prop">--a3</span>: mod(round(down, var(--a) / <span class="tok-num">4</span>), <span class="tok-num">2</span>);
  <span class="tok-comment">/* … sixteen bits of --a, sixteen bits of --b … */</span>
  result: calc(
    var(--a1) * var(--b1) +
    calc(var(--a2) * var(--b2)) * <span class="tok-num">2</span> +
    calc(var(--a3) * var(--b3)) * <span class="tok-num">4</span> +
    <span class="tok-comment">/* … */</span></code></pre>
<p>
  OR and XOR come out of the same move: per bit, OR is
  <code>min(1, a + b)</code> and XOR is
  <code>a + b &minus; 2ab</code>; NOT is <code>1 &minus; a</code>.
</p>

<h3 class="anatomy-head">Comparisons from sign()</h3>
<p>
  &ldquo;Is A less than B?&rdquo; is built from <code>sign()</code>,
  which returns &minus;1, 0 or +1:
</p>
<pre class="byte-example"><code>max(<span class="tok-num">0</span>, sign(B - A - <span class="tok-num">0.5</span>))    <span class="tok-comment">/* 1 if A &lt; B, else 0 */</span></code></pre>
<p>
  <code>sign(B&nbsp;&minus;&nbsp;A)</code> is +1 exactly when A is
  below B; <code>max()</code> flattens the other two cases to 0; the
  <code>&minus;&nbsp;0.5</code> keeps the expression away from exact
  ties. The answer is a clean 0 or 1 that can be fed straight into
  more arithmetic. This is the line that computes the carry flag, and
  the screen&rsquo;s 70-per-second retrace signal:
</p>

<SignDemo />

<p>
  A 0-or-1 answer also stands in for &ldquo;if&rdquo; inside a
  formula:
  <code>flag&nbsp;&times;&nbsp;A + (1&nbsp;&minus;&nbsp;flag)&nbsp;&times;&nbsp;B</code>
  picks A or B. The machine even uses it to cancel memory writes: when
  a write shouldn&rsquo;t happen, the same trick turns its target
  address into &minus;1, which no memory cell answers to, and the
  write lands nowhere.
</p>

<h3 class="anatomy-head">The prebaked tables</h3>
<p>
  Some of the functions don&rsquo;t compute anything &mdash; the
  answers were worked out at build time and written into the file.
  <code>calc()</code> can&rsquo;t raise 2 to a variable power, which is
  needed whenever a program shifts by an amount held in a register, so
  <code>--pow2</code> is just the answers:
</p>
<pre class="byte-example"><code>@function <span class="tok-prop">--pow2</span>(<span class="tok-prop">--n</span> &lt;integer&gt;) returns &lt;integer&gt; {'{'}
  result: if(
    style(<span class="tok-prop">--n</span>: <span class="tok-num">0</span>): <span class="tok-num">1</span>;
    style(<span class="tok-prop">--n</span>: <span class="tok-num">1</span>): <span class="tok-num">2</span>;
    style(<span class="tok-prop">--n</span>: <span class="tok-num">2</span>): <span class="tok-num">4</span>;
    style(<span class="tok-prop">--n</span>: <span class="tok-num">3</span>): <span class="tok-num">8</span>;
    <span class="tok-comment">/* … up to 2³¹ … */</span></code></pre>
<p>
  And the 8086&rsquo;s parity flag reports the number of 1-bits in a
  result. Nothing in CSS counts bits, so <code>--parity</code> carries
  the verdict for all 256 possible bytes:
</p>
<pre class="byte-example"><code>@function <span class="tok-prop">--parity</span>(<span class="tok-prop">--val</span> &lt;integer&gt;) returns &lt;integer&gt; {'{'}
  <span class="tok-prop">--low8</span>: --lowerBytes(var(--val), <span class="tok-num">8</span>);
  result: if(
    style(<span class="tok-prop">--low8</span>: <span class="tok-num">0</span>): <span class="tok-num">4</span>;
    style(<span class="tok-prop">--low8</span>: <span class="tok-num">1</span>): <span class="tok-num">0</span>;
    style(<span class="tok-prop">--low8</span>: <span class="tok-num">2</span>): <span class="tok-num">0</span>;
    style(<span class="tok-prop">--low8</span>: <span class="tok-num">3</span>): <span class="tok-num">4</span>;
    <span class="tok-comment">/* … all 256 byte values … */</span></code></pre>
<p>
  The answers are 0 and 4 rather than 0 and 1. The parity flag sits at
  bit 2 of the flags register &mdash; worth 4 &mdash; so the table
  stores every answer already moved to its position, saving a shift on
  every arithmetic instruction.
</p>

<h3 class="anatomy-head">What else is in the box</h3>
<p>
  The rest of the 66 sort into three rough families: byte plumbing,
  which splits and splices the two-bytes-per-cell memory
  (<code>--extractByte</code>, <code>--spliceByte</code>,
  <code>--applySlot</code> &mdash; the write-formulas story shows the
  last one at work); instruction decoding, which picks apart x86
  operand bytes (<code>--getReg16</code>, <code>--modrmLen</code>);
  and thirty-six flag calculators
  (<code>--addFlags16</code>, <code>--shrFlags8</code>, &hellip;),
  which the CPU story comes back to.
</p>
