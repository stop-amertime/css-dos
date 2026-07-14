<script>
  // TickFlow - one tick as a flowchart (static). The ring of variables:
  // IP → program bytes → opcode → register formulas + write slots →
  // memory formulas → a new IP. Around it, the animation, once per lap.
  // Spec: ABOUT-SCRIPT.md, "Where's the computer?".
</script>

<div class="tick-flow">
  <svg viewBox="0 0 700 268" role="img"
       aria-label="One tick as a flowchart: IP leads to the program bytes at that address, to the opcode, to the register formulas and write slots, to the memory formulas, and back to a new IP. A dashed ring marks the animation driving one lap per tick.">
    <defs>
      <marker id="tf-arrow" viewBox="0 0 10 10" refX="9" refY="5"
              markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--edit-black)"/>
      </marker>
    </defs>

    <!-- the animation ring -->
    <rect x="10" y="10" width="680" height="222" fill="none"
          stroke="#aa0000" stroke-width="1.5" stroke-dasharray="6 5"/>
    <text x="350" y="256" text-anchor="middle" font-size="13"
          fill="#aa0000" font-family="inherit">the animation - one lap = one tick</text>

    <!-- top row: IP → bytes → opcode -->
    <rect x="36" y="34" width="108" height="46" fill="var(--edit-white)" stroke="var(--edit-black)" stroke-width="1.5"/>
    <text x="90" y="62" text-anchor="middle" font-size="14" font-family="inherit" fill="var(--edit-black)">--IP</text>

    <line x1="144" y1="57" x2="196" y2="57" stroke="var(--edit-black)" stroke-width="1.5" marker-end="url(#tf-arrow)"/>

    <rect x="200" y="34" width="212" height="46" fill="var(--edit-white)" stroke="var(--edit-black)" stroke-width="1.5"/>
    <text x="306" y="54" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--edit-black)">the program bytes</text>
    <text x="306" y="70" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--edit-black)">at that address</text>

    <line x1="412" y1="57" x2="464" y2="57" stroke="var(--edit-black)" stroke-width="1.5" marker-end="url(#tf-arrow)"/>

    <rect x="468" y="34" width="130" height="46" fill="var(--edit-white)" stroke="var(--edit-black)" stroke-width="1.5"/>
    <text x="533" y="62" text-anchor="middle" font-size="14" font-family="inherit" fill="var(--edit-black)">--opcode</text>

    <!-- down: opcode → register formulas -->
    <line x1="533" y1="80" x2="533" y2="142" stroke="var(--edit-black)" stroke-width="1.5" marker-end="url(#tf-arrow)"/>

    <!-- bottom row: register formulas → memory formulas -->
    <rect x="380" y="146" width="290" height="56" fill="var(--edit-white)" stroke="var(--edit-black)" stroke-width="1.5"/>
    <text x="525" y="168" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--edit-black)">register formulas + write slots</text>
    <text x="525" y="188" text-anchor="middle" font-size="13" font-family="inherit" fill="#555">--AX &hellip; --flags, a new --IP</text>

    <line x1="380" y1="174" x2="300" y2="174" stroke="var(--edit-black)" stroke-width="1.5" marker-end="url(#tf-arrow)"/>

    <rect x="86" y="146" width="210" height="56" fill="var(--edit-white)" stroke="var(--edit-black)" stroke-width="1.5"/>
    <text x="191" y="168" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--edit-black)">memory formulas</text>
    <text x="191" y="188" text-anchor="middle" font-size="13" font-family="inherit" fill="#555">~650,000 cells</text>

    <!-- close the ring: back up to IP, next tick -->
    <line x1="90" y1="146" x2="90" y2="84" stroke="var(--edit-black)" stroke-width="1.5" marker-end="url(#tf-arrow)"/>
    <text x="98" y="120" font-size="12" font-family="inherit" fill="#555">next tick</text>
  </svg>
  <p class="caption">
    There is no engine underneath. Every box is a variable defined in
    terms of the boxes behind it, and the animation makes the whole ring
    re-derive once per lap.
  </p>
</div>

<style>
  .tick-flow {
    margin: 12px 0;
    border: 1px solid var(--edit-black);
    background: var(--edit-white);
    box-shadow: 4px 4px 0 var(--edit-black);
    padding: 10px 12px 2px;
  }
  .tick-flow svg { display: block; width: 100%; height: auto; }
  .tick-flow .caption {
    margin: 8px 0;
    font-size: 13px;
    line-height: 17px;
    color: #555;
  }
</style>
