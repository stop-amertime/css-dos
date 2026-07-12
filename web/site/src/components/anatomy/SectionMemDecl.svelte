<script>
  // Memory declarations — the per-cell @property array, one declaration
  // per memory cell (368,256 of them), which dominates the file. The
  // subsystem declarations (registers, chipset, keyboard, write slots)
  // now live in their own sections, so this is purely the memory cells.
  // The @property block is verbatim from sokoban.css; the cell count is
  // measured from the same file (grep -c '@property --mc' → 368,256).
  import CodeCss from '../CodeCss.svelte';
  import Callout from '../Callout.svelte';
  import SectionHead from '../SectionHead.svelte';

  const DECL = `@property --mc5000 {
  syntax: '<integer>';
  inherits: true;
  initial-value: 32861;
}`;

  const FALLBACKS = `--mc5000-prev: var(--mc5000_2, 32861);
--mc5000_2: var(--mc5000_1, 32861);`;
</script>

<p>
  Before CSS lets you use a variable as a typed integer, you have to declare it. The file declares every memory cell &mdash; all <b>368,256</b> of them. This one is verbatim:
</p>
<CodeCss code={DECL} />
<p>
  The <code>initial-value</code> is that cell&rsquo;s power-on contents. Which means the machine&rsquo;s entire starting state &mdash; the BIOS, the boot sector, the blank RAM &mdash; is written into the declarations: Sokoban&rsquo;s memory at the moment of switch-on, spelled out one cell at a time. 32&nbsp;MB before anything has happened.
</p>
<p>
  Do we really have to write <code>inherits: true</code> 368,256 times? Yes. The spec makes <code>inherits</code> a required descriptor of <code>@property</code> &mdash; leave it out and the whole rule is invalid and silently ignored. It can&rsquo;t be <code>false</code> either: the memory variables live on the CPU element but get read by its descendants &mdash; every pixel of the screen, for instance, reaches its byte of video memory through inheritance. Set it to <code>false</code> and the pixels would see each cell&rsquo;s power-on value instead of the live one, and the screen would freeze on the boot picture forever.
</p>
<p>
  So that one line, seventeen-ish bytes at a time, adds up to about 6&nbsp;MB of the file &mdash; roughly the size of the entire pixel painter, spent saying &ldquo;yes, inherit&rdquo; a third of a million times.
</p>

<SectionHead>One cell, four variables</SectionHead>
<p>
  There&rsquo;s a wrinkle: <code>--mc5000</code> isn&rsquo;t the only variable for that cell. The <a href="#about/file/clock">clock section</a> explains why every tick has to read the <i>previous</i> values of memory while the new ones are being computed &mdash; and why that trick needs each cell to exist as <b>four</b> variables: the freshly computed value, the <code>-prev</code> copy the formulas read, and the two courier copies (<code>_1</code>, <code>_2</code>) that carry results across to the next tick.
</p>
<p>
  Yet only the first one is ever declared. The other three have no <code>@property</code> block anywhere in the file &mdash; an unregistered CSS variable simply springs into existence the first time something assigns it. What they <i>do</i> need is the power-on value, for the very first tick, before anything has been handed over. It rides along as a fallback, right inside their plumbing lines (variable names tidied for reading &mdash; the real ones are <code>--__1mc5000</code> and friends):
</p>
<CodeCss code={FALLBACKS} />
<p>
  If the <code>_2</code> copy doesn&rsquo;t exist yet &mdash; tick one, nothing has been carried over &mdash; <code>-prev</code> falls back to 32861, the declared power-on value. Which means every byte of the machine&rsquo;s starting memory is actually written into the file <b>three times</b>: once as an <code>initial-value</code>, and twice more as fallbacks.
</p>

<Callout kind="tip" label="The one optimisation">
  <p>
    Memory is <b>packed two bytes per variable</b> (32861 is really the two bytes 93 and 128), so every sweep over memory mentions half as many cells as there are bytes. Without it, everything memory-related in the file doubles.
  </p>
</Callout>

<SectionHead>Hidden storage above the 1 MB limit</SectionHead>
<p>
  The machine needs some storage the running program can never see. The palette is the clearest case: a program sets a colour by writing three bytes to a port, and on real hardware those bytes live inside the VGA chip &mdash; not in any memory the program can read back. The writable floppy (covered in the <a href="#about/file/disk">disk section</a>) is the same problem, hundreds of kilobytes bigger. Where does a machine built entirely out of memory cells keep private data?
</p>
<p>
  Above the ceiling. An 8086 address is assembled from two 16-bit registers, as segment &times; 16 + offset &mdash; and that arithmetic runs out a whisker past one megabyte. The chip cannot count any higher. But this machine&rsquo;s memory isn&rsquo;t a real address space &mdash; it&rsquo;s variable names, and a name is just text. Nothing stops the file defining cells past the point where addresses stop. So the palette lives as perfectly ordinary memory cells starting at byte 1,048,576 (packed two to a cell, that&rsquo;s <code>--mc524288</code> &mdash; the very cell the palette function reads), and the writable floppy&rsquo;s contents at byte 2,097,152. The only formulas that mention these cells are the machine&rsquo;s own: the palette port, the disk machinery.
</p>
<Callout kind="info" label="For the pedantic">
  <p>
    The whisker: segment 0xFFFF reaches up to address 1,114,095, so the palette &mdash; at exactly 1 MB &mdash; technically sits <i>inside</i> the 8086&rsquo;s odd little overshoot zone, not beyond it. On the real chip those addresses wrapped around to zero, and no real-mode program forms them; later PCs turned the overshoot into the &ldquo;high memory area&rdquo; DOS users squeezed an extra 64&nbsp;KB from. The disk image at 2&nbsp;MB is beyond any possible pointer, full stop.
  </p>
</Callout>
<p>
  One booby trap up here shaped a whole feature: a big number is safe in a variable&rsquo;s <i>name</i> &mdash; that&rsquo;s text &mdash; but not in a computed <i>value</i>. Chrome keeps only about six significant digits of a computed numeric property, so any formula whose result crossed a million would silently lose its low digits. The formulas around this hidden storage therefore never compute a full address: they work in small offsets &mdash; &ldquo;byte 31,204 of the disk&rdquo; &mdash; and the million-plus base appears only as literal text, in variable names and match keys, never as the output of arithmetic. It&rsquo;s also why writable floppies are capped at 720&nbsp;KB: a byte&rsquo;s position <i>within</i> the disk is a computed value, and past a million, neighbouring bytes would start to blur into one another.
</p>

<SectionHead>No bounds checks</SectionHead>
<p>
  A conventional emulator spends code on unmapped memory: it allocates the full address space up front, or checks every access against a table of what exists. Here that code is zero lines. For addresses no program could ever touch, Kiln emits <i>nothing</i> &mdash; no declaration, no read arm, no write formula; the address simply does not occur anywhere in 300&nbsp;MB. Read one and you fall through every arm of the big lookup to its final <code>else: 0</code>; write one and the broadcast finds no cell whose formula mentions that address, so the write lands nowhere, and nothing complains. (The CPU exploits the same mechanism on purpose when it cancels a write by aiming it at address &minus;1.)
</p>
<p>
  There&rsquo;s no bounds check because there is no boundary &mdash; just places where the CSS stops.
</p>
