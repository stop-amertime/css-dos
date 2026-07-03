// groups.js — the nine stories of the cabinet map, plus the drawn
// bar segments. Legend order = file order (of first appearance).
// Sizes measured from a real Sokoban build (CABINET-ANATOMY.md);
// colours from the EGA palette (declarations get light blue: same
// family as the write formulas, different member).
export const GROUPS = [
  { id: 'hdr',    label: 'Header comment',                  size: '25 KB',  c: '#555555' },
  { id: 'cpu',    label: 'CPU',                             size: '320 KB', c: '#aa0000' },
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
  { g: 'cpu',    x: 15,  w: 5   },  // utilities…write slots (exaggerated)
  { g: 'keys',   x: 20,  w: 4   },  // debug + keyboard (exaggerated)
  { g: 'screen', x: 24,  w: 14  },  // pixel painter
  { g: 'decl',   x: 38,  w: 66  },  // @property declarations
  { g: 'memr',   x: 104, w: 91  },  // memory read function
  { g: 'disk',   x: 195, w: 27  },  // disk read function
  { g: 'clock',  x: 222, w: 31  },  // double-buffer reads
  { g: 'memw',   x: 253, w: 379 },  // memory write rules
  { g: 'clock',  x: 632, w: 58  },  // store + execute + clock keyframes
];
