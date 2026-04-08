# JS→CSS Transpiler

**Status: not yet started.** This is where the transpiler will live.

## What it does

Converts the reference 8086 emulator (`tools/js8086.js`, ~2700 lines of JavaScript)
into equivalent CSS custom properties and `@function` definitions. The generated CSS
is a complete 8086 CPU that runs in Chrome via CSS evaluation.

## Why a transpiler

The reference emulator has a clean ~200-case switch statement. Each case does:
decode → read operands → compute → write result → set flags. The patterns are
mechanical and repetitive. Rather than hand-translating 200 opcode cases (error-prone,
takes months), we write a transpiler that reads the JS and emits equivalent CSS.

It does NOT need to be a general JS→CSS compiler. It only needs to handle the
specific patterns that appear in this particular emulator.

## The hard problem

CSS can't express sequential operations. JavaScript says:

```js
let val = getReg(w, reg);
val = val + getMem(w);
setReg(w, reg, val);
setFlags(val);
```

CSS evaluates all properties simultaneously in one tick. So "read, then compute,
then write, then update flags" must be flattened into parallel CSS expressions
that produce the same result in one evaluation pass. That's the main intellectual
challenge.

## JS patterns to recognize

These are the recurring patterns in `tools/js8086.js` that the transpiler must handle:

| JS pattern | CSS equivalent |
|-----------|----------------|
| `getReg(w, reg)` | `var()` with dispatch on `reg` value |
| `setReg(w, reg, val)` | Sets `--addrDest` and `--addrVal` properties |
| `getRM(w, mod, rm)` | ModR/M decode (dispatch on mod/rm, existing CSS pattern in `legacy/base_template.css`) |
| `getMem(w)` | Read from instruction stream at current IP |
| Arithmetic/logic | `calc()` expressions |
| Flag computation | CSS expressions (CF, ZF, SF, OF, PF, AF) |
| Conditional branches | `if(style(--flag: 1))` |
| Memory read/write | Dispatch on address → `var(--mN)` / broadcast write |

## Output structure

The transpiler should produce CSS that looks like:

```css
/* One @function per opcode (or opcode group) */
@function --op_89(--mod, --rm, --reg) returns <integer> {
  /* MOV r/m16, r16 — everything inline */
  --src: /* getReg(1, reg) dispatched */;
  --dest-addr: /* getRM address calculation */;
  result: var(--src);
}

/* Main dispatch */
--result: if(
  style(--opcode: 0x89): --op_89(var(--mod), var(--rm), var(--reg));
  style(--opcode: 0x8B): --op_8B(var(--mod), var(--rm), var(--reg));
  /* ... 200 more cases ... */
);
```

## What to reuse from legacy

The `legacy/` directory has working CSS implementations of:

- Bitwise operations (@function --xor, --and, --or, --not)
- Shift operations (@function --leftShift, --rightShift)
- Sign extension (@function --u2s1, --u2s2 for byte/word)
- ModR/M address decode patterns
- Memory read/write dispatch
- Flag computation
- VGA text-mode rendering
- Memory layout (segments, embedded data, IVT initialization)

These are proven to work in Chrome. The transpiler should emit CSS that uses
the same patterns, not reinvent them.

## Memory and register layout

The CSS represents the 8086 state as custom properties:

- Registers: `--AX`, `--BX`, `--CX`, `--DX`, `--SI`, `--DI`, `--BP`, `--SP`,
  `--CS`, `--DS`, `--ES`, `--SS`, `--IP`, `--FLAGS`
- Split registers: `--AH`/`--AL` derive from `--AX` (and vice versa)
- Memory: `--m0` through `--mN` (one property per byte)
- VGA: memory-mapped at segment 0xB800 (linear 0xB8000)
- BIOS ROM: loaded at segment 0xF000 (linear 0xF0000)

## Implementation plan

See GitHub issue #49 for the full roadmap. The transpiler is Phase 1 (~2 weeks).

Suggested approach:
1. Parse `tools/js8086.js` to extract the switch cases
2. For each case, identify the pattern (which registers read, what computation, which registers written)
3. Emit CSS @function for each opcode
4. Emit the top-level dispatch
5. Emit memory layout (reuse logic from `legacy/build_css.py`)
6. Conformance test against `tools/ref-emu.mjs`
