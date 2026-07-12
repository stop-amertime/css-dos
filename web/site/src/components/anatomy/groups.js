// groups.js — the ten file sections of the cabinet carousel, plus
// the drawn bar segments. Order = file order (of first appearance).
// The carousel also has a 'map' overview page (router FILE_SECTIONS)
// that isn't a file section and so isn't listed here.
// Sizes measured 2026-07-12 from a real Sokoban build (~309.6 MB)
// after the file-map reorg + kiln dead-code sweep. To re-measure, run
// `node tools/extract-tree-data.mjs all` — it prints each region's
// byte size (the same numbers the tree skeletons' *_TREE_META carry).
// Region bytes util 13,680 / cpu 304,674 / chipset 17,960 /
// keys 3,691 / screen 6,979,937 / decl 32,030,848 / memr 43,772,403 /
// memw 170,719,352 / disk 12,788,804 / clock 43,000,160.
// Colours are semantic families (EGA-leaning): silicon = reds
// (CPU dark, chipset light), I/O = cyans (screen dark, keys light),
// memory = blues (decl light → memr mid → memw dark, biggest =
// darkest), disk = purple, utilities = green (deliberately
// unrelated to everything), clock = bright yellow — the one thing
// that moves gets the loudest colour (and stays clear of the warm
// reds, which read as silicon).
export const GROUPS = [
  { id: 'util',    label: 'Bit & byte helpers',              size: '14 KB',  c: '#00aa00' },
  { id: 'cpu',     label: 'CPU',                             size: '305 KB', c: '#aa0000' },
  { id: 'chipset', label: 'Chipset',                         size: '18 KB',  c: '#ff5555' },
  { id: 'keys',    label: 'Keyboard selectors',              size: '3.7 KB', c: '#55ffff' },
  { id: 'screen',  label: 'Display',                         size: '7 MB',   c: '#00aaaa' },
  { id: 'decl',    label: 'Memory declarations',             size: '32 MB',  c: '#5555ff' },
  { id: 'memr',    label: 'Memory reads',                    size: '44 MB',  c: '#2222cc' },
  { id: 'memw',    label: 'Memory writes',                   size: '171 MB', c: '#0000aa' },
  { id: 'disk',    label: 'Disk',                            size: '13 MB',  c: '#aa00aa' },
  { id: 'clock',   label: 'Clock',                           size: '43 MB',  c: '#ffff55' },
];

// The four sections too small to draw at bar scale — together
// ~340 KB, 0.1% of the file, under a pixel of a 680px bar. On the
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
// ~350× the bar's scale. Proportional to 14 / 305 / 18 / 3.7 KB,
// except keys is held to a 6px minimum so it can be hovered and
// clicked.
export const ZOOM = [
  { g: 'util',    x: 10,  w: 16  },  // the 17 shared @functions
  { g: 'cpu',     x: 26,  w: 206 },  // decode + register tables + write slots + flag arithmetic
  { g: 'chipset', x: 232, w: 12  },  // PIT, PIC, keyboard controller, DAC
  { g: 'keys',    x: 244, w: 6   },  // keyboard selectors (min width)
];
