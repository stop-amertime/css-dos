<script>
  // The keyboard section — 4 KB of :active key rules.
  import KeyboardDemo from '../KeyboardDemo.svelte';
  import Callout from '../Callout.svelte';
  import CodeCss from '../CodeCss.svelte';
  import SectionHead from '../SectionHead.svelte';

  const KBD_PRESS = `--_kbdPress: if(
  style(--keyboard: 0): 0;               /* nothing held now → no press */
  style(--prevKeyboard-prev: 0): 1;  /* held now, empty last tick → a press! */
  else: 0);`;

  const HOLD_CHECKBOX = `&:has(#kb-holdmode:checked) { --kbdHold: 1; }`;

  const HOLD_SLOT = `/* slot 2 claims the key only if slots 0 and 1 are taken */
--_kbdApp2: if(
  style(--_kbdLatch: 0): 0;
  style(--kbdHeld0-prev: 0): 0;
  style(--kbdHeld1-prev: 0): 0;
  style(--kbdHeld2-prev: 0): 1;
  else: 0);`;
</script>

<p>
  The smallest section in the file, and the machine&rsquo;s only window to the outside world.
</p>
<p>
  CSS has no input events. The one relevant selector it has is <b><code>:active</code></b>, which asks &ldquo;is this element being pressed currently?&rdquo; The player has a series of buttons labelled with keyboard keys, and the cabinet simply checks if they are currently being pressed, and sets the <code>--keyboard</code> variable to a specific and suspiciously large number.
</p>

<KeyboardDemo />

<p>
Mouse support is actually <i>easier</i> than keyboard support - I just detect the screen pixel divs being clickable using <code>:active</code>, and report a mouse click event in the relevant location. 
</p>

<SectionHead>Detecting presses and releases</SectionHead>
<p>
  <code>:active</code> can only answer one question: <i>is this element held down now?</i> However, a program only gets round to asking the keyboard hundreds of ticks afterwards. CSS speaks in the present tense; the PC demands past tense.
</p>
<p>
  So the past is reconstructed, like in Crimewatch. The variable <code>--prevKeyboard</code> remembers what <code>--keyboard</code> said one tick ago - its entire definition is &ldquo;copy the current value&rdquo;, and the <a href="#about/file/clock">clock section</a>&rsquo;s handover plumbing makes the copy arrive a tick late, which for once is exactly what we want. Compare the two and you get <i>events</i> out of a <i>state</i>:
</p>
<CodeCss code={KBD_PRESS} />

<SectionHead>The release-code latch</SectionHead>
<p>
  A press edge is one tick wide - under Calcite, gone in about 1/400,000th of a second. So it&rsquo;s immediately <b>latched</b>: a variable holds the most recent key event until the next one replaces it, where the program can read it at its leisure. Releases get the same treatment - real keyboards send a <i>release</i> code when a key comes up, and games depend on it to know when you&rsquo;ve stopped moving - so letting go is detected as an event too, and latched the same way.
</p>

<SectionHead>Hold mode</SectionHead>
<p>
  A subtler problem: you only have one mouse pointer, so it&rsquo;s impossible to use a shortcut like CTRL+G. So the player has a hold mode, which works by checking if a checkbox is <code>:checked</code>:
</p>
<CodeCss code={HOLD_CHECKBOX} />
<p>
  This is the only button that has no real keyboard key equivalent. While this mode is on, key releases and mouse releases are filed away instead of delivered. Letting go of a key drops its code into one of eight numbered pigeonholes (<code>--kbdHeld0</code> through <code>--kbdHeld7</code>; CSS has no arrays, so a queue is eight variables and willpower).
</p>
<p>
  Uncheck &lsquo;Hold Mode&rsquo; and the machine simulates one release per opportunity, politely paced, each new one synthesised only after the program&rsquo;s interrupt handler has fully digested the previous.
</p>
<p>
  And, you guessed it: each pigeonhole individually evaluates whether it&rsquo;s the one being filled, by checking if each one below it is full:
</p>
<CodeCss code={HOLD_SLOT} />
