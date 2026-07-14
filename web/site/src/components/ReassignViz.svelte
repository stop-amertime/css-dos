<script>
  // ReassignViz - "in any other language, a variable can change later":
  // x = 2, then an arrow labelled "later…", then x = 4. Small standalone
  // proof-of-concept, styled like the other About widgets (box + shadow).
</script>

<div class="reassign-viz" id="reassign-viz">
  <div class="rv-code">x = 2</div>
  <div class="rv-arrow">
    <span class="rv-arrow-label">later&hellip;</span>
    <svg viewBox="0 0 120 24" preserveAspectRatio="none" aria-hidden="true">
      <line x1="2" y1="20" x2="110" y2="20" stroke="#aa0000" stroke-width="3"/>
      <polygon points="110,13 120,20 110,27" fill="#aa0000"/>
    </svg>
  </div>
  <div class="rv-code">x = 4</div>
</div>

<style>
  .reassign-viz {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    flex-wrap: wrap;
    border: 1px solid var(--edit-black);
    background: var(--edit-white);
    box-shadow: 4px 4px 0 var(--edit-black);
    margin: 12px 0 28px;
    padding: 20px 16px;
  }
  .rv-code {
    font-family: 'WebVGA', monospace;
    letter-spacing: normal;
    font-size: 20px;
    line-height: 20px;
    background: var(--edit-gray);
    border: 1px solid var(--edit-black);
    padding: 10px 18px;
  }
  .rv-arrow {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    margin-bottom: 14px;
  }
  .rv-arrow-label {
    font-family: 'WebVGA', monospace;
    letter-spacing: normal;
    font-size: 13px;
    color: #aa0000;
  }
  .rv-arrow svg { width: 90px; height: 18px; display: block; }
</style>
