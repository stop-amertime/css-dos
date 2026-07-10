// cpu-tree.js — hand-authored Tree View data for the CPU section pilot.
// Structure (which groups exist, how deep) is editorial; every `code`
// string is real, verbatim cabinet CSS extracted from a built
// carts/sokoban cabinet 2026-07-10 (see the extraction note in
// docs/plans/2026-07-10-anatomy-tree-view-PLAN.md Task 3) — only
// line-wrapping changed for readability, never content. Not every
// opcode row COVERAGE lists is transcribed yet; TreeNode's own
// pagination (20-per-level) is what a reader sees for the rest, same
// honesty-about-scope convention the rest of the site uses (see
// SectionCpu.svelte's "232 distinct opcodes, 850 rows" callout).
import { COVERAGE } from '../cpu-coverage.js';

const AX_PROPERTY = `@property --AX {
  syntax: '<integer>';
  inherits: true;
  initial-value: 0;
}`;

const ADD_AX_ROW = `style(--opcode: 5): --lowerBytes(calc(var(--__1AX) + var(--imm16)), 16); /* ADD AX, imm16 */`;

const ADD_RM8_REG8_ROW = `style(--opcode: 0): if(style(--mod: 3) and style(--rm: 0): --mergelow(var(--__1AX), --lowerBytes(calc(var(--rmVal8) + var(--regVal8)), 8)); style(--mod: 3) and style(--rm: 4): --mergehigh(var(--__1AX), --lowerBytes(calc(var(--rmVal8) + var(--regVal8)), 8)); else: var(--__1AX)); /* ADD r/m8, reg8 → AX */`;

const ADD_RM16_REG16_ROW = `style(--opcode: 1): if(style(--mod: 3) and style(--rm: 0): --lowerBytes(calc(var(--rmVal16) + var(--regVal16)), 16); else: var(--__1AX)); /* ADD r/m16, reg16 → AX */`;

const OR_RM8_REG8_ROW = `style(--opcode: 8): if(style(--mod: 3) and style(--rm: 0): --mergelow(var(--__1AX), --or8(var(--rmVal8), var(--regVal8))); style(--mod: 3) and style(--rm: 4): --mergehigh(var(--__1AX), --or8(var(--rmVal8), var(--regVal8))); else: var(--__1AX)); /* OR r/m8, reg8 → AX */`;

const CS_PROPERTY = `@property --CS {
  syntax: '<integer>';
  inherits: true;
  initial-value: 61440;
}`;

const IP_PROPERTY = `@property --IP {
  syntax: '<integer>';
  inherits: true;
  initial-value: 0;
}`;

const FLAGS_PROPERTY = `@property --flags {
  syntax: '<integer>';
  inherits: true;
  initial-value: 2;
}`;

const ADD_FLAGS16_FN = `@function --addFlags16(--dst <integer>, --src <integer>) returns <integer> {
  --raw: calc(var(--dst) + var(--src));
  --res: --lowerBytes(var(--raw), 16);
  --cf: min(1, round(down, var(--raw) / 65536));
  --pf: --parity(var(--res));
  --zfsf: calc(if(style(--res: 0): 64; else: 0) + --bit(var(--res), 15) * 128);
  --of: --addOF16(var(--dst), var(--src), var(--res));
  result: calc(var(--cf) + var(--pf) + calc(round(down, max(0, sign(mod(var(--dst), 16) + mod(var(--src), 16) - 15.5)) + 0.5) * 16) + var(--zfsf) + var(--of) + 2);
}`;

const AL_ALIAS = `--AL: --lowerBytes(var(--__1AX), 8);`;

function opcodeGroupLabel(reg) {
  const count = COVERAGE[reg]?.length ?? 0;
  return `${count} opcode rows`;
}

export const CPU_TREE = [
  {
    type: 'group',
    label: 'Register aliases (8-bit halves)',
    children: [
      { type: 'code', code: AL_ALIAS },
    ],
  },
  {
    type: 'group',
    label: 'Registers',
    children: [
      {
        type: 'group',
        label: 'AX',
        children: [
          { type: 'code', code: AX_PROPERTY },
          {
            type: 'group',
            label: opcodeGroupLabel('AX'),
            children: [
              { type: 'code', code: ADD_RM8_REG8_ROW },
              { type: 'code', code: ADD_RM16_REG16_ROW },
              { type: 'code', code: ADD_AX_ROW },
              { type: 'code', code: OR_RM8_REG8_ROW },
            ],
          },
        ],
      },
      {
        type: 'group',
        label: 'CS',
        children: [
          { type: 'code', code: CS_PROPERTY },
        ],
      },
      {
        type: 'group',
        label: 'IP',
        children: [
          { type: 'code', code: IP_PROPERTY },
        ],
      },
      {
        type: 'group',
        label: 'flags',
        children: [
          { type: 'code', code: FLAGS_PROPERTY },
        ],
      },
    ],
  },
  {
    type: 'group',
    label: 'Flag arithmetic',
    children: [
      { type: 'code', code: ADD_FLAGS16_FN },
    ],
  },
];
