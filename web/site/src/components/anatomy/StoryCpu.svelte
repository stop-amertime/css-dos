<script>
  // The CPU — dispatch tables, one instruction end to end, then the
  // advanced material behind folds. Copy recycled from the retired
  // How-it-works pages 3–4; facts from CABINET-ANATOMY.md §2–§6.
  import Foldable from '../Foldable.svelte';
</script>

<p>
  All the thinking in the machine happens here, in about
  <b>320&nbsp;KB &mdash; one tenth of one percent of the file.</b>
</p>
<p>
  On a real PC this part comes for free. A program is machine code: a
  long list of numbers sitting in memory, each one an instruction
  &mdash; 184,&nbsp;5,&nbsp;0 means &ldquo;put the number 5 into
  AX&rdquo;. The CPU is a chip that loops forever: read the number at
  the address IP points to, do what it says, move IP along. AX and IP
  are registers &mdash; fourteen values the CPU keeps close to hand
  &mdash; and all of it, the registers, the pointer, the reading
  itself, is wiring. Nobody writes code to make a CPU fetch; it fetches
  because that&rsquo;s what the silicon does.
</p>
<p>
  We get none of that. Every register is a variable &mdash;
  <code>--AX</code>, <code>--BX</code>, <code>--IP</code>&hellip; and
  even &ldquo;which instruction are we on&rdquo; is a variable. The
  cabinet literally contains the line:
</p>
<pre class="byte-example"><code><span class="tok-prop">--opcode</span>: var(<span class="tok-prop">--q0</span>);   <span class="tok-comment">/* --q0: the byte of memory that IP points at */</span></code></pre>
<div class="callout">
  <span class="callout-label">NOTE</span>
  <p>
    Code here is real cabinet code, structurally exact &mdash; only the
    variable names are tidied for reading: <code>--__1IP</code> becomes
    <code>--snapshot-IP</code>.
  </p>
</div>
<p>
  Something has to <i>do</i> the instruction. On the 8086, every
  instruction is a little circuit etched into silicon. Here, every
  register gets a table: one switch on the opcode, with an arm for each
  instruction that can touch it.
</p>
<pre class="byte-example"><code><span class="tok-prop">--AX</span>: if(
  style(<span class="tok-prop">--_irqActive</span>: <span class="tok-num">1</span>): var(<span class="tok-prop">--snapshot-AX</span>);  <span class="tok-comment">/* interrupt pending — hardware outranks the program this tick */</span>
  else: if(
    style(<span class="tok-prop">--opcode</span>: <span class="tok-num">0</span>): &hellip;;    <span class="tok-comment">/* ADD, one flavour */</span>
    style(<span class="tok-prop">--opcode</span>: <span class="tok-num">1</span>): &hellip;;    <span class="tok-comment">/* ADD, another */</span>
    &hellip;                     <span class="tok-comment">/* every opcode that can touch AX */</span>
    else: var(<span class="tok-prop">--snapshot-AX</span>)));   <span class="tok-comment">/* untouched: keep the old value */</span></code></pre>
<p>
  Fourteen of these tables &mdash; one per register. Evaluating all of
  them, once, is the machine executing one instruction. (The arm
  standing in front of the switch is how a keypress or a timer tick
  cuts in <i>between</i> instructions: when an interrupt is pending,
  every register takes its interrupt value instead of the decoded one.)
</p>

<h3 class="anatomy-head">One instruction, all the way through</h3>
<p>
  Take the instruction everybody knows: ADD. Opcode 5 is &ldquo;add a
  number to AX&rdquo;. When the snapshot says <code>--opcode: 5</code>,
  this arm fires in the AX table:
</p>
<pre class="byte-example"><code>style(<span class="tok-prop">--opcode</span>: <span class="tok-num">5</span>): --lowerBytes(calc(var(<span class="tok-prop">--snapshot-AX</span>) + var(<span class="tok-prop">--imm16</span>)), <span class="tok-num">16</span>);   <span class="tok-comment">/* ADD AX, imm16 */</span></code></pre>
<p>
  New AX = old AX plus the number that followed the opcode in memory
  (<code>--imm16</code>), trimmed back to 16 bits because registers
  wrap. Meanwhile this arm fires in the IP table:
</p>
<pre class="byte-example"><code>style(<span class="tok-prop">--opcode</span>: <span class="tok-num">5</span>): calc(var(<span class="tok-prop">--snapshot-IP</span>) + <span class="tok-num">3</span>);   <span class="tok-comment">/* ADD is three bytes long */</span></code></pre>
<p>
  &mdash; stepping the machine past the instruction. A jump&rsquo;s IP
  arm computes a destination instead; jumping backwards is how loops
  happen. Next tick, the fetch reads from the new IP, and the whole
  thing repeats.
</p>

<Foldable>
  {#snippet summary()}The flags &mdash; what real silicon reports for free{/snippet}
  <p>
    A real ADD circuit also reports on itself, as side effects of the
    silicon: did the sum overflow? hit zero? go negative? These reports
    are the <b>flags</b>, and programs check them constantly &mdash;
    every &ldquo;if&rdquo; in every program ends up as a flag check. We
    get no side effects, so the flags table has its own arm for opcode
    5, and it calls this &mdash; the machine&rsquo;s real 16-bit ADD
    flag function, in full:
  </p>
  <pre class="byte-example"><code>@function <span class="tok-prop">--addFlags16</span>(<span class="tok-prop">--dst</span> &lt;integer&gt;, <span class="tok-prop">--src</span> &lt;integer&gt;) returns &lt;integer&gt; {'{'}
  <span class="tok-prop">--raw</span>: calc(var(--dst) + var(--src));
  <span class="tok-prop">--res</span>: --lowerBytes(var(--raw), <span class="tok-num">16</span>);
  <span class="tok-prop">--cf</span>: min(<span class="tok-num">1</span>, round(down, var(--raw) / <span class="tok-num">65536</span>));
  <span class="tok-prop">--pf</span>: --parity(var(--res));
  <span class="tok-prop">--zfsf</span>: calc(if(style(--res: <span class="tok-num">0</span>): <span class="tok-num">64</span>; else: <span class="tok-num">0</span>) + --bit(var(--res), <span class="tok-num">15</span>) * <span class="tok-num">128</span>);
  <span class="tok-prop">--of</span>: --addOF16(var(--dst), var(--src), var(--res));
  result: calc(var(--cf) + var(--pf)
    + calc(round(down, max(<span class="tok-num">0</span>, sign(mod(var(--dst), <span class="tok-num">16</span>)
        + mod(var(--src), <span class="tok-num">16</span>) - <span class="tok-num">15.5</span>)) + <span class="tok-num">0.5</span>) * <span class="tok-num">16</span>)
    + var(--zfsf) + var(--of) + <span class="tok-num">2</span>);
{'}'}</code></pre>
  <p>
    Reading it out: <code>--cf</code> asks &ldquo;did the true sum pass
    65,535?&rdquo; &mdash; divide by 65,536, round down, and you have
    the <b>carry flag</b> as a 1 or a 0. <code>--zfsf</code> asks
    &ldquo;is the result zero?&rdquo; and &ldquo;is its top bit
    set?&rdquo; (a 16-bit number&rsquo;s way of being negative) &mdash;
    the <b>zero</b> and <b>sign</b> flags, each parked at its own bit
    position. <code>--pf</code>, the <b>parity flag</b>, wants the
    number of 1-bits in the result &mdash; nobody counts bits in CSS,
    so the answer comes from a 256-entry table baked into the file. The
    long line in the middle is the <b>half-carry</b> flag: &ldquo;did
    the bottom four bits overflow?&rdquo;, built out of
    <code>sign()</code> because CSS has no <code>&lt;</code>. And the
    <code>+ 2</code> at the end is a bit the 8086 keeps permanently
    switched on.
  </p>
  <p>
    So one ADD is the sum, the new IP, six flags, and a lookup table.
    ADD is among the <i>easiest</i> instructions.
  </p>
</Foldable>

<Foldable>
  {#snippet summary()}The less reasonable instructions{/snippet}
  <p>
    DIV divides a 32-bit number &mdash; held across two registers, DX
    and AX &mdash; producing a quotient and a remainder at once. Two
    tables catch its output:
  </p>
  <pre class="byte-example"><code><span class="tok-comment">/* AX takes the quotient */</span>
round(down, calc((var(<span class="tok-prop">--snapshot-DX</span>) * <span class="tok-num">65536</span> + var(<span class="tok-prop">--snapshot-AX</span>)) / max(<span class="tok-num">1</span>, var(<span class="tok-prop">--rmVal16</span>))))
<span class="tok-comment">/* DX takes the remainder */</span>
mod(calc(var(<span class="tok-prop">--snapshot-DX</span>) * <span class="tok-num">65536</span> + var(<span class="tok-prop">--snapshot-AX</span>)), max(<span class="tok-num">1</span>, var(<span class="tok-prop">--rmVal16</span>)))</code></pre>
  <p>
    The <code>max(1, &hellip;)</code> is there because a program can
    ask to divide by zero, and the formula has to stay legal CSS when
    it does.
  </p>
  <p>
    And the instruction set doesn&rsquo;t stop at the reasonable ones.
    This is DAA, &ldquo;decimal adjust AL&rdquo; &mdash; a
    calculator-era relic that patches up sums done on numbers stored as
    decimal digits. DOS-era programs really use it, so:
  </p>
  <pre class="byte-example"><code>style(<span class="tok-prop">--opcode</span>: <span class="tok-num">39</span>): calc(round(down, var(<span class="tok-prop">--snapshot-AX</span>) / <span class="tok-num">256</span>) * <span class="tok-num">256</span>
  + mod(calc(var(--AL)
  + calc(min(<span class="tok-num">1</span>, calc(round(down, mod(var(--AL), <span class="tok-num">16</span>) / <span class="tok-num">10</span>)
  + mod(round(down, var(<span class="tok-prop">--snapshot-flags</span>) / <span class="tok-num">16</span>), <span class="tok-num">2</span>))) * <span class="tok-num">6</span>)
  + calc(min(<span class="tok-num">1</span>, calc(round(down, var(--AL) / <span class="tok-num">154</span>)
  + mod(var(<span class="tok-prop">--snapshot-flags</span>), <span class="tok-num">2</span>))) * <span class="tok-num">96</span>)), <span class="tok-num">256</span>))</code></pre>
  <p>
    Nobody said it was pretty. It goes on like this for <b>232 distinct
    opcodes &mdash; 1,094 arms</b> across the register tables.
  </p>
</Foldable>

<Foldable>
  {#snippet summary()}Loops: instructions that rewind themselves{/snippet}
  <p>
    One instruction, one tick &mdash; but some 8086 instructions are
    supposed to repeat. <code>REP MOVSB</code> copies CX bytes in one
    go, and memory copies use it constantly. We can&rsquo;t run a loop
    inside a single tick, because a tick is defined as exactly one
    instruction.
  </p>
  <p>
    The fix: the instruction copies <b>one</b> byte, decrements CX, and
    &mdash; if CX is still above zero &mdash; computes its <i>next</i>
    instruction pointer to point back at itself. Next tick, the CPU
    fetches the very same <code>REP MOVSB</code> again, copies the next
    byte, and so on until CX reaches zero and IP finally moves past it.
    From the outside it looks like one instruction copying a whole
    block; underneath it&rsquo;s the same instruction re-run N times by
    the clock.
  </p>
</Foldable>

<Foldable>
  {#snippet summary()}Not just the CPU{/snippet}
  <p>
    A PC was never one chip, and programs talk to the rest of the
    machine directly: they program a <b>timer chip</b> to interrupt
    them 18.2 times a second, tell the <b>interrupt controller</b>
    which events to let through, stream colours into the <b>VGA
    palette</b>. Each of those chips is simulated the same way the
    registers are &mdash; a few more variables, with tables describing
    what the silicon would have done:
  </p>
  <pre class="byte-example"><code><span class="tok-prop">--AX --CX --DX --BX --SP --BP --SI --DI</span>   <span class="tok-comment">/* the registers &hellip; */</span>
<span class="tok-prop">--CS --DS --ES --SS --IP --flags</span>          <span class="tok-comment">/* &hellip; all fourteen */</span>
<span class="tok-prop">--picMask --picPending --picInService</span>     <span class="tok-comment">/* interrupt controller */</span>
<span class="tok-prop">--pitMode --pitReload --pitCounter</span> &hellip;      <span class="tok-comment">/* timer chip */</span>
<span class="tok-prop">--prevKeyboard --kbdScancodeLatch</span>         <span class="tok-comment">/* keyboard */</span>
<span class="tok-prop">--dacWriteIndex --dacSubIndex</span> &hellip;           <span class="tok-comment">/* VGA palette chip */</span></code></pre>
</Foldable>
