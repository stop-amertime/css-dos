# Conformance testing tools

These tools compare CSS-generated 8086 execution against a reference JavaScript
emulator, tick by tick.

## Files

| File | Purpose |
|------|---------|
| `js8086.js` | Vendored reference 8086 CPU core (emu8 project, ~2700 lines). This is also the source that the transpiler converts to CSS. |
| `ref-emu.mjs` | Runs the reference emulator on a binary, outputs a JSON register trace. |
| `compare.mjs` | Automated tick-by-tick comparison: runs reference emulator and compares against calcite's `--trace-json` output. Finds first divergence. |

## Usage

```sh
# Generate reference trace for a binary
node tools/ref-emu.mjs program.bin > ref-trace.json

# Compare calcite output against reference (requires calcite built)
node tools/compare.mjs program.css ref-trace.json

# Or use calcite's built-in conformance features
cargo run -p calcite-cli -- program.css --trace-json > calcite-trace.json
cargo run -p calcite-cli -- program.css --dump-tick 24
```

## Workflow

1. Generate CSS from a test binary (via transpiler)
2. Run reference emulator: `node tools/ref-emu.mjs test.bin`
3. Run calcite on the generated CSS: `calcite test.css --trace-json`
4. Compare traces: `node tools/compare.mjs`
5. Fix divergences until they match tick-for-tick
6. Scale up to more complex programs
