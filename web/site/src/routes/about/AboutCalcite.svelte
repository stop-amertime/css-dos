<script>
  // Calcite — how the file actually runs, and the five
  // keeps-it-honest rules.
  import SectionHead from '../../components/SectionHead.svelte';
  import Term from '../../components/Term.svelte';
</script>

<div class="subpage">
  <h1>Calcite</h1>
  <p>
    Chrome has no issue loading a <Term t="css">CSS</Term> file up to 536&nbsp;MB (V8&rsquo;s string limit), but trying to <i>evaluate</i> 300&nbsp;MB of spaghetti-CSS results in an immediate freeze. Even if equipped to handle such a task, it would take three weeks to boot DOS, three months for Doom to load in, and would run that at 0.00001&nbsp;fps. So we have a working computer in a stylesheet, but no way to run it.
  </p>
  <p>
    Every programming language has this problem: source code is written for humans, and running it directly just <i>is</i> slow. And every language solves it the same way: <b>compile the source into something faster before running it.</b> Chrome compiles JavaScript to machine code before running it (the V8 engine, written in C++), as does every other browser. Python quietly compiles <code>.py</code> to bytecode before running it. Almost nothing runs from raw source these days except shell scripts and declarative languages like CSS.
  </p>
  <p>
    Nobody had previously written a compiler that <i>runs</i> CSS, because nobody had ever been foolish enough to need one. Thus, CSS-DOS grew a second project: a compiler of its own, which took about as long to build as the CSS-generating half of the project.
  </p>
  <p>
    <b>Calcite</b> is a <Term t="jit">JIT compiler</Term> for computational CSS &mdash; written in Rust, shipped as <Term t="wasm">WebAssembly</Term>, running in the background and operating on a player page which is itself entirely HTML/CSS (mimicking the model of an in-browser engine like V8). On load, it reads the whole stylesheet once and recognises the repetitive shapes that an emulated computer forces CSS into &mdash; the 368,256 near-identical write formulas, the colossal lookup functions, the register tables. It compiles those shapes into native routines, over 200,000&times; faster than the above baseline speed.
  </p>
  <p class="dim small">
    (In a perfect world I&rsquo;d insert Calcite into Chrome&rsquo;s own style engine and the site would need nothing else. You can&rsquo;t patch Chrome from a website, so Calcite lives as WebAssembly instead, in a service worker which calculates the video output and streams it to the tab. I considered creating a fast-CSS browser, but nobody wants to download a whole browser just to play around with one website these days.)
  </p>

  <SectionHead>Is this cheating?</SectionHead>
  <p>
    A fair question &mdash; if a separate program is doing the heavy lifting, is the CSS just decoration? I&rsquo;ve taken this seriously, because the entire point of the project is that the machine is written in real, spec-compliant CSS. To ensure this, Calcite is bound by five self-imposed rules, which are on the stricter side where possible. The first is the project&rsquo;s cardinal rule:
  </p>
  <ol class="cheat-list">
    <li>
      <b>Calcite must produce EXACTLY what a spec-compliant browser would &mdash; byte for byte.</b> This is the &lsquo;cardinal rule&rsquo;, front and centre in the documentation. Feed the same cabinet to Chrome&rsquo;s own style engine and you&rsquo;d get the exact same behaviour, just unbearably slowly. I have not allowed ONE BYTE of divergence in my conformance testing &mdash; no fast approximations, no cut corners or hacking. If Calcite disagrees with a spec-compliant browser, that&rsquo;s a bug in Calcite. The CSS IS the source code, and Calcite is its servant &mdash; perfect, or nothing.
    </li>
    <li>
      <b>Calcite must parse a .css file on-the-spot and blind &mdash; no AOT compilation, no pre-baking.</b> It compiles whatever arrives at load time, in the browser, the same way V8 takes whatever JavaScript arrives: everything inferred from the file itself, immediately. And an even stricter rule: it must be the same file. Not one byte added, changed, or removed to make Calcite&rsquo;s life easier &mdash; it can only interpret and recreate.
    </li>
    <li>
      <b>The player page must contain ZERO JavaScript &mdash; only HTML/CSS.</b> Calcite lives in a separately-loaded service worker, mimicking an in-browser engine like V8, and the screen is fed back to the tab through an HTML element. I could easily support the real keyboard, improve performance, etc. with JavaScript on the player page. But it wouldn&rsquo;t be right.
    </li>
    <li>
      <b>Calcite must be generic &mdash; no knowledge of x86, DOS, or this repo.</b> It doesn&rsquo;t know it&rsquo;s compiling a CPU, and it never finds out what the program does &mdash; it only ever reasons about the shape of the CSS. Since CSS has so few tools, the shapes are enumerable in advance even with no idea what they&rsquo;re for. Point it at a different computational stylesheet &mdash; another CPU, a Pong cabinet, a cellular automaton, a spreadsheet encoded in selectors &mdash; and it would speed those up just the same.
    </li>
    <li>
      <b>The CSS may not signal to Calcite in an unnatural way.</b> Plenty of languages allow compiler hints in the source, JavaScript once had a whole dialect of them (asm.js and its &ldquo;use asm&rdquo; pragma, killed off when WASM arrived). Forbidden here. Not only is the stylesheet spec-compliant, but it can&rsquo;t smuggle in anything <i>above and beyond</i> the spec either. No hints hidden in comments, no sleight of hand.
    </li>
  </ol>
</div>

<style>
  .subpage {
    max-width: 680px;
    margin-inline: auto;
  }
  /* The five keeps-it-honest points. */
  .cheat-list {
    margin: 0;
    padding-left: 22px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
</style>
