# Legacy: JSON instruction database approach (v1)

This directory contains the **original** CSS generation approach, now superseded
by the JS→CSS transpiler (see `../transpiler/`).

## What this was

The v1 approach worked like this:

1. `extra/gen_inst.py` parsed `extra/8086_table.txt` (a hand-written opcode reference)
   and generated `x86-instructions-rebane.json` — a JSON database of all 8086 instructions
   with metadata (opcode, ModR/M, flags, argument types, stack effects).

2. `build_css.py` read a binary `.com` file, decoded every instruction using the JSON
   database, and emitted CSS. Each instruction was decomposed into ~10 parallel dispatch
   tables (`--getDest`, `--getVal`, `--getInstArg1Type`, etc.) that each returned one
   aspect of the instruction's behavior. The results were reassembled via cross-property
   references.

3. `base_template.css` / `base_template.html` provided the CSS skeleton with @function
   definitions for utilities (shifts, sign extension, etc.) and placeholder regions
   (`VARS_1`, `READMEM_1`, etc.) that `build_css.py` filled in.

4. `build_c.py` was a helper to compile C source to an 8086 binary via `gcc-ia16`,
   producing the `.bin` input for `build_css.py`.

5. `web/` was a browser-based version of the same transpiler (TypeScript port of
   `build_css.py` using Vite).

## Why it was replaced

The parallel dispatch table approach had a fundamental synchronization problem: when
~10 independent CSS dispatch chains each independently decode the same instruction,
bugs happen when the tables disagree. A single opcode case in one table could be wrong
while the others were right, producing subtle corruption that was extremely hard to debug.

The new approach (see `../transpiler/`) transliterates a reference emulator's unified
switch statement directly into CSS. One dispatch on opcode, each branch computes
everything that instruction needs inline. Fewer intermediate properties, fewer
cross-property dependencies, fewer bugs.

## File index

| File | Purpose |
|------|---------|
| `build_css.py` | Main transpiler: 8086 binary → CSS (520 lines Python) |
| `build_c.py` | C → 8086 binary via gcc-ia16 (67 lines) |
| `base_template.css` | CSS emulator skeleton with @function defs (1844 lines) |
| `base_template.html` | HTML wrapper with visualization UI (2302 lines) |
| `x86-instructions-rebane.json` | 8086 instruction database (JSON, ~300 entries) |
| `extra/gen_inst.py` | Generates JSON from 8086_table.txt (207 lines) |
| `extra/8086_table.txt` | Hand-written opcode reference table |
| `web/` | Browser-based transpiler (TypeScript/Vite port of build_css.py) |

## Still useful for reference

- `base_template.css` has working CSS @function implementations for bitwise ops,
  sign extension, shifts, ModR/M decode, and flag computation. These patterns will
  be needed by the new transpiler too.
- `build_css.py` has the memory layout code (segments, VGA, embedded data, BIOS
  loading, IVT initialization) that the new approach will reuse.
