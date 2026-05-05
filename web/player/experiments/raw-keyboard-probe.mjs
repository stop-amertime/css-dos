// Verify the no-JS keyboard path: load player/raw.html (the spec-correct,
// no-engine player), inject just the cabinet's @property --keyboard
// declaration + the .cpu { :has(#kb-X:active) { --keyboard: N } } rules,
// then drive mouse-down/mouse-up on each keyboard button and assert the
// computed --keyboard value on the .cpu element matches.
//
// We only inject the keyboard rules — not the full cabinet — because
// loading the real 80 MB doom8088.css crashes Chrome (which is precisely
// why calcite exists). The point of this probe is to verify the *CSS
// shape* works in raw Chrome with the player's actual DOM, not to render
// a full game.
//
// If this passes, the cardinal-rule path is intact:
//   - raw.html has #kb-X buttons in a .cpu wrapper
//   - cabinet CSS reads :active on those buttons
//   - --keyboard updates as expected, no JS on the page
//
// Run: node web/player/experiments/raw-keyboard-probe.mjs [--headed]

import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);

let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  const fallback =
    process.platform === 'win32'
      ? 'C:/Users/AdmT9N0CX01V65438A/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/playwright'
      : null;
  if (!fallback) {
    console.error('playwright not found and no fallback configured');
    process.exit(2);
  }
  ({ chromium } = require(fallback));
}

const HEADED = process.argv.includes('--headed');
const launchOpts = { headless: !HEADED };
const sysChrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
try {
  const fs = require('node:fs');
  if (fs.existsSync(sysChrome)) launchOpts.executablePath = sysChrome;
} catch {}

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..', '..');
const rawHtmlPath = path.join(repoRoot, 'web', 'player', 'raw.html');
const cabinetPath = path.join(repoRoot, 'doom8088.css');

// Extract the keyboard rules block from the real cabinet so we test against
// what kiln actually emits, not a hand-rolled copy.
function extractKbRules(css) {
  // Find the .cpu { ... } block that begins with "&:has(#kb-0:active)".
  const start = css.indexOf('  &:has(#kb-0:active)');
  if (start < 0) throw new Error('keyboard block not found in cabinet');
  // Walk forward to find the closing brace of the .cpu { ... } that contains it.
  // We know the block opens with ".cpu {\n  &:has(#kb-0:active)..." so back up
  // from `start` to the preceding ".cpu {" line.
  const cpuOpen = css.lastIndexOf('.cpu {', start);
  if (cpuOpen < 0) throw new Error('.cpu opener not found');
  // From cpuOpen, count braces until balance returns to zero.
  let depth = 0;
  let i = cpuOpen;
  let firstBrace = -1;
  for (; i < css.length; i++) {
    const c = css[i];
    if (c === '{') {
      if (firstBrace < 0) firstBrace = i;
      depth++;
    } else if (c === '}') {
      depth--;
      if (depth === 0) { i++; break; }
    }
  }
  return css.slice(cpuOpen, i);
}

const cabinetCss = readFileSync(cabinetPath, 'utf8');
const kbRules = extractKbRules(cabinetCss);
console.log(`[probe] extracted ${kbRules.split('\n').length} lines of kbd rules from doom8088.css`);

// Cases to verify. Values come from the cabinet itself (extracted above).
const KEYS = [
  { id: 'kb-1',     expected: 561,   label: '1' },
  { id: 'kb-a',     expected: 7777,  label: 'A' },
  { id: 'kb-enter', expected: 7181,  label: 'Enter' },
  { id: 'kb-up',    expected: 18432, label: 'Up' },
  { id: 'kb-space', expected: 14624, label: 'Space' },
];

const browser = await chromium.launch(launchOpts);
let exitCode = 0;
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      process.stderr.write(`[page:${msg.type()}] ${msg.text()}\n`);
    }
  });
  page.on('pageerror', (err) => {
    process.stderr.write(`[pageerror] ${err.message}\n`);
  });

  // Stub the cabinet CSS request so raw.html's <link rel=stylesheet href=/cabinet.css>
  // resolves to just the keyboard rules + a @property declaration. The full cabinet
  // would crash Chrome (millions of @property decls) and isn't relevant to this proof.
  await page.route('**/cabinet.css', async (route) => {
    const body = `
@property --keyboard {
  syntax: '<integer>';
  inherits: true;
  initial-value: 0;
}

${kbRules}
`;
    await route.fulfill({
      status: 200,
      contentType: 'text/css',
      body,
    });
  });

  await page.goto('file://' + rawHtmlPath.replace(/\\/g, '/'));

  async function readKeyboard() {
    return await page.evaluate(() => {
      const cpu = document.querySelector('.cpu');
      if (!cpu) return { err: '.cpu element not found' };
      const v = getComputedStyle(cpu).getPropertyValue('--keyboard').trim();
      return { value: v === '' ? null : Number(v) };
    });
  }

  // Sanity: at rest, --keyboard reads 0.
  {
    const r = await readKeyboard();
    if (r.err) {
      console.error(`FAIL setup: ${r.err}`);
      process.exit(1);
    }
    if (r.value !== 0) {
      console.error(`FAIL rest: --keyboard = ${r.value}, expected 0`);
      exitCode = 1;
    } else {
      console.log(`OK   rest: --keyboard = 0`);
    }
  }

  for (const k of KEYS) {
    const sel = `#${k.id}`;
    const handle = page.locator(sel).first();
    const count = await handle.count();
    if (count === 0) {
      console.error(`FAIL ${k.label}: ${sel} not found in raw.html DOM`);
      exitCode = 1;
      continue;
    }
    const box = await handle.boundingBox();
    if (!box) {
      console.error(`FAIL ${k.label}: ${sel} has no bounding box (display:none?)`);
      exitCode = 1;
      continue;
    }
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;

    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.waitForTimeout(50);
    const heldR = await readKeyboard();
    const held = heldR.value;
    const holdOk = held === k.expected;
    console.log(`${holdOk ? 'OK  ' : 'FAIL'} hold ${k.label} (${sel}): --keyboard=${held} expected=${k.expected}`);
    if (!holdOk) exitCode = 1;

    await page.mouse.up();
    await page.waitForTimeout(50);
    const releasedR = await readKeyboard();
    const released = releasedR.value;
    const releaseOk = released === 0;
    console.log(`${releaseOk ? 'OK  ' : 'FAIL'} release ${k.label}: --keyboard=${released} expected=0`);
    if (!releaseOk) exitCode = 1;
  }
} finally {
  await browser.close();
}

process.exit(exitCode);
