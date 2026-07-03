<script>
  // TricksPage — "How it works" sub-page: the recurring workarounds,
  // for the curious. Facts from CABINET-ANATOMY.md ("Recurring tricks").
  import '../styles/_fragments/anatomy.css';
  import SignDemo from './SignDemo.svelte';
</script>

<div class="subpage" data-subpage="7">
  <h1>Tricks</h1>
  <p>
    Everything so far needed a workaround; these are the ones too good
    to leave out. Nothing later depends on them &mdash; this page is for
    the curious.
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
    below B; <code>max</code> clamps the other cases to 0; the
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
    on single bits, <b>AND is multiplication</b>: 1&times;1 is 1,
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

  <h3 class="anatomy-head">The browser&rsquo;s own limits</h3>
  <p>
    Chrome caps a CSS function at about 7 local variables and
    won&rsquo;t nest one custom function call inside another&rsquo;s
    arguments. A lot of the file&rsquo;s arithmetic is hand-flattened
    to fit &mdash; <code>mod(x, 256)</code> spelled out inline instead
    of calling a tidy helper. The code is shaped by a real
    browser&rsquo;s enforcement: if Chrome can&rsquo;t evaluate it, it
    isn&rsquo;t CSS.
  </p>
</div>
