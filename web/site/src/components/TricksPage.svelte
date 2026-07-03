<script>
  // TricksPage — Learn sub-page "Tricks". Each block is one capability
  // CSS lacks and the workaround the cabinet uses. Sourced from
  // CABINET-ANATOMY.md ("Recurring tricks" + per-section notes).
  import '../styles/_fragments/anatomy.css';
  import SignDemo from './SignDemo.svelte';
</script>

<div class="subpage" data-subpage="9">
  <h1>Tricks</h1>
  <p>
    Building a CPU in a styling language means constantly hitting
    things CSS doesn&rsquo;t have. Every workaround in the file follows
    the same pattern: <b>CSS lacks something, so it&rsquo;s rebuilt
    from what&rsquo;s left.</b> These are the ones worth knowing.
  </p>

  <h3 class="anatomy-head">No comparisons</h3>
  <p>
    <code>calc()</code> can add, subtract, multiply and divide. It
    cannot ask <i>is A less than B?</i> &mdash; there is no
    <code>&lt;</code>. A CPU asks constantly: the carry flag is
    literally &ldquo;did this subtraction dip below zero?&rdquo;. The
    workaround is <code>sign()</code>, which returns &minus;1, 0 or +1:
  </p>
  <pre class="byte-example"><code>max(<span class="tok-num">0</span>, sign(B - A - <span class="tok-num">0.5</span>))    <span class="tok-comment">/* 1 if A &lt; B, else 0 */</span></code></pre>
  <p>
    <code>sign(B&nbsp;&minus;&nbsp;A)</code> is +1 exactly when A is
    below B; <code>max</code> clamps the other cases to 0. The
    <code>&minus;&nbsp;0.5</code> keeps the expression away from the
    ambiguous exact-tie case. This one line computes the carry flag
    and the screen&rsquo;s 70-times-a-second retrace signal. Here it
    is running:
  </p>

  <SignDemo />

  <h3 class="anatomy-head">No if/else inside arithmetic</h3>
  <p>
    Mid-expression, there&rsquo;s no way to write &ldquo;if flag, then
    A, else B&rdquo;. But every yes/no answer is already a 0 or a 1
    &mdash; so choosing is multiplication:
  </p>
  <pre class="byte-example"><code>flag * A + (<span class="tok-num">1</span> - flag) * B    <span class="tok-comment">/* A if flag is 1, else B */</span></code></pre>
  <p>
    The same trick <i>skips</i> a memory write: when a write
    shouldn&rsquo;t happen, this arithmetic turns its target address
    into &minus;1 &mdash; an address no memory cell matches, so the
    write lands nowhere.
  </p>

  <h3 class="anatomy-head">No bitwise operations</h3>
  <p>
    A CPU lives on AND, OR, XOR. CSS arithmetic has none of them. But
    on single bits, <b>AND is just multiplication</b>: 1&times;1 is 1,
    everything else is 0. So the AND function splits both numbers into
    their 16 bits (divide and take remainders), multiplies each pair,
    and reassembles the result:
  </p>
  <pre class="byte-example"><code>  <span class="tok-num">202</span>  =  1 1 0 0 1 0 1 0
  <span class="tok-num">172</span>  =  1 0 1 0 1 1 0 0
          <span class="tok-comment">— multiply each column —</span>
  <span class="tok-num">136</span>  =  1 0 0 0 1 0 0 0</code></pre>
  <p>
    OR and XOR fall out of the same idea: per bit,
    OR&nbsp;=&nbsp;<code>min(1, a + b)</code>,
    XOR&nbsp;=&nbsp;<code>a + b &minus; 2ab</code>,
    NOT&nbsp;=&nbsp;<code>1 &minus; a</code>. These functions run
    millions of times.
  </p>

  <h3 class="anatomy-head">Too awkward to compute? Bake a table</h3>
  <p>
    Some values are painful to derive live, so they&rsquo;re computed
    at build time and shipped as a read-only <code>if()</code> lookup.
    The 8086&rsquo;s <b>parity flag</b> needs the number of 1-bits in a
    byte &mdash; rather than count bits in CSS, the file carries the
    answer for all 256 byte values. Shifting by a variable amount needs
    2&#8319;, which <code>calc()</code> can&rsquo;t express &mdash; so
    0&ndash;31&nbsp;&rarr;&nbsp;2&#8319; is a 32-entry table. The
    floppy disk is the same idea at scale: one arm per byte.
  </p>

  <h3 class="anatomy-head">No negative numbers</h3>
  <p>
    CSS numbers aren&rsquo;t 16-bit and have no sign bit, but 8086
    registers must wrap: 65535&nbsp;+&nbsp;1 is 0, and values from
    32768 up mean negative. So the file folds by hand, everywhere:
  </p>
  <pre class="byte-example"><code>x - (x &ge; <span class="tok-num">32768</span> ? <span class="tok-num">65536</span> : <span class="tok-num">0</span>)    <span class="tok-comment">/* as signed 16-bit */</span></code></pre>
  <p>
    That&rsquo;s why <code>256</code> and <code>65536</code> appear all
    over the file &mdash; results being folded back into range exactly
    the way real registers overflow.
  </p>

  <h3 class="anatomy-head">No loops</h3>
  <p>
    A tick is defined as one instruction; there is no way to loop
    inside one. But <code>REP MOVSB</code> &mdash; the 8086&rsquo;s
    block-copy, used constantly &mdash; is supposed to copy CX bytes in
    a single instruction. The fix: copy <i>one</i> byte, decrement CX,
    and &mdash; if CX is still above zero &mdash; set the next
    instruction address to point back at <b>itself</b>. Next tick, the
    CPU fetches the very same instruction and copies the next byte.
  </p>
  <pre class="byte-example"><code>0x1000    MOV  CX, 8
<span class="tok-num">0x1003</span> &#9484;&#8594; <span class="tok-prop">REP MOVSB</span>       <span class="tok-comment">/* copy 1 byte; CX = CX &minus; 1 */</span>
       &#9492;&#9472; next IP = <span class="tok-num">0x1003</span> while CX &gt; 0
0x1005    CMP  AX, BX     <span class="tok-comment">/* reached only when CX = 0 */</span></code></pre>
  <p>
    From the outside it looks like one instruction copying a block;
    underneath, the clock re-runs it CX times.
  </p>

  <h3 class="anatomy-head">No events, no history</h3>
  <p>
    <code>:active</code> is true while a key is held and gone the
    instant it isn&rsquo;t &mdash; CSS keeps no record that anything
    happened. Real keyboards send a <i>release code</i> when a key
    comes up, and games depend on it (it&rsquo;s how Doom knows you
    stopped moving). Here, &ldquo;the key came up&rdquo; is only
    visible for a single tick, and the program usually doesn&rsquo;t
    check the keyboard until a few ticks later. So the machine keeps a
    <b>latch</b>: one remembered value holding the most recent key
    code, press or release, until the next one replaces it. A latch is
    just another spreadsheet cell &mdash; <i>new key event this tick?
    take its code; otherwise keep mine.</i>
  </p>

  <h3 class="anatomy-head">The browser&rsquo;s own limits</h3>
  <p>
    Chrome caps a CSS function at about 7 local variables and
    won&rsquo;t nest one custom function call inside another&rsquo;s
    arguments. A lot of the file&rsquo;s arithmetic is hand-flattened
    to fit &mdash; <code>mod(x, 256)</code> spelled out inline instead
    of calling a tidy helper. The code is shaped by a real
    browser&rsquo;s enforcement, which is the point: if Chrome
    can&rsquo;t evaluate it, it isn&rsquo;t CSS.
  </p>
</div>
