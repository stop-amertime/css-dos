<script>
  // Memory — read formulas: one colossal function, three kinds of
  // arm, each with its own section. All arms and counts measured
  // from sokoban.css (736,510 RAM + 6,924 ROM + 512 window + 2
  // keyboard = 743,948).
  import FetchLadder from '../FetchLadder.svelte';
  import SectionHead from '../SectionHead.svelte';
  import Term from '../Term.svelte';
  import CodeCss from '../CodeCss.svelte';

  const KBD_ARMS = `style(--at: 1280): --lowerBytes(var(--keyboard-prev), 8);
style(--at: 1281): --rightShift(var(--keyboard-prev), 8);`;
</script>

<p>
  Reading sounds like the easy half &mdash; nothing changes, you just look at a value. It isn&rsquo;t. Every memory cell is its own variable; an address is just a number; and CSS gives no way to get from the number to the variable. The very first thing a CPU does every <Term t="tick">tick</Term> &mdash; fetch the byte its instruction pointer points at &mdash; is already impossible to write directly.
</p>
<p>
  The machine&rsquo;s answer is <code>--readMem</code>: <b>one single function</b> with one arm for every address it could ever be asked about &mdash; 743,948 of them. Not a table, not a list of functions: one <code>if()</code>, forty-four million characters long, that simply asks &ldquo;is it address 0? is it address 1? is it address&nbsp;2?&rdquo; until it hits yours.
</p>

<FetchLadder />

<p>
  Three different kinds of thing live inside that one function, and you can see all three in the tower above.
</p>

<SectionHead>Why are all three in one function?</SectionHead>
<p>
  At first it might seem strange to cram RAM, BIOS ROM and the hard disk into one read function. Why not three functions, and pick the right one wherever a read happens?
</p>
<p>
  Because we can&rsquo;t know which one we&rsquo;ll need. The address being read isn&rsquo;t written down anywhere in the program &mdash; it&rsquo;s computed on the spot, usually from registers: <i>fetch me whatever DS &times; 16 + BX points at</i>. The exact same MOV instruction reads RAM this tick, a ROM table the next, the disk window the one after &mdash; wherever its registers happen to be pointing. Any read can land anywhere. So one function has to answer for everywhere.
</p>

<SectionHead>The RAM arms &mdash; 736,510 of them</SectionHead>
<p>
  The overwhelming bulk. Memory cells hold two bytes each, so every cell gets a pair of arms: the even address extracts the low byte (<code>mod(&hellip;, 256)</code>), the odd address the high byte (divide by 256, round down). These arms read the live machine &mdash; whatever a program has written is what comes back.
</p>
<p>
  Two arms hiding in the middle of the RAM range aren&rsquo;t memory at all: addresses 1280 and 1281 are wired straight to the live keyboard value. When the BIOS keyboard service reads those addresses, it gets real keypresses through the same function as everything else:
</p>
<CodeCss code={KBD_ARMS} />

<SectionHead>The BIOS ROM arms &mdash; 6,924</SectionHead>
<p>
  The <Term t="bios">BIOS</Term> is read-only, so its bytes don&rsquo;t need cells &mdash; each one is baked in as a literal constant: <code>style(--at: 983040): 235;</code>. Bytes that are zero are omitted entirely (the <code>else: 0</code> at the bottom of the function answers for them), which is why a 64&nbsp;KB ROM region needs only 6,924 arms.
</p>

<SectionHead>The disk window &mdash; 512, at the very end</SectionHead>
<p>
  The last 512 arms are the strangest. They don&rsquo;t hold anything at all.
</p>
<p>
  Instead, they&rsquo;re a <i>window</i>. The BIOS writes the number of the sector it wants into an agreed memory cell (<code>--mc632</code>), then reads these 512 addresses. Each arm computes <i>the requested sector &times; 512 + its own position in the window</i> &mdash; the first arm serves the sector&rsquo;s first byte, the last one its 512th &mdash; and hands the question straight to the disk function. Same 512 addresses, whichever sector was last asked for: change the number in the cell, and the view changes. (The gibberish in the formula &mdash; <code>mod(&hellip;, 256) + round(down, &hellip;) &times; 256</code> &mdash; is just gluing the 16-bit sector number back together from its packed cell.) The <a href="#about/file/disk">disk section</a> picks it up from there.
</p>

<SectionHead>If all else fails &mdash; 1</SectionHead>
<p>
  736,510 + 6,924 + 512 + 2 = 743,948. Then <code>else: 0);</code>, and the function ends.
</p>
<p>
  It looks like boilerplate. It isn&rsquo;t &mdash; this arm answers <i>constantly</i>: every zero byte the ROM section left out lands here, and so does any address no arm mentions &mdash; the gaps between regions, places where nothing was ever built. A normal emulator would spend a bounds check and an error path on those. Here, a read of nowhere falls through all 743,948 questions and comes back 0.
</p>
