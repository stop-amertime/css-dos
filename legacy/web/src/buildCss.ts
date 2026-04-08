/**
 * buildCss.ts — TypeScript port of build_css.py
 *
 * Transpiles an 8086 binary into a CSS file that runs on calcite.
 * Pure data processing: reads bytes, generates CSS string.
 */

import instructionsJson from '../../x86-instructions-rebane.json';
import templateCss from '../../base_template.css?raw';

// ── Types ──────────────────────────────────────────────────────────────

interface Instruction {
  inst_id: number;
  opcode: number;
  opcode_hex: string;
  group: number | null;
  modrm: boolean;
  length: number;
  name: string;
  stack: number;
  arg1: string | null;
  arg2: string | null;
  writing: boolean;
  flags: number;
}

export interface EmbeddedData {
  address: number;
  data: Uint8Array;
}

export interface VideoRegion {
  segment: number;        // e.g. 0xB800
  size: number;           // bytes, e.g. 4000 for 80x25 text mode
}

export interface BuildOptions {
  memSize?: number;       // default 0x600
  startOffset?: number;   // code start offset within binary (from .start file)
  embeddedData?: EmbeddedData[];
  video?: VideoRegion;    // optional video memory region
}

// ── Constants ──────────────────────────────────────────────────────────

const CPU_CYCLE_MS = 1024;
const PROG_OFFSET = 0x100;
const SCREEN_RAM_POS = 0x300;

const EXTERNAL_FUNCTIONS_START = 0x2000;
const EXTERNAL_FUNCTIONS_END = 0x2010;
const EXTERNAL_IO_START = 0x2100;
const EXTERNAL_IO_END = 0x2110;

const EXTFUNS: Record<string, [number, number]> = {
  writeChar1: [0x2000, 2],
  writeChar4: [0x2002, 2],
  writeChar8: [0x2004, 2],
  readInput:  [0x2006, 0],
};

const ARGS_LIST: (string | null)[] = [
  null,   // 00
  "Ap",   // 01
  "Eb",   // 02
  "Ev",   // 03
  "Ew",   // 04
  "Gb",   // 05
  "Gv",   // 06
  "I0",   // 07
  "Ib",   // 08
  "Iv",   // 09
  "Iw",   // 10
  "Jb",   // 11
  "Jv",   // 12
  "Mp",   // 13
  "Ob",   // 14
  "Ov",   // 15
  "Sw",   // 16
  "AL",   // 17
  "CL",   // 18
  "DL",   // 19
  "BL",   // 20
  "AH",   // 21
  "CH",   // 22
  "DH",   // 23
  "BH",   // 24
  "eAX",  // 25
  "eCX",  // 26
  "eDX",  // 27
  "eBX",  // 28
  "eSP",  // 29
  "eBP",  // 30
  "eSI",  // 31
  "eDI",  // 32
  "ES",   // 33
  "CS",   // 34
  "SS",   // 35
  "DS",   // 36
  "1",    // 37
  "3",    // 38
  "M",    // 39
];

// ── Charset ────────────────────────────────────────────────────────────

function buildCharset(): string[] {
  const raw =
    "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX" +
    ' !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~' +
    "X".repeat(141);

  const chars = [...raw];
  chars[0] = "";
  chars[0x0a] = "\\a ";
  chars[0x22] = '\\"';   // "
  chars[0x5c] = "\\\\";  // backslash
  chars[0x80] = "\u{1F434}"; // horse
  chars[0x81] = "\u2B1B";   // black square
  chars[0x82] = "\u{1F7E8}"; // yellow square
  chars[0x83] = "\u{1F7E9}"; // green square
  chars[0x84] = "\u2591";   // light shade
  chars[0x85] = "\u2588";   // full block
  return chars;
}

// ── Variable helpers ───────────────────────────────────────────────────

type Variable = [name: string, expr: string, initial: string, render: boolean];

function createChosenMemoryInt(name: string, i: number, render: boolean, chosen: number): Variable {
  const prevLine = i > 0
    ? `style(--addrDestA:${i - 1}) and style(--isWordWrite:1):var(--addrValA2);`
    : "";
  return [
    name,
    `if(style(--addrDestA:${i}):var(--addrValA1);${prevLine}style(--addrDestB:${i}):var(--addrValB);else:var(--__1${name}))`,
    String(chosen),
    render,
  ];
}

function createEmptyInt(name: string, i: number, render: boolean): Variable {
  return [
    name,
    `if(style(--addrDestA:${i}):var(--addrValA);style(--addrDestB:${i}):var(--addrValB);else:var(--__1${name}))`,
    "0",
    render,
  ];
}

function createSplitRegister(name: string, i: number, render: boolean): Variable {
  const keyboardClause = name === "AX" ? `style(--__1IP:${0x2006}):var(--keyboard, 0);` : "";
  return [
    name,
    `if(${keyboardClause}` +
    `style(--addrDestA:${i}):var(--addrValA);style(--addrDestB:${i}):var(--addrValB);` +
    `style(--addrDestA:${i - 20}):calc(var(--addrValA) * 256 + --lowerBytes(var(--__1${name}), 8));` +
    `style(--addrDestB:${i - 20}):calc(var(--addrValB) * 256 + --lowerBytes(var(--__1${name}), 8));` +
    `style(--addrDestA:${i - 30}):calc(round(down, var(--__1${name}) / 256) * 256 + --lowerBytes(var(--addrValA), 8));` +
    `style(--addrDestB:${i - 30}):calc(round(down, var(--__1${name}) / 256) * 256 + --lowerBytes(var(--addrValB), 8));` +
    `else:var(--__1${name}))`,
    "0",
    render,
  ];
}

// ── Main build function ────────────────────────────────────────────────

export function buildCss(binary: Uint8Array, options: BuildOptions = {}): string {
  const MEM_SIZE = options.memSize ?? 0x600;
  const embeddedData = options.embeddedData ?? [];
  const CODE_START = PROG_OFFSET + (options.startOffset ?? 0);

  const allInsts = instructionsJson as Instruction[];

  // ── Build variables array ──

  const variables: Variable[] = [
    ["frame-count", "& + 1", "0", true],
  ];

  variables.push(createSplitRegister("AX", -1, true));
  variables.push(createSplitRegister("CX", -2, true));
  variables.push(createSplitRegister("DX", -3, true));
  variables.push(createSplitRegister("BX", -4, true));

  // SP
  variables.push([
    "SP",
    `if(style(--addrDestA:-5):var(--addrValA);style(--addrDestB:-5):var(--addrValB);else:calc(var(--__1SP) + var(--moveStack)))`,
    String(MEM_SIZE - 0x8),
    true,
  ]);
  variables.push(createEmptyInt("BP", -6, true));
  // SI
  variables.push([
    "SI",
    `if(style(--addrDestA:-7):var(--addrValA);style(--addrDestB:-7):var(--addrValB);else:calc(var(--__1SI) + var(--moveSI)))`,
    "0",
    true,
  ]);
  // DI
  variables.push([
    "DI",
    `if(style(--addrDestA:-8):var(--addrValA);style(--addrDestB:-8):var(--addrValB);else:calc(var(--__1DI) + var(--moveDI)))`,
    "0",
    true,
  ]);

  // IP
  variables.push([
    "IP",
    `if(style(--addrDestA:-9):var(--addrValA);style(--addrDestB:-9):var(--addrValB);style(--addrJump:-1):calc(var(--__1IP) + var(--instLen));else:var(--addrJump))`,
    String(CODE_START),
    true,
  ]);

  variables.push(createEmptyInt("ES", -10, true));
  variables.push([
    "CS",
    `if(style(--addrDestA:-11):var(--addrValA);style(--addrDestB:-11):var(--addrValB);else:var(--jumpCS))`,
    "0",
    true,
  ]);
  variables.push(createEmptyInt("SS", -12, true));
  variables.push(createEmptyInt("DS", -13, true));

  // flags
  variables.push([
    "flags",
    `if(style(--addrDestA:-14):var(--addrValA);style(--addrDestB:-14):var(--addrValB);else:var(--newFlags))`,
    "0",
    true,
  ]);

  const varOffset = variables.length;

  // Memory cells
  for (let i = 0; i < MEM_SIZE; i++) {
    variables.push(createChosenMemoryInt(`m${i}`, i, true, i < PROG_OFFSET ? 0x90 : 0));
  }
  variables[0 + varOffset][2] = String(0xCC);

  // External function stubs
  for (let i = EXTERNAL_FUNCTIONS_START; i < EXTERNAL_FUNCTIONS_END; i++) {
    const targetLoc = varOffset + i;
    if (targetLoc >= variables.length) {
      variables.push(createChosenMemoryInt(`m${i}`, i, true, 0xC3));
    } else {
      variables[targetLoc][2] = String(0xC3);
    }
  }

  // External I/O range
  for (let i = EXTERNAL_IO_START; i < EXTERNAL_IO_END; i++) {
    const targetLoc = varOffset + i;
    if (targetLoc >= variables.length) {
      variables.push(createChosenMemoryInt(`m${i}`, i, true, 0x00));
    } else {
      variables[targetLoc][2] = String(0x00);
    }
  }

  // Video memory region (e.g. B800h segment for text-mode VGA)
  const video = options.video;
  if (video) {
    const videoBase = video.segment * 16;  // linear address
    for (let i = 0; i < video.size; i++) {
      variables.push(createChosenMemoryInt(`v${i}`, videoBase + i, true, 0));
    }
  }

  // Load program bytes into memory
  const programStart = PROG_OFFSET + varOffset;
  for (let i = 0; i < binary.length; i++) {
    variables[programStart + i][2] = String(binary[i]);
  }

  // Split into read-write and read-only
  const variablesRw = [
    ...variables.slice(0, programStart),
    ...variables.slice(programStart + binary.length),
  ];
  const variablesRo = variables.slice(programStart, programStart + binary.length);

  // Embedded data (read-only memory regions)
  const embeddedVars: { name: string; addr: number; val: number }[] = [];
  for (const ed of embeddedData) {
    for (let offset = 0; offset < ed.data.length; offset++) {
      embeddedVars.push({
        name: `d${ed.address + offset}`,
        addr: ed.address + offset,
        val: ed.data[offset],
      });
    }
  }

  // ── Template with EXTFUN replacements ──

  let TEMPL = templateCss;
  for (const [k, v] of Object.entries(EXTFUNS)) {
    TEMPL = TEMPL.replaceAll(`#${k}`, String(v[0]));
  }

  // ── Build all replacement strings ──

  const charset = buildCharset();

  // VARS_1: @property declarations
  const vars1 = variables
    .map(
      (v) =>
        `@property --${v[0]} {\n  syntax: "<integer>";\n  initial-value: ${v[2]};\n  inherits: true;\n}`
    )
    .join("\n");

  // VARS_2a: initial value assignments
  const vars2a =
    variablesRw
      .map((v) => `--__1${v[0]}: var(--__2${v[0]}, ${v[2]});`)
      .join("\n") +
    "\n" +
    variablesRo.map((v) => `--__1${v[0]}: ${v[2]};`).join("\n");

  // VARS_2b: calculated expressions
  const vars2b = variables
    .map(
      (v) =>
        `--${v[0]}: calc(${v[1].replace(/&/g, `var(--__1${v[0]})`)});`
    )
    .join("\n");

  // VARS_3: store keyframe
  const vars3 = variablesRw
    .map((v) => `--__2${v[0]}: var(--__0${v[0]}, ${v[2]});`)
    .join("\n");

  // VARS_4: execute keyframe
  const vars4 = variablesRw
    .map((v) => `--__0${v[0]}: var(--${v[0]});`)
    .join("\n");

  // VARS_5: counter reset list
  const vars5 = variables
    .filter((v) => v[3])
    .map((v) => ` ${v[0]} var(--${v[0]})`)
    .join(" ");

  // VARS_6: debug output
  const vars6 = variables
    .filter((v) => v[3])
    .map((v) => `"\\a --${v[0]}: " counter(${v[0]})`)
    .join(" ");

  // READMEM_1
  let readmem1 = `
style(--at:-1): var(--__1AX);
style(--at:-2): var(--__1CX);
style(--at:-3): var(--__1DX);
style(--at:-4): var(--__1BX);
style(--at:-5): var(--__1SP);
style(--at:-6): var(--__1BP);
style(--at:-7): var(--__1SI);
style(--at:-8): var(--__1DI);
style(--at:-9): var(--__1IP);
style(--at:-10):var(--__1ES);
style(--at:-11):var(--__1CS);
style(--at:-12):var(--__1SS);
style(--at:-13):var(--__1DS);
style(--at:-14):var(--__1flags);
style(--at:-21):var(--AH);
style(--at:-22):var(--CH);
style(--at:-23):var(--DH);
style(--at:-24):var(--BH);
style(--at:-31):var(--AL);
style(--at:-32):var(--CL);
style(--at:-33):var(--DL);
style(--at:-34):var(--BL);`;

  // Main memory
  const memParts: string[] = [];
  for (let i = 0; i < MEM_SIZE; i++) {
    memParts.push(`style(--at:${i}):var(--__1m${i})`);
  }
  readmem1 += memParts.join(";");

  // External function memory
  const extFunParts: string[] = [];
  for (let i = EXTERNAL_FUNCTIONS_START; i < EXTERNAL_FUNCTIONS_END; i++) {
    extFunParts.push(`style(--at:${i}):var(--__1m${i})`);
  }
  readmem1 += ";" + extFunParts.join(";");

  // External I/O memory
  const extIoParts: string[] = [];
  for (let i = EXTERNAL_IO_START; i < EXTERNAL_IO_END; i++) {
    extIoParts.push(`style(--at:${i}):var(--__1m${i})`);
  }
  readmem1 += ";" + extIoParts.join(";");

  // Embedded data regions
  if (embeddedVars.length > 0) {
    readmem1 +=
      ";" +
      embeddedVars.map((ev) => `style(--at:${ev.addr}):${ev.val}`).join(";");
  }

  // Video memory region
  if (video) {
    const videoBase = video.segment * 16;
    const videoParts: string[] = [];
    for (let i = 0; i < video.size; i++) {
      videoParts.push(`style(--at:${videoBase + i}):var(--__1v${i})`);
    }
    readmem1 += ";" + videoParts.join(";");
  }

  // INST_ID1
  const instId1 = allInsts
    .map(
      (v) =>
        `style(--inst0:${v.opcode})${v.group !== null ? ` and style(--modRm_reg:${v.group})` : ""}:${v.inst_id}`
    )
    .join(";");

  // INST_STR1
  const instStr1 = allInsts
    .map((v) => `style(--instId:${v.inst_id}):'${v.name}'`)
    .join(";");

  // INST_DEST1, INST_VAL1, INST_FLAGFUN1
  const instDest1Parts: string[] = [];
  const instVal1Parts: string[] = [];
  const instFlagfun1Parts: string[] = [];

  for (const v of allInsts) {
    const safeName = v.name.replace(/\./g, "_").replace(/:/g, "_");

    const dFun = `--D-${safeName}`;
    if (TEMPL.includes(dFun + "(")) {
      instDest1Parts.push(`style(--instId:${v.inst_id}):${dFun}(var(--w))`);
    }

    const vFun = `--V-${safeName}`;
    if (TEMPL.includes(vFun + "(")) {
      instVal1Parts.push(`style(--instId:${v.inst_id}):${vFun}(var(--w))`);
    }

    const fFun = `--F-${safeName}`;
    if (TEMPL.includes(fFun + "(")) {
      instFlagfun1Parts.push(
        `style(--instId:${v.inst_id}):${fFun}(var(--baseFlags))`
      );
    }
  }

  const instDest1 = instDest1Parts.join(";");
  const instVal1 = instVal1Parts.join(";");
  const instFlagfun1 = instFlagfun1Parts.join(";");

  // INST_LEN1
  const instLen1 = allInsts
    .filter((v) => v.length !== 1)
    .map((v) => `style(--instId:${v.inst_id}):${v.length}`)
    .join(";");

  // INST_MODRM1
  const instModrm1 = allInsts
    .filter((v) => v.modrm)
    .map((v) => `style(--instId:${v.inst_id}):1`)
    .join(";");

  // INST_MOVESTACK1
  const instMovestack1 = allInsts
    .filter((v) => v.stack)
    .map((v) => `style(--instId:${v.inst_id}):${v.stack}`)
    .join(";");

  // INST_ARGS1, INST_ARGS2
  const instArgs1 = allInsts
    .filter((v) => v.arg1)
    .map((v) => `style(--instId:${v.inst_id}):${ARGS_LIST.indexOf(v.arg1)}`)
    .join(";");

  const instArgs2 = allInsts
    .filter((v) => v.arg2)
    .map((v) => `style(--instId:${v.inst_id}):${ARGS_LIST.indexOf(v.arg2)}`)
    .join(";");

  // INST_FLAGS1
  const instFlags1 = allInsts
    .filter((v) => v.flags)
    .map((v) => `style(--instId:${v.inst_id}):${v.flags}`)
    .join(";");

  // CHARMAP1
  const charmap1 = charset
    .map((c, i) => `style(--i:${i}):"${c}"`)
    .join(";");

  // READSTR1, READSTR2
  const MAX_STRING = 5;
  const readstr1Parts: string[] = [];
  for (let i = 1; i < MAX_STRING; i++) {
    readstr1Parts.push(`--c${i}: --readMem(calc(var(--at) + ${i}));`);
  }
  const readstr1 = readstr1Parts.join("\n");

  let readstr2 = "";
  for (let i = 0; i < MAX_STRING; i++) {
    let fullstr = "";
    for (let j = 0; j < i; j++) {
      fullstr += `--i2char(var(--c${j})) `;
    }
    if (i < MAX_STRING - 1) {
      readstr2 += `style(--c${i}:0): ${fullstr};`;
    } else {
      readstr2 += `else:${fullstr}`;
    }
  }

  // BOX_SHADOW_SCRN
  const boxShadowParts: string[] = [];
  for (let x = 0; x < 128; x++) {
    for (let y = 0; y < 4 * 3; y++) {
      const memOff = x + y * 128;
      boxShadowParts.push(
        `${x * 8}px ${y * 8 + 8}px rgb(var(--m${memOff}), var(--m${memOff}), var(--m${memOff}))`
      );
    }
  }
  const boxShadowScrn = boxShadowParts.join(",");

  // Embedded data total size
  const totalEmbeddedSize = embeddedData.reduce(
    (acc, ed) => acc + ed.data.length,
    0
  );

  // ── Apply all replacements ──

  const result = TEMPL
    .replace("CPU_CYCLE_MS", String(CPU_CYCLE_MS))
    .replace("READMEM_1", readmem1)
    .replace("INST_STR1", instStr1)
    .replace("INST_ID1", instId1)
    .replace("INST_DEST1", instDest1)
    .replace("INST_VAL1", instVal1)
    .replace("INST_LEN1", instLen1)
    .replace("INST_MODRM1", instModrm1)
    .replace("INST_MOVESTACK1", instMovestack1)
    .replace("INST_ARGS1", instArgs1)
    .replace("INST_ARGS2", instArgs2)
    .replace("INST_FLAGS1", instFlags1)
    .replace("INST_FLAGFUN1", instFlagfun1)
    .replace("READSTR1", readstr1)
    .replace("READSTR2", readstr2)
    .replace("VARS_1", vars1)
    .replace("VARS_2a", vars2a)
    .replace("VARS_2b", vars2b)
    .replace("VARS_3", vars3)
    .replace("VARS_4", vars4)
    .replace("VARS_5", vars5)
    .replace("VARS_6", vars6)
    .replace("BOX_SHADOW_SCRN", boxShadowScrn)
    .replace("CHARMAP1", charmap1)
    .replace("SCREEN_CR", "")
    .replace("SCREEN_CC", "")
    .replace("SCREEN_RAM_POS", String(SCREEN_RAM_POS))
    .replace("FILE_SIZE_DX", String(totalEmbeddedSize >> 16))
    .replace("FILE_SIZE_AX", String(totalEmbeddedSize & 0xFFFF));

  return result;
}
