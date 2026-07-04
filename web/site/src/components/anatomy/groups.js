// groups.js — the nine file sections of the cabinet carousel, plus
// the drawn bar segments. Order = file order (of first appearance).
// The carousel also has a 'map' overview page (router FILE_SECTIONS)
// that isn't a file section and so isn't listed here.
// Sizes measured from a real Sokoban build (util/cpu boundary at
// byte offsets 28,218 / 90,652 / ~345,543 of sokoban.css);
// colours from the EGA palette (utilities get light red: same
// family as the CPU; declarations light blue: same family as the
// write formulas).
export const GROUPS = [
  { id: 'util',   label: 'Utility functions',               size: '60 KB',  c: '#ff5555' },
  { id: 'cpu',    label: 'CPU',                             size: '255 KB', c: '#aa0000' },
  { id: 'keys',   label: 'Keyboard & debug display',        size: '4 KB',   c: '#aa00aa' },
  { id: 'screen', label: 'Screen',                          size: '6.5 MB', c: '#00aaaa' },
  { id: 'decl',   label: 'Memory — variable declarations',  size: '32 MB',  c: '#5555ff' },
  { id: 'memr',   label: 'Memory — read formulas',          size: '44 MB',  c: '#00aa00' },
  { id: 'disk',   label: 'Disk',                            size: '13 MB',  c: '#aa5500' },
  { id: 'clock',  label: 'Clock',                           size: '43 MB',  c: '#aaaaaa' },
  { id: 'memw',   label: 'Memory — write formulas',         size: '171 MB', c: '#0000aa' },
];

// The three sections too small to draw at bar scale — together
// 319 KB, 0.1% of the file, under a pixel of a 680px bar. On the
// bar they are one 2px sliver; the zoom box below expands them.
export const TINY = ['util', 'cpu', 'keys'];

// Drawn bar segments: file order, contiguous same-group sections
// merged. px pre-computed for a 680px bar (~2.2 px/MB) starting at
// x=12, after the 2px TINY sliver at x=10. The 25 KB header comment
// before util is sub-pixel and has no carousel section, so it isn't
// drawn.
export const SEGS = [
  { g: 'screen', x: 12,  w: 14  },  // pixel painter
  { g: 'decl',   x: 26,  w: 68  },  // @property declarations
  { g: 'memr',   x: 94,  w: 93  },  // memory read function
  { g: 'disk',   x: 187, w: 28  },  // disk read function
  { g: 'clock',  x: 215, w: 32  },  // double-buffer reads
  { g: 'memw',   x: 247, w: 384 },  // memory write rules
  { g: 'clock',  x: 631, w: 59  },  // store + execute + clock keyframes
];

// Zoom box segments: the TINY sliver expanded to a 240px box —
// ~350× the bar's scale. Proportional to 60 / 255 / 4 KB, except
// keys is held to a 6px minimum so it can be hovered and clicked.
export const ZOOM = [
  { g: 'util', x: 10,  w: 45  },  // the 66 @functions
  { g: 'cpu',  x: 55,  w: 189 },  // register tables…write slots
  { g: 'keys', x: 244, w: 6   },  // debug + keyboard (min width)
];
