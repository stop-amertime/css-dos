# 2026-07-06 — "startRunning called while already running" on every lazy play

Owner report: the player status bar always ended up showing
"startRunning called while already running — no-op" after compile.
Root cause: the lazy path double-fires — `viewer-connected` compiles
the held blob via `compileCabinetBytes()`, whose completion hook
(`if (viewerWaiting && engine) startRunning()`) starts the run, then
the handler's own continuation calls `startRunning()` again and trips
the running-guard. Every lazy build (the default) hit it. Fix in
`calcite-bridge.js`: the lazy branch returns after compiling (the
hook owns the start), and the guard message is demoted from
postStatus to postDebug — legitimate races (second /_stream/fb
viewer, bench-run) shouldn't stamp scary text into the status bar.
Verified: compile → "machine reset; running" stays in the bar; Stop →
Start restarts cleanly with no warning.
