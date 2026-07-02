<script>
  // TickPage — Learn sub-page "One tick". The consistency problem
  // (formulas reading cells that are mid-update), the double buffer,
  // the four clock beats, and what fetch/decode/execute actually do.
  import '../styles/_fragments/anatomy.css';
  import TickClock from './TickClock.svelte';
</script>

<div class="subpage" data-subpage="8">
  <h1>One tick, up close</h1>
  <p>
    &ldquo;Every formula re-evaluates, once per tick&rdquo; leaves a
    puzzle. Formulas read other cells. If byte B&rsquo;s formula reads
    byte A while A is itself being recomputed, does it see the old
    value or the new one? A machine where the answer is &ldquo;whichever
    the browser got to first&rdquo; computes garbage.
  </p>
  <p>
    Real CPUs have exactly this problem, and the cabinet borrows their
    solution: keep <b>two copies of everything</b>, and split each tick
    into phases. Formulas are only ever allowed to read the
    <b>frozen copy</b> &mdash; last tick&rsquo;s finished state. All the
    new values are computed from that snapshot, then swapped in
    together:
  </p>

  <TickClock />

  <p>
    Beat 1 &mdash; <b>compute</b> &mdash; is where the instruction
    actually happens. Unpacked, it is three steps:
  </p>
  <ol class="tick-walk">
    <li>
      <b>Fetch.</b> Read the next 8 bytes of frozen memory at the
      address the instruction pointer names. (The longest instruction
      fits in 8.)
    </li>
    <li>
      <b>Decode.</b> Work out what those bytes mean: split out the
      opcode, which registers it names, and what memory address it
      refers to.
      <svg class="byte-strip" viewBox="0 0 340 58" role="img"
           aria-label="An 8086 instruction: optional prefix, opcode, ModR/M, optional displacement and immediate bytes.">
        <rect x="2" y="4" width="52" height="30" fill="var(--edit-white)"
              stroke="var(--edit-black)" stroke-dasharray="3 3"/>
        <rect x="56" y="4" width="56" height="30" fill="var(--edit-yellow)"
              stroke="var(--edit-black)"/>
        <rect x="114" y="4" width="58" height="30" fill="var(--edit-white)"
              stroke="var(--edit-black)"/>
        <rect x="174" y="4" width="76" height="30" fill="var(--edit-white)"
              stroke="var(--edit-black)" stroke-dasharray="3 3"/>
        <rect x="252" y="4" width="76" height="30" fill="var(--edit-white)"
              stroke="var(--edit-black)" stroke-dasharray="3 3"/>
        <text x="28" y="23" text-anchor="middle" font-size="11" font-family="inherit" fill="#555">prefix?</text>
        <text x="84" y="23" text-anchor="middle" font-size="11" font-family="inherit" font-weight="bold" fill="var(--edit-black)">opcode</text>
        <text x="143" y="23" text-anchor="middle" font-size="11" font-family="inherit" fill="var(--edit-black)">ModR/M</text>
        <text x="212" y="23" text-anchor="middle" font-size="11" font-family="inherit" fill="#555">address?</text>
        <text x="290" y="23" text-anchor="middle" font-size="11" font-family="inherit" fill="#555">value?</text>
        <text x="2" y="52" font-size="11" font-family="inherit" fill="#555">one instruction &mdash; dashed parts optional</text>
      </svg>
    </li>
    <li>
      <b>Execute.</b> All fourteen register formulas pick an arm for
      this opcode. If the instruction writes memory, the machine
      publishes up to three writes &mdash; each an address and a value
      &mdash; through its three <b>write slots</b>.
    </li>
  </ol>

  <p>
    Why exactly three slots? The worst case an instruction can do is
    push three 16-bit values onto the stack at once (an interrupt
    saves the flags, the code segment, and the return address).
    Nothing needs more.
  </p>
  <p>
    The slots also carry the file&rsquo;s most important performance
    trick. Each has a <b>live gate</b> &mdash; a 0-or-1 saying whether
    it fires this tick. Most instructions never touch memory, and when
    no slot is live, all 171&nbsp;MB of write rules collapse to
    &ldquo;keep your old value&rdquo; without checking a single
    address.
  </p>
  <p>
    One more thing rides the clock: <b>interrupts</b>. The keyboard and
    the timer must be able to cut in <i>between</i> instructions
    &mdash; that&rsquo;s how a running game notices a keypress at all.
    In front of every register&rsquo;s opcode switch sit override arms:
    when an interrupt is pending, the register takes its interrupt
    value instead of the decoded one. For that one tick, the hardware
    outranks the program.
  </p>
</div>
