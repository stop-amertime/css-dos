<script>
  // PixelScreen — a 16×16 grid of real, individually-coloured <div>s.
  // Miniature of the cabinet's Mode 13h painter (kiln/pixels.mjs), which
  // does the same thing 64,000 times, with each colour computed from
  // guest video memory. Here the "video memory" is a Svelte array and
  // you get to scribble in it.
  import '../styles/_fragments/pixel-screen.css';

  const W = 16, H = 16;

  // CGA/VGA-ish palette. Index 0 = black background.
  const PALETTE = [
    { hex: '#000000', name: 'black' },
    { hex: '#55ff55', name: 'green' },
    { hex: '#55ffff', name: 'cyan' },
    { hex: '#ff55ff', name: 'magenta' },
    { hex: '#ffff55', name: 'yellow' },
    { hex: '#ffffff', name: 'white' },
  ];

  // Classic 11×8 invader, centred on the 16×16 screen.
  const SPRITE = [
    '..X.....X..',
    '...X...X...',
    '..XXXXXXX..',
    '.XX.XXX.XX.',
    'XXXXXXXXXXX',
    'X.XXXXXXX.X',
    'X.X.....X.X',
    '...XX.XX...',
  ];
  function initialCells() {
    const cells = new Array(W * H).fill(0);
    const top = 4, left = 2;
    SPRITE.forEach((row, y) => {
      [...row].forEach((ch, x) => {
        if (ch === 'X') cells[(top + y) * W + (left + x)] = 1;
      });
    });
    return cells;
  }

  let cells = $state(initialCells());
  let brush = $state(2);        // current paint colour (cyan)
  let showDivs = $state(false); // outline every div
  let painting = false;         // mouse-drag paint

  function paint(i) { cells[i] = brush; }
</script>

<div class="pixel-screen">
  <div
    class="pixel-grid"
    class:show-divs={showDivs}
    role="img"
    aria-label="A 16 by 16 grid of divs painted into a space-invader sprite. Click to repaint pixels."
    onpointerdown={() => (painting = true)}
    onpointerup={() => (painting = false)}
    onpointerleave={() => (painting = false)}
  >
    {#each cells as ci, i}
      <!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
      <div
        class="px"
        style="background-color: {PALETTE[ci].hex}"
        onclick={() => paint(i)}
        onpointerenter={() => { if (painting) paint(i); }}
      ></div>
    {/each}
  </div>

  <div class="pixel-controls">
    <div class="pixel-palette" role="group" aria-label="Paint colour">
      {#each PALETTE as c, i}
        <button
          class="swatch"
          class:current={brush === i}
          style="background-color: {c.hex}"
          title={c.name}
          aria-label={'paint ' + c.name}
          onclick={() => (brush = i)}
        ></button>
      {/each}
    </div>
    <button class="demo-toggle" onclick={() => (showDivs = !showDivs)}>
      {showDivs ? 'hide' : 'show'} the divs
    </button>
    <button class="demo-toggle" onclick={() => (cells = initialCells())}>
      reset
    </button>
  </div>

  <p class="caption">
    Every pixel here is a separate <code>&lt;div&gt;</code> with its own
    <code>background-color</code> &mdash; click around and paint some.
    The real screen works the same way, just bigger:
    <b>320&nbsp;&times;&nbsp;200 = 64,000 divs</b>, each one coloured by
    its own CSS rule reading its own byte of video memory.
  </p>
</div>
