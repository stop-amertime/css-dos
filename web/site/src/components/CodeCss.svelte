<script>
  // CodeCss — a static CSS snippet coloured by the same Prism that
  // highlights the Build page's cabinet source viewer, replacing the
  // hand-written .tok-* spans the About blocks used to carry. Pass
  // the snippet as a plain string (template literal); token colours
  // are the .byte-example .token rules in about.css. Interactive
  // widgets that animate values inside their code keep manual spans —
  // this is for static extracts only.
  import Prism from '../lib/prism.js';

  let { code } = $props();
  const html = $derived(Prism.highlight(code, Prism.languages.css, 'css'));
</script>

<pre class="byte-example"><code>{@html html}</code></pre>
