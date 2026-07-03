<script>
  // The keyboard & debug display — the smallest section, 4 KB doing
  // two jobs. Copy recycled from the retired "Screen, keys, time" and
  // "The CPU" pages; facts from CABINET-ANATOMY.md §7.
  import Foldable from '../Foldable.svelte';
  import KeyboardDemo from '../KeyboardDemo.svelte';
</script>

<p>
  The smallest section in the file, and it does two jobs: keys go in,
  and a debugger&rsquo;s view of the machine comes out.
</p>

<h3 class="anatomy-head">The keys</h3>
<p>
  CSS has no input events. The one thing it can ask is
  <b><code>:active</code></b> &mdash; &ldquo;is this element being
  pressed, right now?&rdquo; The player&rsquo;s on-screen keys are real
  buttons, and these are the cabinet&rsquo;s actual rules:
</p>

<KeyboardDemo />

<Foldable>
  {#snippet summary()}The release-code latch{/snippet}
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
</Foldable>

<h3 class="anatomy-head">The debug display</h3>
<p>
  A wrong bit anywhere in the machine corrupts it silently, and none of
  a programmer&rsquo;s normal tools exist inside a stylesheet &mdash;
  no breakpoints, no logging, no stepping. The machine&rsquo;s one
  debugging aid: the CPU prints its own registers to the screen using
  CSS <b>counters</b>, because <code>counter()</code> is the only way
  CSS can turn a number into visible text. Fourteen numbers on screen,
  updating as it runs. That read-out is what this project was built
  with.
</p>

<div class="callout">
  <span class="callout-label">HONEST LIMITS</span>
  <p>
    CSS cannot see your physical keyboard &mdash; no selector reacts to
    a real keypress, so every program is piloted from the on-screen
    keys. And CSS cannot make sound &mdash; the PC speaker stays
    silent.
  </p>
</div>
