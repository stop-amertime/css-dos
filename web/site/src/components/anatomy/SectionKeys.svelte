<script>
  // The keyboard & debug display — the smallest section, 4 KB doing
  // two jobs. Copy recycled from the retired "Screen, keys, time" and
  // "The CPU" pages; facts from CABINET-ANATOMY.md §7.
  import KeyboardDemo from '../KeyboardDemo.svelte';
  import CodeCss from '../CodeCss.svelte';

  const DEBUG_OUT = `.cpu::after {
  counter-reset: AX var(--AX) BX var(--BX) CX var(--CX) … IP var(--IP);
  content: "\\a --AX: " counter(AX) "\\a --BX: " counter(BX) …;
}`;
</script>

<p>
  The smallest section in the file. Alongside the keyboard rules it
  carries a small debug read-out &mdash; the registers drawn on screen
  with CSS counters &mdash; but the interesting part is the keys.
</p>
<p>
  CSS has no input events. The one thing it can ask is
  <b><code>:active</code></b> &mdash; &ldquo;is this element being
  pressed, right now?&rdquo; The player&rsquo;s on-screen keys are real
  buttons, and these are the cabinet&rsquo;s actual rules:
</p>

<KeyboardDemo />

<h3 class="anatomy-head">The release-code latch</h3>
<p>
  Real keyboards also send a <i>release</i> code when a key comes
  back up, and games depend on it &mdash; it&rsquo;s how Doom knows
  you stopped moving. But <code>:active</code> only stops matching
  for the single instant you let go, and programs usually don&rsquo;t
  check the keyboard until a few ticks later &mdash; by then that
  instant is gone, and the key would look held down forever. So the
  machine keeps a <b>latch</b>: one variable holding the most recent
  key event, press or release, until the next one replaces it.
</p>

<h3 class="anatomy-head">The debug read-out</h3>
<p>
  The section&rsquo;s other job is printing the registers on screen,
  which runs into a missing tool: CSS has no way to display a number.
  <code>content</code> only prints text, and nothing converts the
  integer in <code>--AX</code> into the characters &ldquo;31022&rdquo;.
  The one thing in CSS that takes an integer and produces digits is a
  <b>counter</b> &mdash; the machinery meant for numbering chapters
  and list items. So the registers are displayed as chapter numbers:
</p>
<CodeCss code={DEBUG_OUT} />

<div class="callout">
  <span class="callout-label">HONEST LIMITS</span>
  <p>
    CSS cannot see your physical keyboard &mdash; no selector reacts to
    a real keypress, so every program is piloted from the on-screen
    keys. And CSS cannot make sound &mdash; the PC speaker stays
    silent.
  </p>
</div>
