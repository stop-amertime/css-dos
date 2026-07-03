<script>
  // Memory — write formulas: the 171 MB write rules, the biggest
  // thing in the file. Copy recycled from the retired "Stumbling
  // block" page; facts from CABINET-ANATOMY.md §6, §13.
  import Foldable from '../Foldable.svelte';
  import RamWrite from '../RamWrite.svelte';
</script>

<p>
  The single biggest section of the file, and the reason for most of
  its size. It exists because of the difference between CSS and every
  other language.
</p>
<p>
  Basically all programming languages are a list of instructions, like
  a <i>recipe</i>. For example <code>x = y</code>. The instructions are
  actioned in order. A stylesheet is very different. It has no order:
  every rule in it is in force the whole time &mdash; more like a
  blueprint or a diagram. You cannot tell CSS to <i>do</i> things. You
  can only declare, once, what a thing <i>is</i>:
</p>
<pre class="byte-example"><code><span class="tok-prop">--x</span>: blue;</code></pre>
<p>
  In other words, we can only define X ONCE, and can&rsquo;t change it
  later. This is clearly going to be a massive pain in the arse, but
  CSS is Turing complete, so there must be a way around it.
</p>
<p>
  We create a &lsquo;write slot&rsquo; &mdash; a variable that just
  holds the address and value of a change to memory. Then, we define X
  as a function that looks at the write slot to see if it has been
  updated to a new value, and if not, it keeps its old value.
</p>
<p class="small">
  (Some instructions change up to six bytes at once, so we need
  multiple write slots!)
</p>

<RamWrite />

<p>
  Now, the catch &mdash; this formula has to be rerun EVERY SINGLE TIME
  anything happens, even if that variable wasn&rsquo;t changed.
</p>
<p>
  In a normal programming language, <code>y = &lt;value&gt;</code> only
  affects Y &mdash; one check, done.
</p>
<p>
  In CSS, an instruction might write one byte, and 650,000 formulas
  must be rerun to check whether the write was about them. Often, a CPU
  instruction doesn&rsquo;t write <i>any</i> bytes, but they all still
  have to check. This is absurdly wasteful.
</p>
<p class="punchline">
  More than half the file (171&nbsp;MB) is this single formula, written
  out once per byte.
</p>

<Foldable>
  {#snippet summary()}Why exactly three write slots{/snippet}
  <p>
    The worst case is a hardware interrupt or an <code>INT</code>
    instruction, which pushes three 16-bit words onto the stack in a
    single tick &mdash; the flags, the code segment, and the return
    address. Everything else needs fewer, so three slots cover the
    whole instruction set.
  </p>
  <p>
    Each slot also carries a <b>live gate</b> &mdash; a 0/1 saying
    whether it fires this tick. Most instructions don&rsquo;t write
    memory at all, and the gate lets all 650,000 write formulas
    short-circuit at once: &ldquo;no slot is live, nothing changes&rdquo;
    &mdash; without checking a million addresses one by one.
  </p>
</Foldable>
