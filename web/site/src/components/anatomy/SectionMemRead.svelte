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
  Wait, <i>read</i> formulas? How complex can <i>reading</i> a variable be? Don&rsquo;t you just&hellip; look at it?
</p>
<p>
  If only. Let&rsquo;s say we want to read memory cell number 12345. Each memory cell has one variable, say <code>var(--memory-12345)</code>. In a normal programming language, we&rsquo;d place the memory cells in a list and find the 12345th entry, e.g. <code>memory[12345]</code>.
</p>
<p>
  But CSS doesn&rsquo;t have lists. Hmm. Can we somehow search the number/ the variable name&hellip;? Nope.
</p>
<p>
  So with a huge sigh, we roll up our sleeves and just brute force it. As in, <i>check every possible option</i> one-by-one.
</p>
<p>
  The function <code>--readMem</code> is a single gigantic <code>if()</code> statement which checks every address - 743,948 of them. Not a table, not a list of functions: one <code>if()</code>, forty-four million characters long, that simply asks &ldquo;is it address 0? is it address 1? is it address&nbsp;2?&rdquo; until it hits the right one.
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
  Because we can&rsquo;t know which one we&rsquo;ll need. The address being read isn&rsquo;t written down anywhere in the program - it&rsquo;s computed on the spot, usually from registers: <i>fetch me whatever DS &times; 16 + BX points at</i>. The exact same MOV instruction reads RAM this tick, a ROM table the next, the disk window the one after - wherever its registers happen to be pointing. Any read can land anywhere. So one function has to answer for everywhere.
</p>

<SectionHead>The RAM - 736,510</SectionHead>
<p>
  The overwhelming bulk. Memory cells hold two bytes each, so every cell gets a pair of arms: the even address extracts the low byte (<code>mod(&hellip;, 256)</code>), the odd address the high byte (divide by 256, round down). These arms read the live machine - whatever a program has written is what comes back.
</p>
<p>
  Two arms hiding in the middle of the RAM range aren&rsquo;t memory at all: addresses 1280 and 1281 are wired straight to the live keyboard value - the aperture from the <a href="/about/file/keys">keyboard section</a>, plumbed in. When the BIOS keyboard service reads those addresses, it gets real keypresses through the same function as everything else:
</p>
<CodeCss code={KBD_ARMS} />

<SectionHead>The BIOS ROM - 6,924</SectionHead>
<p>
  The <Term t="bios">BIOS</Term> is read-only, so its bytes don&rsquo;t need cells - each one is baked in as a literal constant: <code>style(--at: 983040): 235;</code>. Bytes that are zero are omitted entirely (the <code>else: 0</code> at the bottom of the function answers for them), which is why a 64&nbsp;KB ROM region needs only 6,924 arms.
</p>

<SectionHead>The disk window - 512</SectionHead>
<p>
  The last 512 arms are the strangest. They don&rsquo;t hold anything at all.
</p>
<p>
  Instead, they&rsquo;re a <i>window</i>. The BIOS writes the number of the sector it wants into an agreed memory cell (<code>--mc632</code>), then reads these 512 addresses. Each arm computes <i>the requested sector &times; 512 + its own position in the window</i> - the first arm serves the sector&rsquo;s first byte, the last one its 512th - and hands the question straight to the disk function. Same 512 addresses, whichever sector was last asked for: change the number in the cell, and the view changes. (The gibberish in the formula - <code>mod(&hellip;, 256) + round(down, &hellip;) &times; 256</code> - is just gluing the 16-bit sector number back together from its packed cell.) The <a href="/about/file/disk">disk section</a> picks it up from there.
</p>

<SectionHead>If all else fails - 1</SectionHead>
<p>
  736,510 + 6,924 + 512 + 2 = 743,948. Then <code>else: 0);</code>, and the function ends.
</p>
<p>
  It looks like boilerplate. It isn&rsquo;t - this arm answers <i>constantly</i>: every zero byte the ROM section left out lands here, and so does any address no arm mentions - the gaps between regions, places where nothing was ever built. A normal emulator would spend a bounds check and an error path on those. Here, a read of nowhere falls through all 743,948 questions and comes back 0.
</p>
