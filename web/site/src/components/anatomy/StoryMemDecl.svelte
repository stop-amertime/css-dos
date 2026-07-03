<script>
  // Memory — variable declarations. The @property block is verbatim
  // from sokoban.css; the cell count is measured from the same file
  // (grep -c '@property --mc' → 368,256).
</script>

<p>
  Before CSS lets you use a variable as a typed integer, you have to
  declare it. The file declares every memory cell &mdash; all
  <b>368,256</b> of them. This one is verbatim:
</p>
<pre class="byte-example"><code>@property <span class="tok-prop">--mc5000</span> {'{'}
  syntax: '&lt;integer&gt;';
  inherits: true;
  initial-value: <span class="tok-num">32861</span>;
{'}'}</code></pre>
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

<div class="callout">
  <span class="callout-label">THE ONE OPTIMISATION</span>
  <p>
    Memory is <b>packed two bytes per variable</b> (32861 is really the
    two bytes 93 and 128), so every sweep over memory mentions half as
    many cells as there are bytes. Without it, everything
    memory-related in the file doubles.
  </p>
</div>
