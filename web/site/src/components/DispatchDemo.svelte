<script>
  // DispatchDemo — a real, working miniature of the cabinet's register
  // dispatch table. The buttons pick an opcode; the new AX value is
  // computed IN CSS by the if()/calc() rule in dispatch-demo.css and
  // rendered with the counter-reset trick. JS only sets --demo-opcode.
  // Opcodes are the real 8086 encodings (0x05 ADD AX,imm16 = 5,
  // 0x2D SUB AX,imm16 = 45, 0xB8 MOV AX,imm16 = 184, 0x90 NOP = 144).
  import '../styles/_fragments/dispatch-demo.css';

  const OPS = [
    { code: 5,   label: 'ADD AX, 3' },
    { code: 45,  label: 'SUB AX, 3' },
    { code: 184, label: 'MOV AX, 42' },
    { code: 144, label: 'NOP' },
  ];
  let opcode = $state(144);
</script>

<div class="dispatch-demo" style="--demo-opcode: {opcode}">
  <div class="dispatch-ops" role="group" aria-label="Pick an instruction">
    {#each OPS as op}
      <button
        class="demo-toggle"
        class:current={opcode === op.code}
        onclick={() => (opcode = op.code)}
      >{op.label}</button>
    {/each}
  </div>

  <pre class="dispatch-code"><code><span class="tok-prop">--AX</span>: <span class="tok-fn">if</span>(
  <span class="arm" class:current={opcode === 5}><span class="tok-fn">style</span>(<span class="tok-prop">--opcode</span>: <span class="tok-num">5</span>):   <span class="tok-fn">calc</span>(<span class="tok-fn">var</span>(<span class="tok-prop">--AX-old</span>) + 3);  <span class="tok-comment">/* ADD */</span></span>
  <span class="arm" class:current={opcode === 45}><span class="tok-fn">style</span>(<span class="tok-prop">--opcode</span>: <span class="tok-num">45</span>):  <span class="tok-fn">calc</span>(<span class="tok-fn">var</span>(<span class="tok-prop">--AX-old</span>) - 3);  <span class="tok-comment">/* SUB */</span></span>
  <span class="arm" class:current={opcode === 184}><span class="tok-fn">style</span>(<span class="tok-prop">--opcode</span>: <span class="tok-num">184</span>): <span class="tok-num">42</span>;                    <span class="tok-comment">/* MOV */</span></span>
  <span class="arm arm-else" class:current={opcode === 144}><span class="tok-fn">else</span>: <span class="tok-fn">var</span>(<span class="tok-prop">--AX-old</span>)               <span class="tok-comment">/* unchanged */</span></span>
);</code></pre>

  <div class="dispatch-result">
    <span class="dim">AX was <b>5</b> &rarr; new</span>
    <span class="ax-box">AX = <span class="ax-value"></span></span>
    <span class="dim small">computed live by the if() above (real CSS, not JS)</span>
  </div>

  <p class="caption">
    This is the processor. For <b>each of the 16 registers</b>, the
    cabinet has one of these tables with an arm for every instruction
    the 8086 knows &mdash; a few hundred arms instead of four. Every
    tick, all 16 evaluate at once, and that is one instruction executed.
  </p>
</div>
