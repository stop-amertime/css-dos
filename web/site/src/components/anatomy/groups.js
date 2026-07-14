// groups.js - the ten file sections of the cabinet carousel, plus
// the drawn bar segments. Order = file order (of first appearance).
// The carousel also has a 'map' overview page (router FILE_SECTIONS)
// that isn't a file section and so isn't listed here.
// Sizes measured 2026-07-12 from a real Sokoban build (~309.8 MB)
// after the file-map reorg (declarations homed with their subsystem):
// region bytes util 14,778 / cpu 306,502 / chipset 19,320 /
// keys 3,691 / screen 6,979,937 / decl 32,030,848 / memr 43,772,403 /
// memw 170,719,352 / disk 12,945,591 / clock 43,000,160.
// Colours are semantic families (EGA-leaning): silicon = reds
// (CPU dark, chipset light), memory = blues (decl light → memr mid
// → memw dark, biggest = darkest), disk = purple, utilities =
// bright green, screen = dark cyan. Keys and clock were light cyan
// and bright yellow until 2026-07-12 (owner call): both were near
// invisible as pane chrome on white, so keys is now forest green
// and the clock gold - still the warmest, loudest thing on the bar
// without disappearing in the pane.
export const GROUPS = [
  { id: 'util',    label: 'Bit & byte helpers',              size: '15 KB',  c: '#00aa00' },
  { id: 'cpu',     label: 'CPU',                             size: '307 KB', c: '#aa0000' },
  { id: 'chipset', label: 'Chipset',                         size: '19 KB',  c: '#ff5555' },
  { id: 'keys',    label: 'Keyboard selectors',              size: '3.7 KB', c: '#228b22' },
  { id: 'screen',  label: 'Display',                         size: '7 MB',   c: '#00aaaa' },
  { id: 'decl',    label: 'Memory declarations',             size: '32 MB',  c: '#5555ff' },
  { id: 'memr',    label: 'Memory reads',                    size: '44 MB',  c: '#2222cc' },
  { id: 'memw',    label: 'Memory writes',                   size: '171 MB', c: '#0000aa' },
  { id: 'disk',    label: 'Disk',                            size: '13 MB',  c: '#aa00aa' },
  { id: 'clock',   label: 'Clock',                           size: '43 MB',  c: '#b8860b' },
];

// The four sections too small to draw at bar scale - together
// ~327 KB, 0.1% of the file, under a pixel of a 680px bar. On the
// bar they are one 2px sliver; the zoom box below expands them.
export const TINY = ['util', 'cpu', 'chipset', 'keys'];

// Drawn bar segments: file order, one segment per section (the
// clock is contiguous since the 2026-07-10 kiln reorder - buffer
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

// Zoom box segments: the TINY sliver expanded to a 240px box -
// ~350× the bar's scale. Proportional to 15 / 307 / 19 / 3.7 KB,
// except keys is held to a 6px minimum so it can be hovered and
// clicked.
export const ZOOM = [
  { g: 'util',    x: 10,  w: 16  },  // the 21 shared @functions
  { g: 'cpu',     x: 26,  w: 206 },  // decode + register tables + write slots + flag arithmetic
  { g: 'chipset', x: 232, w: 12  },  // PIT, PIC, keyboard controller, DAC
  { g: 'keys',    x: 244, w: 6   },  // keyboard selectors (min width)
];
