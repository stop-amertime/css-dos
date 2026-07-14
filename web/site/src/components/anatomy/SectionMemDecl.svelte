<script>
  // Memory declarations - the per-cell @property array, one declaration
  // per memory cell (368,256 of them), which dominates the file. The
  // subsystem declarations (registers, chipset, keyboard, write slots)
  // now live in their own sections, so this is purely the memory cells.
  // The @property block is verbatim from sokoban.css; the cell count is
  // measured from the same file (grep -c '@property --mc' → 368,256).
  // "Why pretend it's memory" facts from kiln/memory.mjs (DAC_LINEAR,
  // DISK_SHADOW_LINEAR) + kiln/patterns/misc.mjs (OUT 0x3C9 is an
  // ordinary addMemWrite aimed at DAC_LINEAR + index*3 + sub; the DAC
  // cursors are register-style dispatch entries, not cells).
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
  Before CSS lets you use a variable as a typed integer, you have to declare it.
</p>
<CodeCss code={DECL} />
<p>
  The file declares variables for all <b>368,256</b> memory cells, so the above code is repeated 368,256 times.
</p>
<p>
  Do we really have to write <code>inherits: true</code> 368,256 times? Regrettably, we do. The spec makes <code>inherits</code> a required descriptor of <code>@property</code> - if left out, the rule is invalid and silently ignored. Ouch. It can&rsquo;t be <code>false</code> either: the memory variables live on the motherboard element but get read by its descendants. But &lsquo;false&rsquo; is one character longer anyway, so it wouldn&rsquo;t even help.
</p>
<p>
  Just the repeated should-be-implicit <code>inherits:true</code> instructions total about 6&nbsp;MB of text - longer than the <i>complete works of Shakespeare</i>, just spent saying &ldquo;yes, inherit&rdquo; a third of a million times.
</p>

<SectionHead>Trick 1: only declare the first variable</SectionHead>
<p>
  There&rsquo;s a wrinkle: <code>--mc5000</code> isn&rsquo;t the only variable for that cell. The <a href="/about/file/clock">clock section</a> explains why every tick has to read the <i>previous</i> values of memory while the new ones are being computed.
</p>
<p>
  For efficiency, only the first one is declared. The other three have no <code>@property</code> declaration - an unregistered CSS variable is simply created if it didn't already exist. They <i>do</i> need a power-on value for the very first tick, expressed as fallback as follows:
</p>
<CodeCss code={FALLBACKS} />
<p>
  If the <code>_2</code> copy doesn&rsquo;t exist yet - tick one, nothing has been carried over - <code>-prev</code> falls back to 32861, the declared power-on value. This means every byte of the machine&rsquo;s starting memory is actually written into the file <b>three times</b>: once as an <code>initial-value</code>, and twice more as fallbacks.
</p>

<Callout kind="tip" label="The one optimisation">
  <p>
    Memory is <b>packed two bytes per variable</b> (32861 is really the two bytes 93 and 128), so every sweep over memory mentions half as many cells as there are bytes. Without it, everything memory-related in the file doubles.
  </p>
</Callout>

<SectionHead>Trick 2: Using memory beyond the addressable limit</SectionHead>
<p>
  This machine needs some memory aside from what's available to the running program. For example, a program sets a pallette colour by writing three bytes to a port, and on real hardware those bytes live inside the VGA chip - not in any memory the program can read back. The writable floppy (covered in the <a href="/about/file/disk">disk section</a>) has the same problem. 
</p>
<p>
  An 8086 address is assembled from two 16-bit registers, as segment &times; 16 + offset - and that tops out a little over one megabyte. The chip cannot address memory higher than that number. But this machine&rsquo;s memory isn&rsquo;t a real address space - it&rsquo;s variable names, and a name is just text. Nothing stops the file defining cells higher than the chip could count. So the palette lives as perfectly ordinary memory cells starting at byte 1,048,576 (packed two to a cell, that&rsquo;s <code>--mc524288</code> - the very cell the palette function reads), and the writable floppy&rsquo;s contents at byte 2,097,152.
</p>
<Callout kind="info" label="For the pedantic">
  <p>
    Segment 0xFFFF reaches up to address 1,114,095, so the palette - at exactly 1 MB - technically sits <i>inside</i> the 8086&rsquo;s overshoot zone, not beyond it. On the real chip those addresses wrapped around to zero, and no real-mode program forms them; later PCs turned the overshoot into the &ldquo;high memory area&rdquo; DOS users squeezed an extra 64&nbsp;KB from. The disk image at 2&nbsp;MB is beyond any possible pointer, though.
  </p>
</Callout>
<p>
  One booby trap shaped a whole feature: a big number is safe in a variable&rsquo;s <i>name</i> - that&rsquo;s text - but not in a computed <i>value</i>. Chrome keeps only about six significant digits of a computed numeric property, so any formula whose result crossed a million would silently lose its low digits. The formulas around this hidden storage therefore never compute a full address: they work in small offsets - &ldquo;byte 31,204 of the disk&rdquo; - and the million-plus base appears only as literal text, in variable names and match keys, never as the output of arithmetic. It&rsquo;s also why writable floppies are capped at 720&nbsp;KB: a byte&rsquo;s position <i>within</i> the disk is a computed value, and past a million, neighbouring bytes would start to blur into one another.
</p>

<SectionHead>Wait - why pretend those are memory at all?</SectionHead>
<p>
  Fair question: the palette isn&rsquo;t memory, so why dress it up as memory cells - couldn&rsquo;t it live in its own function somewhere, away from the address space?
</p>
<p>
  Well, a <code>@function</code> re-computes from its inputs every time it&rsquo;s called; between ticks it holds nothing. The only thing in this machine that can hold a value is a variable with the <a href="/about/file/clock">clock plumbing</a> behind it. So the choice was never &ldquo;memory cells or a function&rdquo;. It was &ldquo;memory cells, or a second parallel system of variables doing the same job&rdquo;.
</p>
<p>
 A bespoke palette store would need its own broadcast over all 768 bytes, with its own slot variables - the write machinery again, wearing a different name. The writable floppy is the same problem.
</p>
<p>
  Treating them as memory makes them nearly free. The cells ride along in the lovely fully-equipped Mercedes that RAM already paid for: the declarations (the writable floppy&rsquo;s <code>initial-value</code>s <i>are</i> the factory disk image - that&rsquo;s why reloading resets it), the two-byte packing, the clock plumbing, the write-splicing function. The palette port&rsquo;s entire implementation is one ordinary write slot aimed at address 1,048,576&nbsp;+ colour&nbsp;&times;&nbsp;3 + channel. It's a bit hacky, but very practical. 
</p>
<p>
 If we just need to refer to a single value with a fixed name, it does go lighter: the palette&rsquo;s write cursor and the interrupt controller&rsquo;s mask aren&rsquo;t memory cells but <a href="/about/file/chipset">chipset</a> variables with their own little update tables, just like a CPU register. That&rsquo;s the general rule: a single value with a fixed name only needs a variable; bytes picked out by a computation need memory cells. The palette&rsquo;s cursor sits on one side of that line, the 768 bytes it points into on the other.
</p>

<SectionHead>No bounds checks are needed</SectionHead>
<p>
  A conventional emulator spends code on unmapped memory: it allocates the full address space up front, or checks every access against a table of what exists. For addresses no program could ever touch, Kiln emits nothing - no declaration, no read arm, no write formula. A read simply falls through every arm of the big lookup to its final <code>else: 0</code>; for a write, the broadcast finds no cell whose formula mentions that address, so the write lands nowhere, and nothing complains. (The CPU exploits the same mechanism on purpose when it cancels a write by aiming it at address &minus;1.)
</p>
