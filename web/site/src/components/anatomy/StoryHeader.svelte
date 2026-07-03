<script>
  // The header comment — the file's birth certificate.
  // Facts: CABINET-ANATOMY.md §1; extract verbatim from sokoban.css.
</script>

<p>
  Before any CSS, the file opens with a plain comment: what cart it was
  built from, when, and the full build recipe &mdash; which BIOS, how
  much memory, and every file that went onto the floppy.
</p>
<pre class="byte-example"><code><span class="tok-comment">/* CSS-DOS cabinet
 *
 * Built from: Sokoban
 * Built at:   2026-07-02T12:26:22.378Z
 *
 * Resolved manifest:
 *   {'{'}
 *     "bios": "corduroy",
 *     "memory": {'{'} "conventional": "640K", "gfx": true, &hellip; {'}'},
 *     "disk": {'{'} "mode": "rom", "files": [ &hellip;87 files&hellip; ] {'}'}
 *   &hellip;</span></code></pre>
<p>
  It does nothing at runtime. It exists so that a human who opens a
  300&nbsp;MB stylesheet can tell what they&rsquo;re looking at. The
  size tracks the floppy&rsquo;s file list &mdash; Sokoban ships 87
  files, and each one is named here.
</p>
