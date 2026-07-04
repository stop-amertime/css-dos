<script>
  // The CPU — the fourteen register tables. Layering rule (owner,
  // 2026-07-03): the main flow assumes the reader roughly knows what
  // a CPU is; primers live in fold-bg dropdowns, deep dives in plain
  // folds. Utility functions split out to SectionUtil. Extracts
  // verbatim from sokoban.css (names tidied per the NOTE callout).
  import Foldable from '../Foldable.svelte';
  import CpuCoverage from './CpuCoverage.svelte';
  import Term from '../Term.svelte';
</script>

<p>
  This section is the fourteen registers &mdash; <code>--AX</code>,
  <code>--BX</code>, <code>--IP</code> and the rest &mdash; and the
  tables that define them. It is about 255&nbsp;KB: less than a tenth
  of a percent of the file does all of the machine&rsquo;s thinking.
</p>

<Foldable class="fold-bg">
  {#snippet summary()}Background: what a CPU does{/snippet}
  <p>
    Memory is a long row of numbered boxes, each holding a number from
    0 to 255. A program is numbers sitting in those boxes, and some of
    the numbers are instructions: the sequence 184,&nbsp;5,&nbsp;0
    means &ldquo;put the number 5 into AX&rdquo;. AX is a
    <b>register</b> &mdash; one of fourteen values the processor keeps
    directly to hand instead of in memory. Another register, IP, holds
    the address of the current instruction.
  </p>
  <p>
    The processor&rsquo;s whole job is a loop: read the number IP
    points at, do what it says, move IP past it, repeat. On a real
    chip that loop is wiring &mdash; nobody writes code to make a CPU
    fetch; it fetches because that&rsquo;s what the silicon does.
    Here there is no silicon, so the loop has to be made of variables.
  </p>
</Foldable>

<p>
  A register changes constantly: ADD puts a sum in AX, MOV loads a
  value into it, POP pulls one off the stack into it. But
  <code>--AX</code> is a CSS variable, and a variable gets exactly one
  definition. So the definition has to cover, in advance, everything
  that could ever happen to the register &mdash; one table, keyed on
  the current <Term t="opcode">opcode</Term>, with a row for every instruction that can touch
  it:
</p>
<pre class="byte-example"><code><span class="tok-prop">--AX</span>: if(
  style(<span class="tok-prop">--_irqActive</span>: <span class="tok-num">1</span>): var(<span class="tok-prop">--snapshot-AX</span>);  <span class="tok-comment">/* interrupt pending — hardware outranks the program this tick */</span>
  else: if(
    style(<span class="tok-prop">--opcode</span>: <span class="tok-num">0</span>): &hellip;;    <span class="tok-comment">/* ADD, one flavour */</span>
    style(<span class="tok-prop">--opcode</span>: <span class="tok-num">1</span>): &hellip;;    <span class="tok-comment">/* ADD, another */</span>
    &hellip;                     <span class="tok-comment">/* every opcode that can touch AX */</span>
    else: var(<span class="tok-prop">--snapshot-AX</span>)));   <span class="tok-comment">/* untouched: keep the old value */</span></code></pre>
<div class="callout">
  <span class="callout-label">NOTE</span>
  <p>
    Code here is real cabinet code, structurally exact &mdash; only the
    variable names are tidied for reading: <code>--__1IP</code> becomes
    <code>--snapshot-IP</code>.
  </p>
</div>
<p>
  Fourteen of these tables, one per register. Evaluating all fourteen
  against the current opcode, once, is how an instruction gets
  executed. The opcode itself is just another variable &mdash; the
  cabinet contains the line
  <code>--opcode:&nbsp;var(--q0)</code>, where <code>--q0</code> is
  the byte of memory IP points at, fetched through the giant function
  in the <a href="#about/file/memr">read-formulas section</a>.
</p>
<p>
  All fourteen tables, drawn as one grid &mdash; a mark where a table
  has a row for an opcode:
</p>

<CpuCoverage />

<p>
  These tables are the same CSS in every cabinet: Doom&rsquo;s CPU and
  Zork&rsquo;s are byte-identical, and everything that differs between
  two cabinets is memory and disk.
</p>

<h3 class="anatomy-head">One instruction, all the way through</h3>
<p>
  Opcode 5 is &ldquo;add a number to AX&rdquo;. When the snapshot says
  <code>--opcode: 5</code>, this row fires in the AX table:
</p>
<pre class="byte-example"><code>style(<span class="tok-prop">--opcode</span>: <span class="tok-num">5</span>): --lowerBytes(calc(var(<span class="tok-prop">--snapshot-AX</span>) + var(<span class="tok-prop">--imm16</span>)), <span class="tok-num">16</span>);   <span class="tok-comment">/* ADD AX, imm16 */</span></code></pre>
<p>
  New AX = old AX plus the number that followed the opcode in memory,
  trimmed back to 16 bits because registers wrap. The same opcode
  selects a row in the IP table:
</p>
<pre class="byte-example"><code>style(<span class="tok-prop">--opcode</span>: <span class="tok-num">5</span>): calc(var(<span class="tok-prop">--snapshot-IP</span>) + <span class="tok-num">3</span>);   <span class="tok-comment">/* ADD is three bytes long */</span></code></pre>
<p>
  &mdash; stepping the machine past the three-byte instruction. A
  jump&rsquo;s IP row computes a destination instead, and a backwards
  jump is how loops happen. Next tick, the fetch reads from the new
  IP.
</p>
<p>
  One more table is involved. A real ADD circuit also reports, as side
  effects of the silicon, whether the sum overflowed, hit zero, or
  went negative. These reports are the <b>flags</b>, and programs
  check them constantly &mdash; every &ldquo;if&rdquo; in every
  program ends up as a flag check &mdash; so the flags table has its
  own row for opcode 5 and computes all six reports by hand. In total, one
  ADD is a sum, a new IP, six flags and a table lookup, and ADD is one
  of the easiest instructions in the set.
</p>

<Foldable>
  {#snippet summary()}The flag function for ADD, in full{/snippet}
  <p>
    The flags table&rsquo;s opcode-5 row calls this &mdash; the
    machine&rsquo;s real 16-bit ADD flag function:
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
    In there: <code>--cf</code> asks &ldquo;did the true sum pass
    65,535?&rdquo; &mdash; divide by 65,536, round down, and that is
    the <b>carry flag</b> as a 1 or a 0. <code>--zfsf</code> asks
    &ldquo;is the result zero?&rdquo; and &ldquo;is its top bit
    set?&rdquo; (a 16-bit number&rsquo;s way of being negative) &mdash;
    the <b>zero</b> and <b>sign</b> flags, each parked at its own bit
    position. <code>--pf</code>, the <b>parity flag</b>, comes from the
    256-entry lookup table in the utility-functions section. The long
    line in the middle is the <b>half-carry</b> flag &mdash; &ldquo;did
    the bottom four bits overflow?&rdquo; &mdash; built out of
    <code>sign()</code> because CSS has no <code>&lt;</code>. And the
    <code>+ 2</code> at the end is a bit the 8086 keeps permanently
    switched on.
  </p>
</Foldable>

<Foldable>
  {#snippet summary()}DIV, DAA, and the less reasonable instructions{/snippet}
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
    DAA needs to ask &ldquo;is this 4-bit chunk bigger than 9?&rdquo;,
    and with no <code>&lt;</code> available it asks by dividing:
    <code>round(down, nibble / 10)</code> is 1 exactly for
    10&ndash;15 and 0 otherwise. The whole family of decimal
    instructions runs on that idiom.
  </p>
  <p>
    It goes on like this for <b>232 distinct opcodes &mdash; 850
    rows</b> across the register tables.
  </p>
</Foldable>

<Foldable>
  {#snippet summary()}How an interrupt arrives{/snippet}
  <p>
    A keypress or a timer tick has to be able to interrupt the running
    program between instructions. On real hardware that&rsquo;s
    wiring; here it&rsquo;s the override standing in front of every
    register table. When an interrupt is pending, the machine
    <b>refuses to run the instruction it just fetched</b> &mdash; no
    register takes its decoded value that tick. Instead: IP and CS
    load the interrupt handler&rsquo;s address out of a table in
    memory, SP drops by six for the three pushed words, and the flags
    register switches interrupts off so the handler can&rsquo;t itself
    be interrupted. The cycle counter even charges 61 cycles &mdash;
    what the real 8086 billed for a hardware interrupt.
  </p>
  <p>
    Behind that sits a simulated interrupt controller &mdash; three
    variables tracking which interrupts are masked, pending, and
    currently being serviced, with the timer outranking the keyboard.
    When a handler finishes, it announces &ldquo;end of
    interrupt&rdquo;, and the controller clears the in-service bit
    with a classic bit hack: <code>x AND (x &minus; 1)</code> deletes
    the lowest set bit of a number, no loop required.
  </p>
  <p>
    One timing subtlety is kept faithfully: the 8086&rsquo;s
    single-step trap fires <i>after</i> the traced instruction, not
    before. The machine reproduces that with a one-tick delay line
    &mdash; verbatim:
  </p>
  <pre class="byte-example"><code><span class="tok-prop">--_tf</span>: var(<span class="tok-prop">--__1_tfPending</span>);   <span class="tok-comment">/* this tick's trap = LAST tick's request */</span></code></pre>
</Foldable>

<Foldable>
  {#snippet summary()}REP &mdash; the instruction that re-runs itself{/snippet}
  <p>
    One instruction, one tick &mdash; but some 8086 instructions are
    supposed to repeat. <code>REP MOVSB</code> copies CX bytes in one
    go, and memory copies use it constantly. A loop can&rsquo;t run
    inside a single tick, because a tick is defined as exactly one
    instruction.
  </p>
  <p>
    The fix: the instruction copies <b>one</b> byte, decrements CX,
    and &mdash; if CX is still above zero &mdash; computes its
    <i>next</i> instruction pointer to point back at itself. Next
    tick, the CPU fetches the very same <code>REP MOVSB</code> again,
    copies the next byte, and so on until CX reaches zero and IP
    finally moves past it. From the outside it looks like one
    instruction copying a whole block; underneath it&rsquo;s the same
    instruction re-run N times by the clock.
  </p>
</Foldable>

<Foldable>
  {#snippet summary()}The other chips: timer, interrupt controller, palette{/snippet}
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

<h3 class="anatomy-head">Power-on</h3>
<p>
  Nothing starts the machine. The clock animation begins ticking the
  moment the stylesheet loads, and on tick one the fetch simply reads
  from wherever CS:IP already point. The declarations put them there:
</p>
<pre class="byte-example"><code>@property <span class="tok-prop">--CS</span> {'{'} &hellip; initial-value: <span class="tok-num">61440</span>; {'}'}   <span class="tok-comment">/* 0xF000 — the BIOS ROM */</span>
@property <span class="tok-prop">--IP</span> {'{'} &hellip; initial-value: <span class="tok-num">0</span>; {'}'}</code></pre>
<p>
  That is linear address 983,040 &mdash; the first ROM entry in the
  <a href="#about/file/memr">read-formulas section</a> &mdash; and the byte there is 235, a jump
  instruction. The machine&rsquo;s first act is to jump into the BIOS
  proper, which sets up a stack, fills in the interrupt table, paints
  its splash screen, and jumps again, into DOS. Power arrives, the
  processor wakes up pointing at firmware, and everything else follows
  &mdash; a cold boot, the same way a real PC did it.
</p>
