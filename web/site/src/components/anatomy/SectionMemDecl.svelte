<script>
  // Memory — variable declarations. The @property block is verbatim
  // from sokoban.css; the cell count is measured from the same file
  // (grep -c '@property --mc' → 368,256).
  import CodeCss from '../CodeCss.svelte';
  import Callout from '../Callout.svelte';
  import TreeView from './tree/TreeView.svelte';
  import { DECL_TREE, DECL_TREE_META } from './tree/decl-tree.js';

  const DECL = `@property --mc5000 {
  syntax: '<integer>';
  inherits: true;
  initial-value: 32861;
}`;

  const FALLBACKS = `--snapshot-mc5000: var(--staged-mc5000, 32861);
--staged-mc5000: var(--held-mc5000, 32861);`;
</script>

<TreeView nodes={DECL_TREE} bytes={DECL_TREE_META.bytes}
  note="exhibit from a minimal 1.5 KB-RAM build — a real cabinet’s declarations run ~32 MB" />

<p>
  Before CSS lets you use a variable as a typed integer, you have to
  declare it. The file declares every memory cell &mdash; all
  <b>368,256</b> of them. This one is verbatim:
</p>
<CodeCss code={DECL} />
<p>
  The <code>initial-value</code> is that cell&rsquo;s power-on
  contents. Which means the machine&rsquo;s entire starting state
  &mdash; the BIOS, the boot sector, the blank RAM &mdash; is written
  into the declarations: Sokoban&rsquo;s memory at the moment of
  switch-on, spelled out one cell at a time. 32&nbsp;MB before anything
  has happened.
</p>
<p>
  Do we really have to write <code>inherits: true</code> 368,256 times?
  Yes. The spec makes <code>inherits</code> a required descriptor of
  <code>@property</code> &mdash; leave it out and the whole rule is
  invalid and silently ignored. It can&rsquo;t be <code>false</code>
  either: the memory variables live on the CPU element but get read by
  its descendants &mdash; every pixel of the screen, for instance,
  reaches its byte of video memory through inheritance. Set it to
  <code>false</code> and the pixels would see each cell&rsquo;s
  power-on value instead of the live one, and the screen would freeze
  on the boot picture forever.
</p>
<p>
  So that one line, seventeen-ish bytes at a time, adds up to about
  6&nbsp;MB of the file &mdash; roughly the size of the entire pixel
  painter, spent saying &ldquo;yes, inherit&rdquo; a third of a million
  times.
</p>

<h3 class="anatomy-head">One cell, four variables</h3>
<p>
  There&rsquo;s a wrinkle: <code>--mc5000</code> isn&rsquo;t the only
  variable for that cell. The <a href="#about/file/clock">clock
  section</a> explains why every tick has
  to read a frozen snapshot of memory while the new values are being
  computed &mdash; and that trick needs each cell to exist as <b>four</b>
  variables: the freshly computed value, the snapshot the formulas
  read, and two hand-over copies that pass results to the next tick.
</p>
<p>
  Yet only the first one is ever declared. The other three have no
  <code>@property</code> block anywhere in the file &mdash; an
  unregistered CSS variable simply springs into existence the first
  time something assigns it. What they <i>do</i> need is the power-on
  value, for the very first tick, before anything has been handed over.
  It rides along as a fallback, right inside their plumbing lines
  (variable names tidied for reading &mdash; the real ones are
  <code>--__1mc5000</code> and friends):
</p>
<CodeCss code={FALLBACKS} />
<p>
  If the staged copy doesn&rsquo;t exist yet &mdash; tick one, nothing
  stored &mdash; the snapshot falls back to 32861, the declared
  power-on value. Which means every byte of the machine&rsquo;s
  starting memory is actually written into the file <b>three
  times</b>: once as an <code>initial-value</code>, and twice more as
  fallbacks.
</p>

<Callout kind="tip" label="The one optimisation">
  <p>
    Memory is <b>packed two bytes per variable</b> (32861 is really the
    two bytes 93 and 128), so every sweep over memory mentions half as
    many cells as there are bytes. Without it, everything
    memory-related in the file doubles.
  </p>
</Callout>
