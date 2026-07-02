<script>
  // AnatomyPage — Learn sub-page "Inside the file". The cabinet's
  // sections in file order, to scale, with the punchline that the CPU
  // is 0.1% of the file. Sizes from a real Sokoban build
  // (CABINET-ANATOMY.md).
  import '../styles/_fragments/anatomy.css';
  import FileMap from './FileMap.svelte';
</script>

<div class="subpage" data-subpage="7">
  <h1>Inside the file</h1>
  <p>
    The Build step will hand you one <code>.css</code> file. Here is
    everything inside Sokoban&rsquo;s &mdash; all 309&nbsp;MB of it,
    drawn to scale:
  </p>

  <FileMap />

  <p>
    The part that computes barely registers. <b>The CPU is about
    300&nbsp;KB &mdash; one tenth of one percent of the file.</b>
    Everything else is memory, written out longhand: a few short rules
    for every byte of RAM and every byte of the disk, repeated hundreds
    of thousands of times.
  </p>

  <h3 class="anatomy-head">The sliver that computes</h3>
  <p>The machine itself sits at the top of the file:</p>
  <ul class="anatomy-list">
    <li>
      <b>Utility functions</b> <span class="sz">(15 KB)</span> &mdash;
      the bit-math CSS doesn&rsquo;t have (AND, OR, shifts), rebuilt
      from plain arithmetic. How that works is on the Tricks page.
    </li>
    <li>
      <b>Instruction decode</b> <span class="sz">(48 KB)</span> &mdash;
      how to read an 8086 instruction from raw bytes: how long it is,
      which registers it names, what memory address it points at.
    </li>
    <li>
      <b>The dispatch tables</b> <span class="sz">(225 KB)</span> &mdash;
      the CPU proper. For each of the 8086&rsquo;s fourteen registers,
      one big conditional answering: <i>given this opcode, what is your
      next value?</i>
    </li>
  </ul>

  <pre class="byte-example"><code><span class="tok-prop">--AX</span>: if(
  style(<span class="tok-prop">--opcode</span>: <span class="tok-num">5</span>):   &hellip;;  <span class="tok-comment">/* ADD AX, &hellip; */</span>
  style(<span class="tok-prop">--opcode</span>: <span class="tok-num">45</span>):  &hellip;;  <span class="tok-comment">/* SUB AX, &hellip; */</span>
  style(<span class="tok-prop">--opcode</span>: <span class="tok-num">184</span>): &hellip;;  <span class="tok-comment">/* MOV AX, &hellip; */</span>
  <span class="tok-comment">/* &hellip; one arm per opcode that can touch AX &hellip; */</span>
  else: <span class="tok-prop">var</span>(<span class="tok-prop">--AX-prev</span>)   <span class="tok-comment">/* unchanged */</span>
);</code></pre>

  <p>
    You met a working miniature of this on &ldquo;How it
    computes&rdquo;. The real thing just has more arms &mdash; one for
    every opcode, times fourteen registers. Evaluating them all, once,
    <i>is</i> executing an instruction.
  </p>

  <h3 class="anatomy-head">The ocean</h3>
  <p>
    The rest of the file is memory, and it comes in <b>full sweeps</b>
    &mdash; sections that must mention every single memory cell,
    because CSS gives no way to say &ldquo;and the same for the other
    650,000&rdquo;:
  </p>
  <ul class="anatomy-list">
    <li>
      <b>Declarations</b> <span class="sz">(32 MB)</span> &mdash; CSS
      requires every typed variable to be registered with
      <code>@property</code>. One block per memory cell; its
      <code>initial-value</code> is that byte&rsquo;s power-on
      contents.
    </li>
    <li>
      <b>The memory read function</b> <span class="sz">(44 MB)</span>
      &mdash; CSS has no arrays, so &ldquo;give me the byte at address
      A&rdquo; can only be built one way: a single <code>if()</code>
      with an arm for every address. About a million arms.
    </li>
    <li>
      <b>The floppy disk</b> <span class="sz">(13 MB)</span> &mdash;
      the read-only lookup from the previous page. The one section that
      tracks the game rather than the machine &mdash; a bigger game
      means a bigger disk section, and almost nothing else changes.
    </li>
    <li>
      <b>The write rules</b> <span class="sz">(171 MB)</span> &mdash;
      over half the file. Every cell&rsquo;s formula, asking once per
      tick: <i>did a write land on me?</i>
    </li>
    <li>
      <b>Staging sweeps</b> <span class="sz">(43 MB)</span> &mdash;
      three more passes over all of memory that keep each tick reading
      a clean snapshot. The next page explains both of these.
    </li>
    <li>
      <b>The pixel painter</b> <span class="sz">(6.5 MB)</span> &mdash;
      one rule per screen pixel, from &ldquo;Screen &amp; keys&rdquo;.
    </li>
  </ul>

  <p class="punchline">
    So the file is big for a mundane reason: 640&nbsp;KB of RAM,
    written out four separate times &mdash; declared, readable,
    writable, staged. The computer is the sliver; the ocean is
    plumbing.
  </p>
</div>
