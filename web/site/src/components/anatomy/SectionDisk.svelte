<script>
  // The disk — the baked-in floppy and the 512-byte window trick.
  // Copy recycled from the retired "300 MB question" page; window
  // mechanism from EXPLAINER.md §8 / CABINET-ANATOMY.md §10–11.
  import Foldable from '../Foldable.svelte';
  import Term from '../Term.svelte';
  import CodeCss from '../CodeCss.svelte';

  const DISK_FN = `@function --readDiskByte(--idx <integer>) returns <integer> {
  result: if(
    style(--idx: 0): 235;
    style(--idx: 1): 60;
    style(--idx: 2): 144;
    /* … one arm per byte of the floppy … */`;

  const WINDOW_ARM = `style(--at: 852016): --readDiskByte(calc(
  (mod(var(--snapshot-mc632), 256) + round(down, var(--snapshot-mc632) / 256) * 256) * 512 + 48));`;
</script>

<p>
  CSS can&rsquo;t open anything at runtime &mdash; no files, no
  requests, no loading. Whatever the machine will ever need has to be
  in the stylesheet before it starts: the BIOS, <Term t="dos">DOS</Term> itself, and the
  entire <Term t="floppy">floppy disk</Term>, baked in byte by byte &mdash; one
  <code>if()</code> arm each:
</p>
<CodeCss code={DISK_FN} />
<p>
  (Verbatim, and already meaningful: 235,&nbsp;60,&nbsp;144 is the
  x86 jump instruction that every FAT boot sector opens with. Byte
  zero of the disk is the first thing the machine boots.)
</p>

<div class="callout">
  <span class="callout-label">GLOSSARY</span>
  <p>
    <b>Sector</b> &mdash; the unit a floppy drive reads and writes:
    512 bytes. A 1.44&nbsp;MB floppy is 2,880 of them.
  </p>
</div>

<h3 class="anatomy-head">The window</h3>
<p>
  DOS never reads the disk all at once &mdash; it asks the floppy
  controller for one sector at a time: &ldquo;give me sector
  57.&rdquo; So the machine keeps a 512-byte <b>window</b> in memory
  whose contents are not stored anywhere: those 512 addresses read
  <i>through</i> to the disk table, at &ldquo;requested sector &times;
  512 + offset&rdquo;. Ask for a different sector and the same window
  now shows different bytes. DOS copies them out and never learns the
  disk is a fiction.
</p>
<p>
  Window byte 48&rsquo;s actual arm, in full:
</p>
<CodeCss code={WINDOW_ARM} />
<p>
  The clutter in the middle is the sector number being dug out of
  memory cell 632 &mdash; the &ldquo;which sector do you want&rdquo;
  register is itself two bytes of ordinary RAM. DOS writes a number
  there, and 512 addresses instantly mean a different part of the
  disk.
</p>

<p>
  This is the one section that grows with the game &mdash;
  Sokoban&rsquo;s disk is 13&nbsp;MB of the file; Doom&rsquo;s
  1.3&nbsp;MB floppy takes its cabinet to ~330&nbsp;MB. It
  doesn&rsquo;t shrink much either: the machine itself costs
  ~296&nbsp;MB before any game arrives, so Zork &mdash; 85&nbsp;KB of
  words on a screen &mdash; still comes out around 300&nbsp;MB.
</p>

<Foldable>
  {#snippet summary()}A real, bootable floppy{/snippet}
  <p>
    The disk isn&rsquo;t a loose pile of files &mdash; it&rsquo;s a
    genuine FAT12 floppy image, the same format a 1980s drive wrote,
    assembled at build time from the cart&rsquo;s files with DOS&rsquo;s
    boot sector and kernel in place. DOS reads its directory tables and
    follows its cluster chains exactly as it would on hardware. (Zero
    bytes are skipped in the lookup, so sparse disks are cheaper than
    their nominal size.)
  </p>
</Foldable>
