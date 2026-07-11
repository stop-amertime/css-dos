<script>
  // The CPU — the fourteen register tables. Layering rule (owner,
  // 2026-07-03): the main flow assumes the reader roughly knows what
  // a CPU is; primers live in fold-bg dropdowns, deep dives in plain
  // folds. Utility functions split out to SectionUtil. Extracts
  // verbatim from sokoban.css (names tidied per the NOTE callout).
  import Foldable from '../Foldable.svelte';
  import CpuCoverage from './CpuCoverage.svelte';
  import Term from '../Term.svelte';
  import CodeCss from '../CodeCss.svelte';
  import Callout from '../Callout.svelte';
  import TreeView from './tree/TreeView.svelte';
  import { CPU_TREE, CPU_TREE_META } from './tree/cpu-tree.js';

  const AX_TABLE = `--AX: if(
  style(--_irqActive: 1): var(--snapshot-AX);  /* interrupt pending — hardware outranks the program this tick */
  else: if(
    style(--opcode: 0): …;    /* ADD, one flavour */
    style(--opcode: 1): …;    /* ADD, another */
    …                     /* every opcode that can touch AX */
    else: var(--snapshot-AX)));   /* untouched: keep the old value */`;

  const ADD_AX = `style(--opcode: 5): --lowerBytes(calc(var(--snapshot-AX) + var(--imm16)), 16);   /* ADD AX, imm16 */`;

  const ADD_IP = `style(--opcode: 5): calc(var(--snapshot-IP) + 3);   /* ADD is three bytes long */`;

  const ADD_FLAGS = `@function --addFlags16(--dst <integer>, --src <integer>) returns <integer> {
  --raw: calc(var(--dst) + var(--src));
  --res: --lowerBytes(var(--raw), 16);
  --cf: min(1, round(down, var(--raw) / 65536));
  --pf: --parity(var(--res));
  --zfsf: calc(if(style(--res: 0): 64; else: 0) + --bit(var(--res), 15) * 128);
  --of: --addOF16(var(--dst), var(--src), var(--res));
  result: calc(var(--cf) + var(--pf)
    + calc(round(down, max(0, sign(mod(var(--dst), 16)
        + mod(var(--src), 16) - 15.5)) + 0.5) * 16)
    + var(--zfsf) + var(--of) + 2);
}`;

  const JZ_ROW = `style(--opcode: 116): --lowerBytes(calc(var(--snapshot-IP) + 2
  + --bit(var(--snapshot-flags), 6) * --u2s1(var(--q1))), 16);   /* JZ — jump if zero */`;

  const JL_COND = `/* JL, "jump if less": taken when the sign flag differs from the
   overflow flag — an XOR, done as a + b − 2ab on two flag bits */
calc(--bit(var(--snapshot-flags), 7) + --bit(var(--snapshot-flags), 11)
   - 2 * --bit(var(--snapshot-flags), 7) * --bit(var(--snapshot-flags), 11))`;

  const DIV_ROWS = `/* AX takes the quotient */
round(down, calc((var(--snapshot-DX) * 65536 + var(--snapshot-AX)) / max(1, var(--rmVal16))))
/* DX takes the remainder */
mod(calc(var(--snapshot-DX) * 65536 + var(--snapshot-AX)), max(1, var(--rmVal16)))`;

  const DAA = `style(--opcode: 39): calc(round(down, var(--snapshot-AX) / 256) * 256
  + mod(calc(var(--AL)
  + calc(min(1, calc(round(down, mod(var(--AL), 16) / 10)
  + mod(round(down, var(--snapshot-flags) / 16), 2))) * 6)
  + calc(min(1, calc(round(down, var(--AL) / 154)
  + mod(var(--snapshot-flags), 2))) * 96)), 256))`;

  const TF_DELAY = `--_tf: var(--__1_tfPending);   /* this tick's trap = LAST tick's request */`;

  const REG_VARS = `--AX --CX --DX --BX --SP --BP --SI --DI   /* the registers … */
--CS --DS --ES --SS --IP --flags          /* … all fourteen */`;

  const POWER_ON = `@property --CS { … initial-value: 61440; }   /* 0xF000 — the BIOS ROM */
@property --IP { … initial-value: 0; }`;
</script>

<TreeView nodes={CPU_TREE} bytes={CPU_TREE_META.bytes} />

<p>
  This section is the fourteen <Term t="register">registers</Term> &mdash; <code>--AX</code>,
  <code>--BX</code>, <code>--IP</code> and the rest &mdash; and the
  tables that define them. It is about 265&nbsp;KB: less than a tenth
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
<CodeCss code={AX_TABLE} />
<Callout kind="info">
  <p>
    Code here is real cabinet code, structurally exact &mdash; only the
    variable names are tidied for reading: <code>--__1IP</code> becomes
    <code>--snapshot-IP</code>.
  </p>
</Callout>
<CodeCss code={REG_VARS} />
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
<CodeCss code={ADD_AX} />
<p>
  New AX = old AX plus the number that followed the opcode in memory,
  trimmed back to 16 bits because registers wrap. The same opcode
  selects a row in the IP table:
</p>
<CodeCss code={ADD_IP} />
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
  own row for opcode 5 and calls the machine&rsquo;s real 16-bit ADD
  flag function &mdash; in full:
</p>
<CodeCss code={ADD_FLAGS} />
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
<p>
  In total, one ADD is a sum, a new IP, six flags and a table lookup
  &mdash; and ADD is one of the easiest instructions in the set.
</p>

<h3 class="anatomy-head">How a program decides anything</h3>
<p>
  Programs branch &mdash; &ldquo;if health is zero, die&rdquo;
  &mdash; and a formula can&rsquo;t branch; it computes one value.
  So a conditional jump is arithmetic too: <code>--bit()</code>
  pulls one flag out of the flags register as a 0 or a 1, and the
  jump multiplies its travel distance by it. This is the real IP
  row for JZ, &ldquo;jump if zero&rdquo;:
</p>
<CodeCss code={JZ_ROW} />
<p>
  Taken, IP moves by the distance byte; not taken, it moves by zero
  times the distance byte. (<code>--u2s1()</code> reads the byte as
  signed, so the distance can be negative.)
</p>
<p>
  Some conditions cost more. &ldquo;Jump if less&rdquo; is taken
  when the sign flag and the overflow flag disagree &mdash; an XOR,
  which CSS doesn&rsquo;t have. The
  <a href="#about/file/util">utility section</a> builds XOR out of
  multiplication, and here it is at work on two flag bits:
</p>
<CodeCss code={JL_COND} />

<Foldable>
  {#snippet summary()}DIV, DAA, and the less reasonable instructions{/snippet}
  <p>
    DIV divides a 32-bit number &mdash; held across two registers, DX
    and AX &mdash; producing a quotient and a remainder at once. Two
    tables catch its output:
  </p>
  <CodeCss code={DIV_ROWS} />
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
  <CodeCss code={DAA} />
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
  <CodeCss code={TF_DELAY} />
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

<h3 class="anatomy-head">Power-on</h3>
<p>
  Nothing starts the machine. The clock animation begins ticking the
  moment the stylesheet loads, and on tick one the fetch simply reads
  from wherever CS:IP already point. The declarations put them there:
</p>
<CodeCss code={POWER_ON} />
<p>
  That is linear address 983,040 &mdash; the first ROM entry in the
  <a href="#about/file/memr">read-formulas section</a> &mdash; and the byte there is 235, a jump
  instruction. The machine&rsquo;s first act is to jump into the BIOS
  proper, which sets up a stack, fills in the interrupt table, paints
  its splash screen, and jumps again, into DOS. Power arrives, the
  processor wakes up pointing at firmware, and everything else follows
  &mdash; a cold boot, the same way a real PC did it.
</p>
