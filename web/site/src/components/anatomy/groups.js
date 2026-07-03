// groups.js — the eight stories of the cabinet map, plus the drawn
// bar segments. Sizes measured from a real Sokoban build
// (CABINET-ANATOMY.md); colours from the EGA palette.
export const GROUPS = [
  { id: 'hdr',    label: 'The header comment',             size: '25 KB',  c: '#555555' },
  { id: 'cpu',    label: 'The CPU',                        size: '320 KB', c: '#aa0000' },
  { id: 'keys',   label: 'The keyboard & debug display',   size: '4 KB',   c: '#aa00aa' },
  { id: 'screen', label: 'The screen',                     size: '6.5 MB', c: '#00aaaa' },
  { id: 'memw',   label: 'Memory: storing and changing it', size: '203 MB', c: '#0000aa' },
  { id: 'memr',   label: 'Memory: reading it',             size: '44 MB',  c: '#00aa00' },
  { id: 'disk',   label: 'The disk',                       size: '13 MB',  c: '#aa5500' },
  { id: 'clock',  label: 'The clock',                      size: '43 MB',  c: '#aaaaaa' },
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
  { g: 'memw',   x: 38,  w: 66  },  // @property declarations
  { g: 'memr',   x: 104, w: 91  },  // memory read function
  { g: 'disk',   x: 195, w: 27  },  // disk read function
  { g: 'clock',  x: 222, w: 31  },  // double-buffer reads
  { g: 'memw',   x: 253, w: 379 },  // memory write rules
  { g: 'clock',  x: 632, w: 58  },  // store + execute + clock keyframes
];
