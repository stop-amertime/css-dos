# 2026-07-07 - site msdos4 `compile error: unreachable` = stale vendored wasm

The site failed to run carts/msdos4 with `compile error: unreachable`
(a Rust panic traps as wasm `unreachable`). Root cause: the size fix
(720K→480K, cabinet 562→442 MB) got the cabinet *loading* again, but
`web/vendor/calcite-pkg/` was cut 2026-07-03 (calcite `4bad19e`) -
before the 2026-07-06 engine work writable cabinets need (windowed
packed-cell backing `a44d2ab`, rep-Copy source fallback `2f0d012`).
The old engine panics while *compiling* the writable cabinet shape.
Native gates (smoke/writable/msdos) drive calcite-cli and cannot
catch a stale wasm bundle. Fix: re-vendored from calcite main
`2f0d012` (wasm-bindgen 0.2.126, no wasm-opt - see the vendor
README's build note re binaryen 108 corrupting funcref table limits).
Verified via headless Chromium against the real bridge worker: old
bundle reproduces the exact failure; new bundle boots to `MS-DOS
Version 4.00` / `A>` (compile ~20 s, banner ~10 s in, peek-mem
0xB8000); hello-text rom cabinet unaffected; native msdos gate PASS.
