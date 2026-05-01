// ensure-fresh.test.mjs — basic checks on the staleness primitive.
//
// Run with:  node tests/bench/lib/ensure-fresh.test.mjs

import { ensureFresh, registerArtifact } from './ensure-fresh.mjs';
import { writeFileSync, existsSync, mkdirSync, utimesSync, readFileSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..', '..');
const SCRATCH = resolve(REPO_ROOT, 'tmp', 'ensure-fresh-test');

function setup() {
  if (existsSync(SCRATCH)) rmSync(SCRATCH, { recursive: true });
  mkdirSync(SCRATCH, { recursive: true });
}

function tick() { return Date.now(); }

let passed = 0, failed = 0;
function assert(cond, msg) {
  if (cond) { console.log('  ✓', msg); passed++; }
  else { console.log('  ✗', msg); failed++; }
}

// 1. Missing output → builds.
console.log('test 1: missing output → builds');
setup();
const out1 = resolve(SCRATCH, 'out1.txt');
const src1 = resolve(SCRATCH, 'src1.txt');
writeFileSync(src1, 'hello');
const r1 = await ensureFresh({
  name: 'test1',
  output: 'tmp/ensure-fresh-test/out1.txt',
  inputs: ['tmp/ensure-fresh-test/src1.txt'],
  rebuild: `node -e "require('fs').writeFileSync('${out1.replace(/\\/g, '/')}', 'built')"`,
}, { verbose: false });
assert(r1.built === true, 'r1.built === true');
assert(existsSync(out1), 'output exists');
assert(readFileSync(out1, 'utf8') === 'built', 'output content correct');

// 2. Up-to-date output → no rebuild.
console.log('test 2: up-to-date → no rebuild');
const r2 = await ensureFresh({
  name: 'test2',
  output: 'tmp/ensure-fresh-test/out1.txt',
  inputs: ['tmp/ensure-fresh-test/src1.txt'],
  rebuild: `echo SHOULD-NOT-RUN`,
}, { verbose: false });
assert(r2.built === false, 'r2.built === false');
assert(r2.reason === 'fresh', 'reason "fresh"');

// 3. Source touched after output → rebuilds.
console.log('test 3: source newer → rebuilds');
const future = (Date.now() + 5000) / 1000;
utimesSync(src1, future, future);
let counter = 0;
const r3 = await ensureFresh({
  name: 'test3',
  output: 'tmp/ensure-fresh-test/out1.txt',
  inputs: ['tmp/ensure-fresh-test/src1.txt'],
  rebuild: `node -e "require('fs').writeFileSync('${out1.replace(/\\/g, '/')}', 'rebuilt')"`,
}, { verbose: false });
assert(r3.built === true, 'r3.built === true');
assert(readFileSync(out1, 'utf8') === 'rebuilt', 'output got rebuilt');

// 4. --no-rebuild on stale → throws.
console.log('test 4: stale with --no-rebuild → throws');
const future2 = (Date.now() + 10000) / 1000;
utimesSync(src1, future2, future2);
let threw = false;
try {
  await ensureFresh({
    name: 'test4',
    output: 'tmp/ensure-fresh-test/out1.txt',
    inputs: ['tmp/ensure-fresh-test/src1.txt'],
    rebuild: 'echo SHOULD-NOT-RUN',
  }, { noRebuild: true, verbose: false });
} catch (e) {
  threw = true;
  assert(/stale/.test(e.message), 'error message mentions "stale"');
}
assert(threw, 'threw on stale + noRebuild');

// 5. Transitive deps via registry.
console.log('test 5: transitive deps');
setup();
const a = resolve(SCRATCH, 'a.txt');
const b = resolve(SCRATCH, 'b.txt');
const c = resolve(SCRATCH, 'c.txt');
writeFileSync(a, 'A');
registerArtifact({
  name: 'b-from-a',
  output: 'tmp/ensure-fresh-test/b.txt',
  inputs: ['tmp/ensure-fresh-test/a.txt'],
  rebuild: `node -e "require('fs').writeFileSync('${b.replace(/\\/g, '/')}', 'B-built')"`,
});
const r5 = await ensureFresh({
  name: 'c-from-b',
  output: 'tmp/ensure-fresh-test/c.txt',
  inputs: ['b-from-a'],
  rebuild: `node -e "require('fs').writeFileSync('${c.replace(/\\/g, '/')}', 'C-built')"`,
}, { verbose: false });
assert(r5.built === true, 'c rebuilt');
assert(existsSync(b), 'transitive b also built');
assert(readFileSync(b, 'utf8') === 'B-built', 'b content from transitive build');

// 6. Glob inputs (path/**).
console.log('test 6: path/** glob');
setup();
const subdir = resolve(SCRATCH, 'sub');
mkdirSync(subdir);
writeFileSync(resolve(subdir, 'one.txt'), '1');
writeFileSync(resolve(subdir, 'two.txt'), '2');
const out6 = resolve(SCRATCH, 'out6.txt');
const r6a = await ensureFresh({
  name: 'test6',
  output: 'tmp/ensure-fresh-test/out6.txt',
  inputs: ['tmp/ensure-fresh-test/sub/**'],
  rebuild: `node -e "require('fs').writeFileSync('${out6.replace(/\\/g, '/')}', 'built')"`,
}, { verbose: false });
assert(r6a.built === true, 'first build');
// touch a file in the subdir → should be detected
const future3 = (Date.now() + 15000) / 1000;
utimesSync(resolve(subdir, 'one.txt'), future3, future3);
const r6b = await ensureFresh({
  name: 'test6',
  output: 'tmp/ensure-fresh-test/out6.txt',
  inputs: ['tmp/ensure-fresh-test/sub/**'],
  rebuild: `node -e "require('fs').writeFileSync('${out6.replace(/\\/g, '/')}', 'rebuilt')"`,
}, { verbose: false });
assert(r6b.built === true, 'detected newer file in subdir');
assert(readFileSync(out6, 'utf8') === 'rebuilt', 'rebuilt');

// Cleanup
rmSync(SCRATCH, { recursive: true });

console.log('---');
console.log(`${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
