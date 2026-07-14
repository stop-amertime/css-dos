# Conformance

JS reference emulators used to diff calcite's output against a known-good
run of the same cart. Each reference emulator mirrors one BIOS flavor.

| File | BIOS flavor | Used for |
|---|---|---|
| `ref-hack.mjs`    | Gossamer | .COM programs via the hack path. No DOS. |
| `ref-corduroy.mjs`| Corduroy | (Future - will land when Corduroy stabilizes.) |

They share the same JS 8086 core (`tools/js8086.js`) and the
peripheral/BIOS-handler shims in `tools/lib/`.

> The old `ref-muslin.mjs` (Muslin full-DOS reference) was removed: it
> had bit-rotted past the BIOS reorganisation (it assembled a BIOS
> source that now lives in `legacy/`, and read a disk image that was
> never part of the repo). The current full-DOS conformance path is
> `node tests/harness/pipeline.mjs fulldiff <cabinet>.css`.

## Running

Each ref emulator is a standalone node script. See the file header for
flags. In general:

```
node conformance/ref-hack.mjs <program.com> <gossamer.bin> <ticks> [--json]
```

For full-DOS carts, use the harness fulldiff path instead:

```
node tests/harness/pipeline.mjs fulldiff <cabinet>.css
```
