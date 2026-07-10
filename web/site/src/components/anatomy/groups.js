// groups.js — the ten file sections of the cabinet carousel, plus
// the drawn bar segments. Order = file order (of first appearance).
// The carousel also has a 'map' overview page (router FILE_SECTIONS)
// that isn't a file section and so isn't listed here.
// Sizes measured 2026-07-10 from a real Sokoban build (309,801,718
// bytes) after the motherboard/cpu split: banner byte offsets
// util 24,979 / cpu 66,717 / chipset 331,885 / keys 348,315 /
// screen 351,835 / decl 7,331,748 / memr 39,366,670 /
// memw 83,138,481 / disk 253,856,953 / clock 266,802,460.
// Colours are semantic families (EGA-leaning): silicon = reds
// (CPU dark, chipset light), I/O = cyans (screen dark, keys light),
// memory = blues (decl light → memr mid → memw dark, biggest =
// darkest), disk = floppy brown, utilities = green (deliberately
// unrelated to everything), clock = bright pink — the one thing
// that moves gets the loudest colour.
export const GROUPS = [
  { id: 'util',    label: 'Utility functions',               size: '42 KB',  c: '#00aa00' },
  { id: 'cpu',     label: 'CPU',                             size: '265 KB', c: '#aa0000' },
  { id: 'chipset', label: 'Chipset',                         size: '16 KB',  c: '#ff5555' },
  { id: 'keys',    label: 'Keyboard & debug display',        size: '3.5 KB', c: '#55ffff' },
  { id: 'screen',  label: 'Screen',                          size: '7 MB',   c: '#00aaaa' },
  { id: 'decl',    label: 'Memory — variable declarations',  size: '32 MB',  c: '#5555ff' },
  { id: 'memr',    label: 'Memory — read formulas',          size: '44 MB',  c: '#2222cc' },
  { id: 'memw',    label: 'Memory — write formulas',         size: '171 MB', c: '#0000aa' },
  { id: 'disk',    label: 'Disk',                            size: '13 MB',  c: '#aa5500' },
  { id: 'clock',   label: 'Clock',                           size: '43 MB',  c: '#ff55ff' },
];

// The four sections too small to draw at bar scale — together
// ~327 KB, 0.1% of the file, under a pixel of a 680px bar. On the
// bar they are one 2px sliver; the zoom box below expands them.
export const TINY = ['util', 'cpu', 'chipset', 'keys'];

// Drawn bar segments: file order, one segment per section (the
// clock is contiguous since the 2026-07-10 kiln reorder — buffer
// reads now sit beside the keyframes). px pre-computed for a 680px
// bar (~2.19 px/MB) starting at x=12, after the 2px TINY sliver at
// x=10. The 25 KB header comment before util is sub-pixel and has
// no carousel section, so it isn't drawn.
export const SEGS = [
  { g: 'screen', x: 12,  w: 15  },  // pixel painter
  { g: 'decl',   x: 27,  w: 70  },  // @property declarations
  { g: 'memr',   x: 97,  w: 96  },  // memory read function
  { g: 'memw',   x: 193, w: 373 },  // memory write rules
  { g: 'disk',   x: 566, w: 28  },  // disk read function
  { g: 'clock',  x: 594, w: 96  },  // buffer reads + keyframes
];

// Zoom box segments: the TINY sliver expanded to a 240px box —
// ~350× the bar's scale. Proportional to 42 / 265 / 16 / 3.5 KB,
// except keys is held to a 6px minimum so it can be hovered and
// clicked.
export const ZOOM = [
  { g: 'util',    x: 10,  w: 30  },  // the 66 @functions
  { g: 'cpu',     x: 40,  w: 192 },  // decode + register tables + write slots
  { g: 'chipset', x: 232, w: 12  },  // PIT, PIC, keyboard controller, DAC
  { g: 'keys',    x: 244, w: 6   },  // debug + keyboard (min width)
];
