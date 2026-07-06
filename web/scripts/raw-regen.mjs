#!/usr/bin/env node
// web/scripts/raw-regen.mjs
// Generate player/raw.html by deriving it from calcite.html, so the
// two players share chrome/keyboard verbatim and cannot drift. The
// ONLY differences: the <img> screen becomes a 320x200 = 64000-element
// CSS pixel grid, the cabinet loads as a real stylesheet, .window-body
// gains .clock and .cpu classes to host the cabinet's .cpu-scoped rules,
// and the label reads RAW.
//
// In principle Chrome evaluates the cabinet and the pixel painter
// (kiln/pixels.mjs) drives #p0..#p63999 from the Mode 13h framebuffer.
// In practice Chrome hangs/crashes on the cabinet's size — the point of
// the "raw" player. calcite.html runs the same machine at speed.
//
//   node web/scripts/raw-regen.mjs

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const calcitePath = resolve(__dirname, '..', 'player', 'calcite.html');
const outPath = resolve(__dirname, '..', 'player', 'raw.html');

const W = 320, H = 200;

function pixelGrid() {
  const cells = new Array(W * H);
  for (let i = 0; i < cells.length; i++) cells[i] = `<i id="p${i}">`;
  // newline per row keeps editors from choking; grid layout ignores whitespace.
  const rows = [];
  for (let y = 0; y < H; y++) rows.push(cells.slice(y * W, (y + 1) * W).join(''));
  return `<div id="grid" class="screen-grid">\n${rows.join('\n')}\n</div>`;
}

const gridStyle = `  <style>
    /* AUTOGEN raw-player pixel grid — replaces the calcite <img>. */
    .screen-grid {
      display: grid;
      grid-template-columns: repeat(${W}, 2px);
      grid-auto-rows: 2px;
      width: ${W * 2}px;
      height: ${H * 2}px;
      max-width: 640px;
      image-rendering: pixelated;
      background: #000;
      margin: 0 auto;
    }
    .screen-grid > i { display: block; width: 2px; height: 2px; background: transparent; }
  </style>
`;

let html = readFileSync(calcitePath, 'utf8');

// (1) Replace the <img> screen with the pixel grid.
//     The img tag in calcite.html:
//       <img id="calcite-screen"
//            class="screen"
//            src="/_screen/framebuffer"
//            alt=""
//            width="640" height="400">
html = html.replace(
  /<img id="calcite-screen"[\s\S]*?width="640" height="400">/,
  pixelGrid());

// (2) Add .clock and .cpu classes to .window-body so cabinet
//     .cpu-scoped rules (keyboard :has, pixel painter) have a host.
//     Simpler and more robust than wrapping with new divs.
html = html.replace(
  '<div class="window-body">',
  '<div class="window-body clock cpu">');

// (3) Cabinet as a real stylesheet instead of <link rel="alternate">.
html = html.replace(
  '<link rel="alternate" href="/cabinet.css" type="text/css" title="cabinet">',
  '<link rel="stylesheet" href="/cabinet.css">');

// (4) Distinguishing title + label.
html = html.replace(/<title>[^<]*<\/title>/, '<title>CSS-DOS · raw CSS</title>');
html = html.replace('>CALCITE<', '>RAW<');
html = html.replace('CSS-DOS - PLAYING', 'CSS-DOS - RAW CSS');

// (5) Grid geometry styles, injected before </head>.
html = html.replace('</head>', `${gridStyle}</head>`);

// (6) Hold machinery. In calcite the hold button is a mode checkbox
//     the BRIDGE interprets (holdmode=1 rides on key submissions). Raw
//     has no bridge — there the cabinet reads `#kb-X-hold:checked`
//     directly, so swap in the pure-CSS one-shot gesture: arm →
//     invisible per-key pin radios catch the next press (radio
//     exclusivity un-arms in the same click), held key painted red,
//     its .kb-unpin label (→ #kb-nohold) releases on re-press. The
//     styling for all of this already sits INERT in calcite.html's
//     sheet; here we add the elements it selects on.
//
// (6a) Mode checkbox → the armed/idle radio pair.
html = html.replace(
  /<input type="checkbox" id="kb-holdmode" class="kb-state" name="holdmode" value="1"[^>]*>/,
  '<input type="radio" id="kb-holdmode" class="kb-state" name="held" value="" aria-label="Hold a key: the next key pressed stays held">\n' +
  '        <input type="radio" id="kb-nohold" class="kb-state" name="held" value="" checked aria-label="No held key">');

// (6b) Hold button: one-shot title + its cancel/release twin.
html = html.replace(
  /<label id="kb-hold" class="kb-key kb-mod" for="kb-holdmode" title="[^"]*"><\/label>/,
  '<label id="kb-hold" class="kb-key kb-mod" for="kb-holdmode" title="The next key pressed stays held"></label>\n' +
  '          <label id="kb-unhold" class="kb-key kb-mod" for="kb-nohold" title="Cancel / release the held key"></label>');

// (6c) Per-key pin radio + release label after every key button.
let pins = 0;
html = html.replace(
  /(<button id="(kb-[a-z0-9]+)"[^>]*name="key"[^>]*>.*?<\/button>)/g,
  (m, btn, id) => {
    pins++;
    return `${btn}<input type="radio" id="${id}-hold" class="kb-pin" name="held" value="${id}" title="Hold this key"><label class="kb-unpin" for="kb-nohold" title="Press again to release"></label>`;
  });
if (pins !== 61) throw new Error(`expected 61 key buttons, injected ${pins}`);

// (6d) Raw-only rule: while armed, the mode button hides (its twin
//      #kb-unhold shows via the inert main-sheet rules). Conflicts
//      with calcite's lit-button rule, hence injected here only.
html = html.replace('</head>', `  <style>
    /* AUTOGEN raw hold machinery — armed swaps #kb-hold for #kb-unhold. */
    .keyboard:has(#kb-holdmode:checked) #kb-hold { display: none; }
  </style>
</head>`);

if (/<\/script>/i.test(html)) throw new Error('raw.html still contains a <script> tag');

// Mark the file autogenerated.
html = html.replace('<!DOCTYPE html>',
  `<!DOCTYPE html>\n<!-- AUTOGEN by web/scripts/raw-regen.mjs from calcite.html. Do not edit. -->`);

writeFileSync(outPath, html);
console.log(`raw-regen: wrote ${outPath} (${html.length} bytes, ${W * H} pixels)`);
