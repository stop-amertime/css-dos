<script>
  // Memory — write formulas: the 171 MB write rules, the biggest
  // thing in the file. Main flow rewritten 2026-07-04 to the
  // ABOUT-SCRIPT.md register (the owner's canonical x = y example);
  // facts from CABINET-ANATOMY.md §6, §13. The assembled-cell
  // extract mirrors kiln/emit-css.mjs (slot cascade, slot 0
  // outermost; names tidied per the CPU section's NOTE).
  import Foldable from '../Foldable.svelte';
  import RamWrite from '../RamWrite.svelte';
  import Term from '../Term.svelte';
</script>

<p>
  The single biggest section of the file, and the reason for most of
  its size. It exists because of the difference between CSS and every
  other language.
</p>
<p>
  Normal programming languages are a list of instructions, run in
  order &mdash; a recipe. They assign: <code>x&nbsp;=&nbsp;y</code>,
  and x changes. A stylesheet has no order: every rule in it is in
  force the whole time, more like a blueprint than a recipe. There is
  no moment at which x <i>becomes</i> y &mdash; you can only declare,
  once, what x <i>is</i>:
</p>
<pre class="byte-example"><code><span class="tok-prop">--x</span>: <span class="tok-num">5</span>;</code></pre>
<p>
  So the definition itself has to do the work: each byte of memory is
  written as a formula that works out, every <Term t="tick">tick</Term>, what its value now
  is &mdash; closer to how a spreadsheet cell works than to a line of
  code. The formula asks one question &mdash; did this tick&rsquo;s
  instruction write to <i>my</i> address? Three <b>write slots</b>
  carry the answer: small variables holding the addresses and values
  of whatever the current instruction writes.
</p>

<RamWrite />

<p>
  Naturally, this means every byte has to re-check its formula every
  single tick, whether it was written or not. In a normal programming
  language, <code>x&nbsp;=&nbsp;y</code> changes x and touches nothing
  else. Here, an instruction that writes one byte &mdash; or no bytes
  at all &mdash; still makes all 650,000 write formulas ask their
  question again. This is massively inefficient.
</p>
<p class="punchline">
  More than half the file (171&nbsp;MB) is this single formula, written
  out once per memory cell.
</p>

<h3 class="anatomy-head">How a write actually lands</h3>
<p>
  Cells hold two bytes each, so &ldquo;write this byte here&rdquo;
  means <i>splicing</i> a value into half of a cell without disturbing
  the other half. One function does it, and every cell&rsquo;s formula
  calls it once per write slot &mdash; verbatim:
</p>
<pre class="byte-example"><code>@function <span class="tok-prop">--applySlot</span>(<span class="tok-prop">--cell</span>, <span class="tok-prop">--live</span>, <span class="tok-prop">--loOff</span>, <span class="tok-prop">--hiOff</span>, <span class="tok-prop">--val</span>, <span class="tok-prop">--width</span>) returns &lt;integer&gt; {'{'}
  result: if(
    style(<span class="tok-prop">--live</span>: <span class="tok-num">0</span>): var(--cell);                <span class="tok-comment">/* slot idle — pass through */</span>
    style(<span class="tok-prop">--width</span>: <span class="tok-num">2</span>) and style(<span class="tok-prop">--loOff</span>: <span class="tok-num">0</span>) and style(<span class="tok-prop">--hiOff</span>: <span class="tok-num">1</span>):
      --lowerBytes(var(--val), <span class="tok-num">16</span>);              <span class="tok-comment">/* whole word, aligned */</span>
    style(<span class="tok-prop">--width</span>: <span class="tok-num">2</span>) and style(<span class="tok-prop">--loOff</span>: <span class="tok-num">1</span>):
      calc(--lowerBytes(var(--val), <span class="tok-num">8</span>) * <span class="tok-num">256</span> + mod(var(--cell), <span class="tok-num">256</span>));   <span class="tok-comment">/* word straddles me: low half */</span>
    style(<span class="tok-prop">--width</span>: <span class="tok-num">2</span>) and style(<span class="tok-prop">--hiOff</span>: <span class="tok-num">0</span>):
      calc(round(down, var(--cell) / <span class="tok-num">256</span>) * <span class="tok-num">256</span> + --rightShift(var(--val), <span class="tok-num">8</span>));   <span class="tok-comment">/* word straddles me: high half */</span>
    style(<span class="tok-prop">--loOff</span>: <span class="tok-num">0</span>): calc(round(down, var(--cell) / <span class="tok-num">256</span>) * <span class="tok-num">256</span> + var(--val));   <span class="tok-comment">/* one byte, low */</span>
    style(<span class="tok-prop">--loOff</span>: <span class="tok-num">1</span>): calc(var(--val) * <span class="tok-num">256</span> + mod(var(--cell), <span class="tok-num">256</span>));            <span class="tok-comment">/* one byte, high */</span>
  else: var(--cell));
{'}'}</code></pre>
<p>
  The middle two cases are the awkward one: a 16-bit write to an odd
  address lands half in one cell and half in the next, so <i>both</i>
  cells fire, each splicing in its own half. And in every cell&rsquo;s
  formula the three slot calls are nested with slot 0 outermost, so if
  two slots ever hit the same cell, slot 0 wins.
</p>
<p>
  Assembled, this is one cell of the machine &mdash; verbatim, names
  tidied as usual, the middle slot elided:
</p>
<pre class="byte-example"><code><span class="tok-prop">--mc5000</span>: --applySlot(--applySlot(--applySlot(var(<span class="tok-prop">--snapshot-mc5000</span>),
      var(<span class="tok-prop">--_slot2Live</span>), calc(var(<span class="tok-prop">--memAddr2</span>) - <span class="tok-num">5000</span> * <span class="tok-num">2</span>),
      calc(var(<span class="tok-prop">--memAddr2</span>) + <span class="tok-num">1</span> - <span class="tok-num">5000</span> * <span class="tok-num">2</span>), var(<span class="tok-prop">--memVal2</span>), var(<span class="tok-prop">--_writeWidth</span>)),
    <span class="tok-comment">/* &hellip; slot 1, the same shape &hellip; */</span>),
  var(<span class="tok-prop">--_slot0Live</span>), calc(var(<span class="tok-prop">--memAddr0</span>) - <span class="tok-num">5000</span> * <span class="tok-num">2</span>),
  calc(var(<span class="tok-prop">--memAddr0</span>) + <span class="tok-num">1</span> - <span class="tok-num">5000</span> * <span class="tok-num">2</span>), var(<span class="tok-prop">--memVal0</span>), var(<span class="tok-prop">--_writeWidth</span>));</code></pre>
<p>
  This line, once per cell &mdash; 368,256 times, each with its own
  address baked into the arithmetic &mdash; is the 171&nbsp;MB.
</p>
<p>
  Why stop at two bytes per cell, when four would halve everything
  again? Arithmetic: four packed bytes can reach past four billion,
  beyond what the 32-bit signed integers all this maths must survive
  in can hold. Two bytes tops out at 65,535 and is always safe.
</p>

<Foldable>
  {#snippet summary()}Why exactly three write slots{/snippet}
  <p>
    The worst case is a hardware interrupt or an <code>INT</code>
    instruction, which pushes three 16-bit words onto the stack in a
    single tick &mdash; the flags, the code segment, and the return
    address. Everything else needs fewer, so three slots cover the
    whole instruction set.
  </p>
  <p>
    Each slot also carries a <b>live gate</b> &mdash; a 0/1 saying
    whether it fires this tick. Most instructions don&rsquo;t write
    memory at all, and the gate lets all 650,000 write formulas
    short-circuit at once: &ldquo;no slot is live, nothing changes&rdquo;
    &mdash; without checking a million addresses one by one.
  </p>
</Foldable>
