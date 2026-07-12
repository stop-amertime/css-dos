<script>
  // The disk — the baked-in floppy and the 512-byte window trick.
  // Copy recycled from the retired "300 MB question" page; window
  // mechanism from EXPLAINER.md §8 / CABINET-ANATOMY.md §10–11.
  import Foldable from '../Foldable.svelte';
  import SectionHead from '../SectionHead.svelte';
  import Term from '../Term.svelte';
  import CodeCss from '../CodeCss.svelte';

  const DISK_FN = `@function --readDiskByte(--idx <integer>) returns <integer> {
  result: if(
    style(--idx: 0): 235;
    style(--idx: 1): 60;
    style(--idx: 2): 144;
    /* … one arm per byte of the floppy … */`;

  const WINDOW_ARM = `style(--at: 852016): --readDiskByte(calc(
  (mod(var(--mc632-prev), 256) + round(down, var(--mc632-prev) / 256) * 256) * 512 + 48));`;
</script>

<p>
  CSS can&rsquo;t open anything at runtime &mdash; no files, no requests, no loading &mdash; so whatever the machine will ever need has to be in the stylesheet before it starts: the <Term t="bios">BIOS</Term>, <Term t="dos">DOS</Term> itself, and the entire <Term t="floppy">floppy disk</Term>, baked in byte by byte. The concept here is relatively simple &mdash; we just give each byte in the floppy disk one variable each, and a function reads them back:
</p>
<CodeCss code={DISK_FN} />
<p>
  (Already meaningful: 235,&nbsp;60,&nbsp;144 is the x86 jump instruction that every FAT boot sector opens with. Byte zero of the disk is the first thing the machine boots.)
</p>

<SectionHead>The window</SectionHead>
<p>
  How does DOS read it? Luckily, never all at once &mdash; it asks the floppy controller for one <Term t="sector">sector</Term> at a time: &ldquo;give me sector 57.&rdquo; So the machine keeps a 512-byte <b>window</b> in memory whose contents are not stored anywhere: those 512 addresses read <i>through</i> to the disk table, at &ldquo;requested sector &times; 512 + offset&rdquo;. Ask for a different sector and the same window now shows different bytes. DOS copies them out and never learns the disk is a fiction.
</p>
<p>
  Window byte 48&rsquo;s actual arm, in full:
</p>
<CodeCss code={WINDOW_ARM} />
<p>
  The clutter in the middle is the sector number: the &ldquo;which sector do you want&rdquo; register is memory cell 632 &mdash; two bytes of ordinary RAM &mdash; and the <code>mod(&hellip;) + round(&hellip;) &times; 256</code> is just gluing its 16-bit value back together. DOS writes a number into that cell, and all 512 window addresses instantly point at a different part of the disk.
</p>

<p>
  This is the one section that grows with the game &mdash; Sokoban&rsquo;s disk is 13&nbsp;MB of the file; Doom&rsquo;s 1.3&nbsp;MB floppy takes its cabinet to ~330&nbsp;MB. The machine itself costs ~296&nbsp;MB before any game arrives, so Zork &mdash; 85&nbsp;KB of words on a screen &mdash; still comes out around 300&nbsp;MB.
</p>

<SectionHead>Writable disks</SectionHead>
<p>
  Everything above is read-only &mdash; each disk byte is a number baked into an <code>if()</code> statement. Can a stylesheet hold a disk you can actually save files onto? At a price. A cart can opt in to a second mode (the &ldquo;Writable&rdquo; checkbox on the Build page): every byte of the floppy also becomes an ordinary memory cell &mdash; the same kind that holds RAM. Reads stop consulting the baked table and ask the cells instead, and the write machinery that serves RAM now serves the floppy too. Save a file in the MS-DOS&nbsp;4.00 cart&rsquo;s EDIT and <code>DIR</code> shows it. It can&rsquo;t save a new .css file or otherwise persist itself, so it&rsquo;s lost on reload.
</p>
<p>
  The price is steep. A byte that can change needs a declaration, a read formula and a write formula &mdash; ten times the text of a read-only byte, about 0.4&nbsp;MB of cabinet per KB of floppy. Building Sokoban&rsquo;s 720&nbsp;KB floppy as writable inflates the cabinet from 300&nbsp;MB to 570&nbsp;MB &mdash; past the ~536&nbsp;MB V8 string limit in Chrome, so a writable Sokoban cannot be loaded. Speed roughly halves too (more cells checking themselves every tick). That&rsquo;s why it&rsquo;s opt-in per cart, and why the writable MS-DOS&nbsp;4.00 floppy is a deliberately smaller 480&nbsp;KB.
</p>

<Foldable>
  {#snippet summary()}A real, bootable floppy{/snippet}
  <p>
    The disk isn&rsquo;t a loose pile of files &mdash; it&rsquo;s a genuine <Term t="fat12">FAT12</Term> floppy image, the same format a 1980s drive wrote, assembled at build time from the cart&rsquo;s files with DOS&rsquo;s boot sector and kernel in place. DOS reads its directory tables and follows its cluster chains exactly as it would on hardware. (Zero bytes are skipped in the lookup, so sparse disks are cheaper than their nominal size.)
  </p>
</Foldable>
