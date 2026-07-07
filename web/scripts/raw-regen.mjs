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

// Normalize to LF: editors on Windows (git autocrlf checkouts) can
// leave calcite.html CRLF, which silently breaks the `\n`-anchored
// regexes below and would churn raw.html's line endings.
let html = readFileSync(calcitePath, 'utf8').replace(/\r\n/g, '\n');

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

// (6) Hold a key: calcite's #kb-hold is a submit button (the bridge
//     owns the mode and streams the lamp img). The raw player has no
//     bridge — swap in the pure-CSS form: a label toggling the hidden
//     #kb-holdmode checkbox, which IS the cabinet's --kbdHold wire
//     (`&:has(#kb-holdmode:checked)`). The machine latches key
//     releases while it is up and drains them when it drops; the
//     shared :checked rules light the key. See kiln emitIRQCompute.
{
  const btnRe = /<!-- Hold-mode toggle:[\s\S]*?<button id="kb-hold"[\s\S]*?<\/button>/;
  if (!btnRe.test(html)) throw new Error('raw-regen: calcite #kb-hold button not found');
  html = html.replace(btnRe,
    `<input type="checkbox" id="kb-holdmode" class="kb-state" aria-label="Hold Mode: while on, pressed keys stay held (chords); toggle off to release them all">`
    + `<label id="kb-hold" class="kb-key kb-mod" for="kb-holdmode" title="Hold Mode: while on, pressed keys stay held (chords); tap again to turn off and release them all"></label>`);
}
// (7) Drop the SW-heartbeat iframe: the raw player uses no service
//     worker streams, and without a dev server the refresh loop would
//     just 404 every 20s.
{
  const hbRe = /  <!-- SW heartbeat:[\s\S]*?<iframe class="kbd-sink" src="\/player\/heartbeat\.html"[^>]*><\/iframe>\n/;
  if (!hbRe.test(html)) throw new Error('raw-regen: heartbeat iframe not found');
  html = html.replace(hbRe, '');
}
if (/<\/script>/i.test(html)) throw new Error('raw.html still contains a <script> tag');

// Mark the file autogenerated.
html = html.replace('<!DOCTYPE html>',
  `<!DOCTYPE html>\n<!-- AUTOGEN by web/scripts/raw-regen.mjs from calcite.html. Do not edit. -->`);

writeFileSync(outPath, html);
console.log(`raw-regen: wrote ${outPath} (${html.length} bytes, ${W * H} pixels)`);
