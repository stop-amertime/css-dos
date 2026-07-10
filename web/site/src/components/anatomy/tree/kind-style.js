// kind-style.js — one fixed glyph + colour per classify() kind, shared
// across every section's tree so the vocabulary is learned once. Colours
// lean on the same EGA-ish families anatomy/groups.js already uses for
// the cabinet bar (memory = blues, utilities = green) without reusing
// its exact hex values 1:1 (those are per-SEGMENT, these are per-KIND).
export const KIND_STYLE = {
  property:  { glyph: '§', colour: '#2222cc' }, // memory-blue family
  function:  { glyph: 'ƒ', colour: '#00aa00' }, // utility green
  rule:      { glyph: '?', colour: '#aa0000' }, // silicon red (branch/condition)
  keyframes: { glyph: '@', colour: '#ffff55' }, // clock yellow (the thing that moves)
  selector:  { glyph: '.', colour: '#00aaaa' }, // I/O cyan
  comment:   { glyph: '/*', colour: '#555555' }, // neutral grey, matches .zoom-label / captions
  value:     { glyph: '=', colour: '#aa00aa' }, // disk purple, catch-all
};

export const GROUP_STYLE = { glyph: null, colour: '#555555' }; // folder glyph is drawn in CSS, not here
