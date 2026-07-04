<script>
  // Memory — read formulas: one colossal function, three kinds of
  // arm, each with its own section. All arms and counts measured
  // from sokoban.css (736,510 RAM + 6,924 ROM + 512 window + 2
  // keyboard = 743,948).
  import FetchLadder from '../FetchLadder.svelte';
  import Term from '../Term.svelte';
</script>

<p>
  Reading sounds like the easy half &mdash; nothing changes, you just
  look at a value. It isn&rsquo;t. Every memory cell is its own
  variable; an address is just a number; and CSS gives no way to get
  from the number to the variable. The very first thing a CPU does
  every <Term t="tick">tick</Term> &mdash; fetch the byte its instruction pointer points at
  &mdash; is already impossible to write directly.
</p>
<p>
  The machine&rsquo;s answer is <code>--readMem</code>: <b>one single
  function</b> with one arm for every address it could ever be asked
  about &mdash; 743,948 of them. Not a table, not a list of functions:
  one <code>if()</code>, forty-four million characters long, that
  simply asks &ldquo;is it address 0? is it address 1? is it
  address&nbsp;2?&rdquo; until it hits yours.
</p>

<FetchLadder />

<p>
  Three different kinds of thing live inside that one function, and you
  can see all three in the tower above.
</p>

<h3 class="anatomy-head">The RAM arms &mdash; 736,510 of them</h3>
<p>
  The overwhelming bulk. Memory cells hold two bytes each, so every
  cell gets a pair of arms: the even address extracts the low byte
  (<code>mod(&hellip;, 256)</code>), the odd address the high byte
  (divide by 256, round down). These arms read the live machine &mdash;
  whatever a program has written is what comes back.
</p>
<p>
  Two arms hiding in the middle of the RAM range aren&rsquo;t memory at
  all: addresses 1280 and 1281 are wired straight to the live keyboard
  value. When the BIOS keyboard service reads those addresses, it gets
  real keypresses through the same function as everything else.
</p>

<h3 class="anatomy-head">The BIOS ROM arms &mdash; 6,924</h3>
<p>
  The BIOS is read-only, so its bytes don&rsquo;t need cells &mdash;
  each one is baked in as a literal constant:
  <code>style(--at: 983040): 235;</code>. Bytes that are zero are
  omitted entirely (the <code>else: 0</code> at the bottom of the
  function answers for them), which is why a 64&nbsp;KB ROM region
  needs only 6,924 arms.
</p>

<h3 class="anatomy-head">The disk window &mdash; 512, at the very end</h3>
<p>
  The last 512 arms are the strangest. They don&rsquo;t hold anything:
  each one computes &ldquo;requested sector &times; 512 + my
  offset&rdquo; &mdash; the sector number itself read out of a memory
  cell &mdash; and passes the question through to the disk function.
  Those 512 addresses are a <i>view</i> onto whichever sector was last
  asked for. The <a href="#about/file/disk">disk section</a> picks it
  up from there.
</p>
<p>
  736,510 + 6,924 + 512 + 2 = 743,948. Then <code>else: 0);</code>,
  and the function ends.
</p>
