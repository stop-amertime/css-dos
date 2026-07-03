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

<div class="callout">
  <span class="callout-label">THE ONE OPTIMISATION</span>
  <p>
    Memory is <b>packed two bytes per variable</b> (32861 is really the
    two bytes 93 and 128), so every sweep over memory mentions half as
    many cells as there are bytes. Without it, everything
    memory-related in the file doubles.
  </p>
</div>
