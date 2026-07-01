<script>
  import '../styles/_fragments/play.css';
</script>

<!-- Play-step intro -->
<div class="play-intro">
  <h1>Running the <code>.css</code> file</h1>
  <p>
    You can <i>try</i> to load a 300&nbsp;MB stylesheet into your
    browser, but it will crash. Browsers simply weren&rsquo;t built
    for that.
  </p>
  <p>
    So I built a separate tool &mdash; <b>Calcite</b> &mdash; a JIT
    compiler for computational CSS. It&rsquo;s much like Chrome&rsquo;s
    own V8 engine, which compiles your JavaScript down to machine code
    before running it rather than plodding through the source line by
    line. Calcite does the same trick for CSS: it&rsquo;s written in
    Rust, ships as WebAssembly, and runs entirely inside the browser
    tab.
  </p>
  <p>
    On load it walks the whole stylesheet once, recognises the
    repetitive shapes a CPU emulator forces CSS into, and compiles
    them into fast native routines. Then it evaluates one frame,
    paints, and loops &mdash; orders of magnitude faster than a browser
    doing the same work by hand.
  </p>

  <!-- "Is this cheating?" — most of the argument folded away. -->
  <details class="cheat-box">
    <summary>
      <span class="cheat-q">Is this cheating?</span>
      <span class="cheat-a">No, and I've taken the question seriously.</span>
    </summary>
    <div class="cheat-body">
      <p>
        The whole point of the project is that the program is written
        in <i>real</i>, spec-compliant CSS. Calcite is allowed to make
        that CSS fast, but it is not allowed to change what the CSS
        <i>means</i>. Three things keep it honest:
      </p>
      <ol class="cheat-list">
        <li>
          <b>Compiling before running is normal.</b> Chrome does
          exactly this to your JavaScript via V8; the code you wrote is
          still JavaScript. Almost no language runs from raw source &mdash;
          even CPython compiles your <code>.py</code> files to bytecode
          and runs <i>that</i>. Calcite is the same idea pointed at CSS.
        </li>
        <li>
          <b>The CSS would run identically without Calcite.</b> Feed
          the exact same cabinet to Chrome&rsquo;s own style engine and
          you get the same pixels &mdash; just unbearably slowly. Calcite
          changes the speed, never the result.
        </li>
        <li>
          <b>Calcite knows nothing about DOS, x86, or Doom.</b> This is
          the cardinal rule of the project: Calcite only ever reasons
          about the <i>shape</i> of CSS. It has no idea it&rsquo;s running
          an emulator. Point it at any other computational stylesheet
          &mdash; a different CPU, a cellular automaton, a spreadsheet
          encoded in selectors &mdash; and it would speed those up too.
          Nothing about this machine is baked in.
        </li>
      </ol>
      <p class="dim small">
        If Calcite ever produced a different result than a real browser
        would, that would be a bug in Calcite &mdash; not a feature.
      </p>
    </div>
  </details>
</div>

<!-- Two run options — small, side by side. -->
<div class="run-options">
  <a class="run-opt run-raw" id="play-raw-card" href="/player/raw.html" target="_blank" rel="noopener">
    <div class="run-opt-head">Run raw CSS in Chrome</div>
    <p class="run-opt-sub">Expect one or two frames per <i>month</i>.</p>
    <div class="run-opt-warn">
      <span class="warn-glyph">&#9888;</span>
      <span>This <u>will</u> crash the browser. Use with caution and
      save your work. Not recommended.</span>
    </div>
  </a>

  <a class="run-opt run-calcite" id="play-calcite-card" href="/player/calcite.html" target="_blank" rel="noopener">
    <div class="run-opt-head">
      Run using Calcite
      <span class="run-opt-rec">recommended</span>
    </div>
    <p class="run-opt-sub">
      The loaded page is still entirely HTML and CSS &mdash; Calcite
      just evaluates it sanely.
    </p>
  </a>
</div>
