#!/usr/bin/env node
// tests/harness/raw-regen.test.mjs
// Verifies that web/scripts/raw-regen.mjs produces a valid raw.html
// derived from calcite.html with all required substitutions applied.
//
// Run: node tests/harness/raw-regen.test.mjs

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import assert from 'node:assert';

execFileSync('node', ['web/scripts/raw-regen.mjs'], { stdio: 'inherit' });
const raw = readFileSync('web/player/raw.html', 'utf8');
const cal = readFileSync('web/player/calcite.html', 'utf8');

// Grid: exactly 64000 pixel elements, none in calcite.html.
assert.equal((raw.match(/<i id=["']?p\d+["']?>/g) || []).length, 64000,
  '64000 pixel elements');
assert.equal((cal.match(/<i id=["']?p\d+/g) || []).length, 0,
  'calcite.html has no pixels');

// Full keyboard id set carried over verbatim from calcite.html.
for (const id of ['kb-caps','kb-ctrl','kb-shift','kb-f1','kb-f10','kb-slash','kb-enter','kb-space','kb-up']) {
  assert.ok(raw.includes(`id="${id}"`), `raw has ${id}`);
}

// Machine host present so cabinet rules can match - the element
// carries BOTH classes: .motherboard (chipset/memory/plumbing rules)
// and .cpu (decode + register-table rules).
assert.ok(/class="[^"]*\bmotherboard\b/.test(raw), 'raw has .motherboard host');
assert.ok(/class="[^"]*\bcpu\b/.test(raw), 'raw has .cpu host');

// Cabinet loaded as a real stylesheet.
assert.ok(/rel="stylesheet"[^>]*href="\/cabinet\.css"/.test(raw), 'cabinet stylesheet link');

// The <img> screen is gone.
assert.ok(!raw.includes('id="calcite-screen"'), 'no <img> screen in raw');

// Distinguishing label.
assert.ok(raw.includes('>RAW<'), 'RAW label in status line');

// Title changed.
assert.ok(raw.includes('<title>CSS-DOS · raw CSS</title>'), 'raw CSS in title');

// Menu-bar title changed (separate substitution from <title>).
assert.ok(raw.includes('CSS-DOS - RAW CSS'), 'menu-bar title is RAW CSS');
assert.ok(!raw.includes('CSS-DOS - PLAYING'), 'old PLAYING menu title gone');

// .clock must be an ANCESTOR of the machine element, never the same
// element: on one element the motherboard's animation shorthand
// cascade-clobbers anim-play (clock never ticks) and @container
// style(--clock:) only queries ancestors.
// LOGBOOK 2026-07-09-chrome-eval-huge-cabinet.
assert.ok(raw.includes('class="window clock"'), '.window hosts the clock');
assert.ok(raw.includes('class="window-body motherboard cpu"'),
  '.window-body hosts the machine (motherboard + cpu)');
assert.ok(!/class="[^"]*\bclock\b[^"]*\b(?:motherboard|cpu)\b|class="[^"]*\b(?:motherboard|cpu)\b[^"]*\bclock\b/.test(raw),
  'clock and the machine element are never the same element');

// Cabinet <link rel="alternate"> is gone.
assert.ok(!raw.includes('rel="alternate"'), 'no rel="alternate" in raw');

// Pixel grid container present.
assert.ok(raw.includes('id="grid"'), 'grid container present');
assert.ok(raw.includes('class="screen-grid"'), 'screen-grid class present');

// grid style injected.
assert.ok(raw.includes('screen-grid'), 'screen-grid style present');

console.log('PASS raw-regen');
