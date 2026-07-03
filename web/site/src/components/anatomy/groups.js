// groups.js — the ten stories of the cabinet map, plus the drawn
// bar segments. Legend order = file order (of first appearance).
// Sizes measured from a real Sokoban build (util/cpu boundary at
// byte offsets 28,218 / 90,652 / ~345,543 of sokoban.css);
// colours from the EGA palette (utilities get light red: same
// family as the CPU; declarations light blue: same family as the
// write formulas).
export const GROUPS = [
  { id: 'hdr',    label: 'Header comment',                  size: '25 KB',  c: '#555555' },
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

// Drawn bar segments: file order, contiguous same-group sections
// merged. px pre-computed for a 680px bar (~2.2 px/MB); the first
// three are held to a minimum clickable width (true scale would be
// well under 1px each).
export const SEGS = [
  { g: 'hdr',    x: 10,  w: 5   },  // header comment (exaggerated)
  { g: 'util',   x: 15,  w: 5   },  // the 66 @functions (exaggerated)
  { g: 'cpu',    x: 20,  w: 5   },  // register tables…write slots (exaggerated)
  { g: 'keys',   x: 25,  w: 4   },  // debug + keyboard (exaggerated)
  { g: 'screen', x: 29,  w: 14  },  // pixel painter
  { g: 'decl',   x: 43,  w: 66  },  // @property declarations
  { g: 'memr',   x: 109, w: 91  },  // memory read function
  { g: 'disk',   x: 200, w: 27  },  // disk read function
  { g: 'clock',  x: 227, w: 31  },  // double-buffer reads
  { g: 'memw',   x: 258, w: 374 },  // memory write rules
  { g: 'clock',  x: 632, w: 58  },  // store + execute + clock keyframes
];
