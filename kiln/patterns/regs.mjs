// Shared register tables used across the pattern emitters.
//
// REG16: the 8086 16-bit register file in ModR/M reg/rm encoding order.
//   Index i is the register selected by reg/rm = i.
// SPLIT_REGS: the four 16-bit registers that have addressable byte halves,
//   with the rm indices of their low (AL/CL/DL/BL) and high (AH/CH/DH/BH)
//   bytes. rm 0-3 = low bytes, rm 4-7 = high bytes.

export const REG16 = ['AX', 'CX', 'DX', 'BX', 'SP', 'BP', 'SI', 'DI'];

export const SPLIT_REGS = [
  { reg: 'AX', lowIdx: 0, highIdx: 4 },
  { reg: 'CX', lowIdx: 1, highIdx: 5 },
  { reg: 'DX', lowIdx: 2, highIdx: 6 },
  { reg: 'BX', lowIdx: 3, highIdx: 7 },
];
