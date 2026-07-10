// classify.js — labels a chunk of real cabinet CSS by its own syntax
// shape (at-rule name, selector type, declaration vs block). Never
// looks at anything beyond the text it's given: no upstream knowledge
// of x86/CPU/DOS, no tree-shape decisions — see docs/plans/
// 2026-07-10-anatomy-tree-view.md "The classifier".

const RULES = [
  {
    kind: 'property',
    test: /^\s*@property\s+(--[\w-]+)/,
    label: (m) => m[1],
  },
  {
    kind: 'function',
    test: /^\s*@function\s+(--[\w-]+)\s*\(/,
    label: (m) => `${m[1]}()`,
  },
  {
    kind: 'keyframes',
    test: /^\s*@keyframes\s+([\w-]+)/,
    label: (m) => m[1],
  },
  {
    kind: 'rule',
    test: /^\s*style\(([^)]*)\)\s*:/,
    label: (m) => m[1].trim(),
  },
  {
    kind: 'comment',
    test: /^\s*\/\*\s*([\s\S]*?)\s*\*\//,
    label: (m) => (m[1].length > 40 ? `${m[1].slice(0, 40)}…` : m[1]),
  },
  {
    kind: 'selector',
    test: /^\s*([.:#][\w:().,\s-]*?)\s*\{/,
    label: (m) => m[1].trim(),
  },
];

export function classify(cssChunk) {
  const text = String(cssChunk);
  for (const rule of RULES) {
    const m = text.match(rule.test);
    if (m) return { kind: rule.kind, label: rule.label(m) };
  }
  const firstToken = text.trim().split(/\s+/)[0] ?? '';
  return {
    kind: 'value',
    label: firstToken.length > 40 ? `${firstToken.slice(0, 40)}…` : firstToken,
  };
}
