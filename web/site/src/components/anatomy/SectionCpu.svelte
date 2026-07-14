<script>
  // The CPU — the fourteen register tables. Layering rule (owner,
  // 2026-07-03): the main flow assumes the reader roughly knows what
  // a CPU is; primers live in fold-bg dropdowns, deep dives in plain
  // folds. Utility functions split out to SectionUtil. Extracts
  // verbatim from sokoban.css (names tidied per the NOTE callout).
  import Foldable from '../Foldable.svelte';
  import CpuCoverage from './CpuCoverage.svelte';
  import SectionHead from '../SectionHead.svelte';
  import Term from '../Term.svelte';
  import CodeCss from '../CodeCss.svelte';
  import Callout from '../Callout.svelte';

  const AX_TABLE = `--AX: if(
  style(--_irqActive: 1): var(--AX-prev);  /* interrupt pending — hardware outranks the program this tick */
  else: if(
    style(--opcode: 0): …;    /* ADD, one flavour */
    style(--opcode: 1): …;    /* ADD, another */
    …                     /* every opcode that can touch AX */
    else: var(--AX-prev)));   /* untouched: keep the old value */`;

  const ADD_AX = `style(--opcode: 5): --lowerBytes(calc(var(--AX-prev) + var(--imm16)), 16);   /* ADD AX, imm16 */`;

  const ADD_IP = `style(--opcode: 5): calc(var(--IP-prev) + 3);   /* ADD is three bytes long */`;

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

  const JZ_ROW = `style(--opcode: 116): --lowerBytes(calc(var(--IP-prev) + 2
  + --bit(var(--flags-prev), 6) * --u2s1(var(--q1))), 16);   /* JZ — jump if zero */`;

  const JL_COND = `/* JL, "jump if less": taken when the sign flag differs from the
   overflow flag — an XOR, done as a + b − 2ab on two flag bits */
calc(--bit(var(--flags-prev), 7) + --bit(var(--flags-prev), 11)
   - 2 * --bit(var(--flags-prev), 7) * --bit(var(--flags-prev), 11))`;

  const DIV_ROWS = `/* AX takes the quotient */
round(down, calc((var(--DX-prev) * 65536 + var(--AX-prev)) / max(1, var(--rmVal16))))
/* DX takes the remainder */
mod(calc(var(--DX-prev) * 65536 + var(--AX-prev)), max(1, var(--rmVal16)))`;

  const DAA = `style(--opcode: 39): calc(round(down, var(--AX-prev) / 256) * 256
  + mod(calc(var(--AL)
  + calc(min(1, calc(round(down, mod(var(--AL), 16) / 10)
  + mod(round(down, var(--flags-prev) / 16), 2))) * 6)
  + calc(min(1, calc(round(down, var(--AL) / 154)
  + mod(var(--flags-prev), 2))) * 96)), 256))`;

  const TF_DELAY = `--_tf: var(--__1_tfPending);   /* this tick's trap = LAST tick's request */`;

  const REG_VARS = `--AX --CX --DX --BX --SP --BP --SI --DI   /* the registers … */
--CS --DS --ES --SS --IP --flags          /* … all fourteen */`;

  const POWER_ON = `@property --CS { … initial-value: 61440; }   /* 0xF000 — the BIOS ROM */
@property --IP { … initial-value: 0; }`;

  const RAW_FETCH = `--csBase: calc(var(--CS-prev) * 16);
--ipAddr: calc(var(--csBase) + var(--IP-prev));
--raw0: --readMem(var(--ipAddr));
--raw1: --readMem(calc(var(--ipAddr) + 1));
/* … --raw2 through --raw7 … */`;

  const PREFIX_QUEUE = `--isPrefix0: if(
  style(--raw0: 38): 1;   /* the six prefix bytes: */
  style(--raw0: 46): 1;   /* four segment overrides… */
  style(--raw0: 54): 1;
  style(--raw0: 62): 1;
  style(--raw0: 242): 1;  /* …and two REPeat prefixes */
  style(--raw0: 243): 1;
else: 0);
--prefixLen: calc(var(--isPrefix0) + var(--isPrefix1));

--q0: if(style(--prefixLen: 0): var(--raw0); style(--prefixLen: 1): var(--raw1); else: var(--raw2));
--q1: if(style(--prefixLen: 0): var(--raw1); style(--prefixLen: 1): var(--raw2); else: var(--raw3));
/* … through --q5 … */

--opcode: var(--q0);`;

  const MODRM = `--mod: --rightShift(var(--q1), 6);
--reg: --lowerBytes(--rightShift(var(--q1), 3), 3);
--rm:  --lowerBytes(var(--q1), 3);`;

  const IRQ_BRANCH = `--AX: if(
  style(--_irqActive: 1): /* deliver the interrupt */;
  else:                   /* the normal 850-row table */);`;

  const REP_ROW = `/* the IP row for MOVSB (opcode 164) */
style(--opcode: 164): if(
  style(--_repContinue: 1): calc(var(--IP-prev) - var(--prefixLen));
  else: calc(var(--IP-prev) + 1));`;
</script>

<p>
The first question: why is there no ALU in the above list?
<br><br>
</p>

<Foldable class="fold-bg">
  {#snippet summary()}Background: CPUs for dummies{/snippet}
  <ul class="sim-list bracket-list">
      <li>A real processor is a set of tiny electrical circuits set up to do computations when electricity is pulsed through it. Here are the basics you need to know, simplified a little:</li>
      <li><b>Registers</b> are working memory: fourteen slots the CPU uses to keep numbers to hand while it performs operations with them, like a chef's workstation.</li>
      <li>Some registers are general purpose, like ones named AX, BX, CX...</li>
      <li>Other registers have a set purpose, like IP (Instruction Pointer), which we will come back to momentarily. </li>
      <li>Imagine memory (RAM) as a set of boxes on the shelves in front of the chef, each holding a byte (a number from 0 to 255). </li>
      <li>A program is a list of individual instructions, and one instruction is made up of multiple bytes. For example, a MOVE instruction (move a number from one place to another) is three bytes: 184 WHAT WHERE. 184,&nbsp;5,&nbsp;0 means &ldquo;put the number 5 into register AX&rdquo;. (0 means AX, 1 means BX, etc.).</li>
      <li>The number 184 is the <b>opcode</b> for MOVE number to AX. The people making the programs for that CPU just have to know that information.</li>
      <li>The IP register holds <b>which byte</b> in memory the CPU is looking in to find the current instruction. Since a MOVE instruction is 3 bytes long (MOVE NUMBER WHERE), after a MOVE instruction, the CPU circuitry is set up to add 3 to IP to read the next instruction.</li>
      <li><b>The ALU</b> (Arithmetic Logic Unit) is the part of the processor with all the circuits that actually perform the calculations on the registers and memory - circuits that add numbers, divide them, move them around, and every other operation the CPU can do. </li>
    </ul>

  <p><br>
    A full set of the 8086 opcodes can be found <a href="http://www.mlsite.net/8086/">here</a>
    <br>
    If you want to learn more about CPUs in general, <a href="https://cpu.land/">cpu.land is a great resource.</a>
  </p>

</Foldable>

<p>
  We don't have a good way to create an ALU directly, due to aforementioned issues with CSS and sequential programs. A better strategy turns out to be, to flip the usual order of things. We create a variable for each register, let's take --AX as an example. --AX is then set to a formula that has a case for every instruction that could affect --AX, and then actually performs the logical operation inline, updating its own value. If the opcode isn't in that list, the variable just copies its own previous value. 
</p>
<p>
  Evaluating all fourteen registers against the current opcode is how an instruction is executed. 
  </p>
  <img src="assets/cart-before-horse.png" style="display:block;width:50%; margin:auto;margin-bottom:32px"/>
  <p>The opcode is just another variable: the cabinet contains the line <code>--opcode:&nbsp;var(--q0)</code>, where <code>--q0</code> is the byte of memory IP points at, fetched through the monstrous function in the <a href="#about/file/memr">read-formulas section</a>.
</p>
<p>
  Here's a visualisation of the contents of all fourteen registers - with a mark if a register's formula has a row for that opcode:
</p>

<CpuCoverage />


<SectionHead>One instruction, all the way through</SectionHead>
<p>
  The instruction in question is ADD - opcode 5. We&rsquo;ll take a look at everything that needs to update to process this instruction.
</p>
<p>
  Opcode 5 is &ldquo;add a number to AX&rdquo;. When <code>--opcode</code> is 5, this row fires for the AX register:
</p>
<CodeCss code={ADD_AX} />
<p>
  In plain English: New AX = old AX plus the number that followed the opcode in memory, trimmed back to 16 bits because registers wrap.
</p>
<p>
  Meanwhile, the IP property is also recalculating itself based on the opcode. The ADD instruction is 3 bytes long (ADD A B), so we need to add 3 to the IP counter to find the next instruction.
</p>
<CodeCss code={ADD_IP} />
<p>
  If we hit a jump instruction, the IP register uses that to find its destination instead. A backwards jump is how loops happen. Next tick, the fetch reads from the new IP, and the process repeats. It&rsquo;s oddly simple in principle.
</p>
<p>
  We need one more function, though - a real ADD circuit also reports, as side effects of the silicon, whether the sum overflowed, hit zero, or went negative. These reports are the <b>flags</b>, and programs check them constantly - every &ldquo;if&rdquo; in every program ends up as a flag check. The flags function has a row for opcode 5, which calls the machine&rsquo;s real 16-bit ADD flag function:
</p>
<CodeCss code={ADD_FLAGS} />
<Foldable>
  {#snippet summary()}What&rsquo;s inside --addFlags16, flag by flag{/snippet}
  <ul class="sim-list">
    <li><code>--cf</code> - the <b>carry flag</b>: did the true sum exceed 65,535? Dividing by 65,536 and rounding down answers exactly that, as a 1 or a 0.</li>
    <li><code>--zfsf</code> - the <b>zero flag</b> and <b>sign flag</b>: is the result zero, and is its top bit set (a 16-bit number&rsquo;s way of being negative)? Each answer is parked at its own bit position in the flags word.</li>
    <li><code>--pf</code> - the <b>parity flag</b>, read from the 256-entry lookup table in the <a href="#about/file/util">utility-functions section</a>.</li>
    <li>The long line in the middle - the <b>half-carry flag</b>: did the bottom four bits overflow? Built from <code>sign()</code>, because CSS has no <code>&lt;</code>.</li>
    <li>The <code>+ 2</code> at the end - a bit the 8086 keeps permanently switched on.</li>
  </ul>
</Foldable>
<p>
  In total, one ADD is a sum, a new IP, six flags and a table lookup - and ADD is one of the easiest instructions in the set.
</p>

<SectionHead>How branching works</SectionHead>
<p>
  How does an an &ldquo;if&rdquo; happen? With arithmetic, again: <code>--bit()</code> pulls one flag out of the flags register as a 0 or a 1, and the jump multiplies its travel distance by it. This is the real IP row for JZ, &ldquo;jump if zero&rdquo;:
</p>
<CodeCss code={JZ_ROW} />
<p>
  Read the row&rsquo;s arithmetic:
</p>
<ul class="sim-list">
  <li>IP advances by 2 either way, to move past the JZ instruction itself.</li>
  <li>We want to &ldquo;jump if zero&rdquo; - that is, jump only when the zero flag is 1.</li>
  <li>The trick: multiply the jump distance by the zero flag (<code>--bit()</code> extracts it from the flags register as a 1 or a 0). If the flag is 1, IP moves the full distance. If it is 0, the distance is multiplied by zero, and we jump 0 bytes instead.</li>
</ul>
<p>
  Some conditions cost more. &ldquo;Jump if less&rdquo; is taken when the sign flag and the overflow flag disagree - an XOR, which CSS doesn&rsquo;t have. The <a href="#about/file/util">utility section</a> builds XOR out of multiplication, and here it is at work on two flag bits:
</p>
<CodeCss code={JL_COND} />

<Foldable>
  {#snippet summary()}DIV, DAA, and the less reasonable instructions{/snippet}
  <p>
    DIV divides a 32-bit number - held across two registers, DX and AX - producing a quotient and a remainder at once. Two tables catch its output:
  </p>
  <p>
    Now we&rsquo;re cooking. DIV divides a 32-bit number - held across two registers, DX and AX - producing a quotient and a remainder at once. Two tables catch its output:
  </p>
  <CodeCss code={DIV_ROWS} />
  <p>
    The <code>max(1, &hellip;)</code> is there because a program can ask to divide by zero, and the formula has to stay legal CSS when it does.
  </p>
  <p>
    This is DAA, &ldquo;decimal adjust AL&rdquo; - a calculator-era relic that patches up sums done on numbers stored as decimal digits. DOS-era programs really use it, so:
  </p>
  <CodeCss code={DAA} />
  <p>
    DAA needs to ask &ldquo;is this 4-bit chunk bigger than 9?&rdquo;, and with no <code>&lt;</code> available it asks by dividing: <code>round(down, nibble / 10)</code> is 1 exactly for 10&ndash;15 and 0 otherwise. The whole family of decimal instructions runs on that idiom.
  </p>
  <p>
    It goes on like this for <b>232 distinct opcodes - 850 rows</b> across the register tables.
  </p>
</Foldable>

<Foldable>
  {#snippet summary()}How an interrupt arrives{/snippet}
  <p>
    An <b>interrupt</b> is how hardware gets the CPU&rsquo;s attention: when a key is pressed or the timer fires, the CPU pauses the running program, runs a small handler routine, then resumes where it left off. On a real chip that&rsquo;s wiring. Here, it&rsquo;s one extra branch at the front of every register table:
  </p>
  <CodeCss code={IRQ_BRANCH} />
  <p>
    When <code>--_irqActive</code> is 1, every register takes the first branch - the instruction fetched this tick is decoded but never selected. The interrupt is delivered in its place.
  </p>
  <ul class="sim-list">
    <li><b>IP and CS</b> load the handler&rsquo;s address from a table in memory</li>
    <li><b>SP</b> drops by six, for the three pushed words: the paused instruction&rsquo;s address (where the handler will return to) and the flags</li>
    <li><b>flags</b> clears its interrupt bit, so the handler can&rsquo;t itself be interrupted</li>
    <li><b>cycleCount</b> charges 61 cycles - what the real 8086 billed for a hardware interrupt. (The counter is a register table like the others: each opcode&rsquo;s row adds the cost Intel&rsquo;s manual lists for it. What it&rsquo;s actually <i>for</i> - see the <a href="#about/file/chipset">chipset section</a>.)</li>
  </ul>
  <p>
    Behind that sits a simulated interrupt controller - three variables tracking which interrupts are masked, pending, and currently being serviced, with the timer outranking the keyboard. Clearing the serviced bit - the lowest bit set - uses a classic bit hack: <code>x AND (x &minus; 1)</code> deletes the lowest set bit of a number, no loop required.
  </p>
  <p>
    One timing subtlety is kept faithfully: the 8086&rsquo;s single-step trap fires <i>after</i> the traced instruction, not before. The machine reproduces that with a one-tick delay line - verbatim:
  </p>
  <CodeCss code={TF_DELAY} />
</Foldable>

<SectionHead>Is the variable length of instructions an issue?</SectionHead>
<p>
  Yes. An 8086 instruction is one to six bytes long, and the only way to tell how long is to check, which we can't do. Worse, the first byte might not even be the instruction - it might be a <i>prefix</i>, a modifier e.g. 'use a different memory segment' or 'repeat N times'. We can't use a parsing loop, because we can't use loops.
</p>
<p>
  So, the long way round. Every tick, eight bytes are fetched from where IP points, enough for the worst case scenario: two prefixes plus the longest instruction:
</p>
<CodeCss code={RAW_FETCH} />
<p>
  (That&rsquo;s <i>eight</i> trips through the 743,948-arm read function, every tick, mostly fetching irrelevant bytes that ended up being in the next instruction over.)
</p>
<p>
  Then, prefixes. A real 8086 consumes them one at a time off a queue. We can&rsquo;t make a queue, so we move the <i>labels</i> instead of the bytes. <code>--prefixLen</code> counts how many of the leading bytes are prefixes (there are only six byte values to check), and the queue the rest of the CPU actually reads - <code>--q0</code> to <code>--q5</code> - is a set of aliases, each pointing at the corresponding raw byte:
</p>
<CodeCss code={PREFIX_QUEUE} />
<p>
  Everything downstream can then simply use <code>--q0</code> as the opcode. The IP table is wrapped in <code>+ prefixLen</code> to skip over however many prefixes exist.
</p>
<p>
  The second byte, on most instructions, is a dense operand descriptor - two bits of addressing mode, three bits of register, three of register-or-memory. We pull those bytes out manually, of course:
</p>
<CodeCss code={MODRM} />

<SectionHead>How do errors work?</SectionHead>
<p>
  Nothing in the CSS <i>can</i> crash, because nothing is running. If an opcode is read that isn't in var(--IP)'s huge formula, the fall-through is to stay put - the machine re-fetches the invalid byte repeatedly - while a diagnostic variable (<code>--haltCode</code>) holds the offending value up for scrutiny. We shouldn&rsquo;t hit an invalid opcode; if we do, the system grinds to a halt on purpose to make it easier to investigate. 
</p>

<SectionHead>The cost of so many re-evaluating formulas</SectionHead>
<p>
  Some waste is unavoidable with no sequencing. The current instruction might have no second byte, no immediate, no memory operand, but they are computed anyway: the memory address an operand <i>would</i> use, both operand values, the immediates, the signed reinterpretations that only multiplication cares about - the full product, in fact, of a multiply that almost certainly isn&rsquo;t happening. Around seventy of these standing values are derived each tick, and then the opcode selects the few that mean something; the rest are computed pointlessly and discarded.
</p>
<SectionHead>The cost of running in Chrome</SectionHead>
  <p>
    Although this project is written for &lsquo;spec-compliant CSS&rsquo;, we need to actually <i>test</i> the CSS works. For this, we use Chrome. Therefore, Chrome&rsquo;s foibles shaped the CPU&rsquo;s anatomy: some ways of nesting one <code>@function</code> call inside another work in Chrome, and others fail, in patterns the spec doesn&rsquo;t predict and had to be mapped by experiment.
  </p>
  <p>
    Kiln flattens defensively. Where a register row wants <code>--bit()</code> nested inside something else, the bit gets hoisted out into its own named property - the carry flag exists as a standing per-tick property (<code>--_cf</code>) for exactly this reason. And a hoisted property is paid for every tick, repeatedly, whether this tick&rsquo;s instruction wants a carry flag or not.
  </p>
  <p>
    There&rsquo;s a counter-trick, and it explains some of the ugliest code in Kiln. The maths functions - <code>mod()</code>, <code>round()</code>, <code>min()</code>, <code>calc()</code> - are built into CSS and nest freely; it&rsquo;s only the user-defined <code>@function</code>s that are delicate. So when an expression should only be paid for when its instruction actually runs, Kiln builds it out of nothing but raw arithmetic and buries it inside that opcode&rsquo;s branch, where <code>if()</code> evaluates it lazily. The DAA expression seen elsewhere on this page is written entirely in <code>mod</code> and <code>round</code> so it can live inside opcode 39&rsquo;s row, the one place where only DAA pays for it very occasionally. (And it&rsquo;s pasted out twice - once in AX&rsquo;s table, once in flags&rsquo; - because the fourteen tables evaluate in parallel and cannot share intermediate results.)
  </p>
  <p>
    We can either have elegant DRY code that costs every tick, or scoped ugliness and duplication. Kiln haggles instruction by instruction.
  </p>

<SectionHead>REP - faking hardware micro-loops</SectionHead>
<p>
  x86 has a prefix, REP, that means &ldquo;do this instruction CX times&rdquo; where CX is the value in the CX register. <code>REP MOVSW</code> is the 1981 idiom for copying a block of memory: only one instruction but up to 65,535 iterations. The physical 8086 chip micro-loops in hardware until it&rsquo;s finished.
</p>
<p>
  For us, a tick <i>is</i> one evaluation of every formula in the file. To achieve the same behaviour, the IP row for a repeating string instruction simply doesn&rsquo;t advance:
</p>
<CodeCss code={REP_ROW} />
<p>
  Next tick, the fetch lands on the same instruction, and the entire machine - fourteen register tables, all 368,256 memory formulas - re-evaluates from scratch to copy two more bytes. The CX register counts down by one per tick; on the last iteration <code>--_repContinue</code> hits 0 and IP finally moves on. Copying a 64&nbsp;KB block this way is 32,768 complete evaluations of the 300&nbsp;MB stylesheet, each evaluation moving just <i>two bytes</i>. Sisyphean.
</p>
<p>
  (The subtraction <code>- var(--prefixLen)</code> is slightly amusing. The IP table is wrapped with a <code>+ prefixLen</code> so that every instruction steps over its own prefixes. To stand still, the repeating instruction takes a couple of steps backwards, then a couple of steps forward again.)
</p>

<SectionHead>Power-on</SectionHead>
<p>
  What starts the machine? The clock animation begins ticking when the stylesheet loads, and on the first tick, the fetch simply reads from the byte that CS:IP point to. They are pre-set in the CSS file to point to the BIOS start.
</p>
<Foldable>
  {#snippet summary()}What are CS and IP?{/snippet}
  <p>
    The code is split up into 16-byte &lsquo;segments&rsquo;, and CS (Code Segment) tells you which one to look in. IP (Instruction Pointer) then tells you the position of one specific byte within that. This is like identifying a specific word on a page of text by saying &lsquo;Line 12, Word 5&rsquo;.
  </p>
</Foldable>
<CodeCss code={POWER_ON} />
<p>
  That is linear address 983,040 - the first ROM entry in the <a href="#about/file/memr">read-formulas section</a> - and the byte sitting there is 235: a jump instruction. So the machine&rsquo;s first act is to jump into the BIOS proper, which sets up a stack, fills in the interrupt table, paints its splash screen, and jumps again, into DOS. A cold boot, the same as a real PC does it.
</p>
