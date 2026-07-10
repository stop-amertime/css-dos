// classify.test.js — run with: node web/site/src/components/anatomy/tree/classify.test.js
import assert from 'node:assert/strict';
import { classify } from './classify.js';

// @property
assert.deepEqual(
  classify('@property --AX {\n  syntax: \'<integer>\';\n  inherits: true;\n  initial-value: 0;\n}'),
  { kind: 'property', label: '--AX' },
);

// @function
assert.deepEqual(
  classify('@function --addFlags16(--dst <integer>, --src <integer>) returns <integer> {\n  result: 0;\n}'),
  { kind: 'function', label: '--addFlags16()' },
);

// style() rule
assert.deepEqual(
  classify('style(--opcode: 5): --lowerBytes(calc(var(--__1AX) + var(--imm16)), 16); /* ADD AX, imm16 */'),
  { kind: 'rule', label: '--opcode: 5' },
);

// keyframes
assert.deepEqual(
  classify('@keyframes clock-tick {\n  to { --tick: 1; }\n}'),
  { kind: 'keyframes', label: 'clock-tick' },
);

// selector
assert.deepEqual(
  classify('.cpu {\n  --AL: --lowerBytes(var(--__1AX), 8);\n}'),
  { kind: 'selector', label: '.cpu' },
);

// standalone comment
assert.deepEqual(
  classify('/* Register aliases (8-bit halves) */'),
  { kind: 'comment', label: 'Register aliases (8-bit halves)' },
);

// bare value/expression (fallback)
assert.deepEqual(
  classify('calc(var(--dst) + var(--src))'),
  { kind: 'value', label: 'calc(var(--dst)' },
);

// long comment truncates at 40 chars with an ellipsis
{
  const { kind, label } = classify(
    '/* This is a deliberately long comment used only to verify truncation behaviour in the classifier */',
  );
  assert.equal(kind, 'comment');
  assert.equal(label.length, 41); // 40 chars + '…'
  assert.ok(label.endsWith('…'));
}

console.log('classify.test.js: all assertions passed');
