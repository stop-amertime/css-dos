<script>
  // Credits & thanks.
  import SectionHead from '../../components/SectionHead.svelte';
</script>

<div class="subpage">
  <h1>Credits &amp; thanks</h1>
  <p>
    CSS-DOS stands on the shoulders of people who proved, piece by piece, that a browser&rsquo;s style engine could be a computer.
  </p>

  <SectionHead tight>Prior art &amp; kindred projects</SectionHead>
  <ul class="credits-list">
    <li>
      <a href="https://lyra.horse/x86css/" class="ext-link" target="_blank" rel="noopener">x86CSS</a> - Lyra Rebane (<a href="https://github.com/rebane2001/x86css" class="ext-link" target="_blank" rel="noopener">rebane2001</a>). A working 16-bit x86 CPU in pure CSS - the original demonstration that the trick is possible at all. CSS-DOS grew out of it.
    </li>
    <li>
      <a href="https://dev.to/janeori/expert-css-the-cpu-hack-4ddj" class="ext-link" target="_blank" rel="noopener">The CSS CPU Hack</a> - Jane Ori. The writeup for doing real computation in CSS.
    </li>
    <li>
      <a href="https://github.com/nicknisi/emu8" class="ext-link" target="_blank" rel="noopener">emu8</a> - the reference 8086 emulator CSS-DOS checks itself against.
    </li>
  </ul>

  <SectionHead>Operating system</SectionHead>
  <ul class="credits-list">
    <li>
      The booted OS for most programs is <b>EDR-DOS</b>, from the <a href="https://svardos.org/" class="ext-link" target="_blank" rel="noopener">SvarDOS</a> build - an open, freely-distributable DR-DOS descendant. CSS-DOS ships its <code>kernel.sys</code> and <code>command.com</code> on the emulated floppy.
    </li>
    <li>
      Also included is the real <b>MS-DOS 4.00</b> by Microsoft - <a href="https://github.com/microsoft/MS-DOS" class="ext-link" target="_blank" rel="noopener">open-sourced in 2024</a> under the MIT licence. CSS-DOS boots it unmodified from its own emulated floppy, alongside <b>FreeDOS EDIT</b> (<a href="https://www.freedos.org/" class="ext-link" target="_blank" rel="noopener">freedos.org</a>) as its text editor.
    </li>
  </ul>

  <SectionHead>Software on the shelf</SectionHead>
  <ul class="credits-list">
    <li>
      <b>DOOM</b> runs via <a href="https://github.com/FrenkelS/Doom8088" class="ext-link" target="_blank" rel="noopener">Doom8088</a> by Frenkel Smeijers - the port of id Software&rsquo;s DOOM to the 16-bit 8088/8086, with the shareware episode&rsquo;s data.
    </li>
    <li>
      <b>Microsoft Windows 1.01</b> (1985) boots on the MS-DOS 4.00 floppy above, unmodified. &copy;&nbsp;Microsoft.
    </li>
  </ul>

  <SectionHead>Assets</SectionHead>
  <ul class="credits-list">
    <li>
      Font (headings, code, chrome): &ldquo;Web437 IBM VGA&rdquo; by VileR, from the <a href="https://int10h.org/oldschool-pc-fonts/" class="ext-link" target="_blank" rel="noopener">Oldschool PC Font Pack</a> (int10h.org) - CC&nbsp;BY-SA&nbsp;4.0.
    </li>
    <li>
      Font (body text): &ldquo;<a href="https://laemeur.sdf.org/fonts/" class="ext-link" target="_blank" rel="noopener">More Perfect DOS VGA</a>&rdquo; by L&AElig;MEUR, remastering Zeh Fernando&rsquo;s &ldquo;Perfect DOS VGA 437&rdquo;; IBM designed the glyphs. Free for all use.
    </li>
  </ul>
</div>

<style>
  .subpage {
    max-width: 680px;
    margin-inline: auto;
  }
  .credits-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .credits-list li {
    position: relative;
    padding-left: 20px;
    margin-bottom: 10px;
    font-size: 16px;
    line-height: 19px;
  }
  .credits-list li::before {
    content: '>';
    position: absolute;
    left: 0;
    color: var(--edit-red);
  }
</style>
