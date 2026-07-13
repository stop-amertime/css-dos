# 2026-07-13 — Pre-launch sweep: live Windows build was broken (gitignored WIN100.BIN)

**LANDED** (`128487f`, `e2e1d9a`, `920e9e6`)

End-user pass over css-dos.ahmedamer.co.uk before the HN/Reddit launch.
Blocker found: the live site's Windows 1.01 build failed instantly —
`.gitignore`'s `*.bin` rule had silently swallowed
`carts/0windows101/WIN100.BIN` (never committed), so the deploy lacked
the core Windows binary. Local web verifications passed because dev
servers read carts off disk. Sokoban's `ELEV.BIN` was swallowed too.
Fix: `!carts/**` (must stay last; last-match wins) + both files
committed. Verified on production post-deploy: Windows cabinet builds
(318 MB) and boots to the MS-DOS Executive; Rogue build+boot also
verified end-to-end. Copy sweep in `920e9e6`: stale "Windows is future
work" FAQ rewritten, "0Windows 1.01" display-name leak, 100k→200k×
speedup consistency, freeze-vs-crash contradiction, Doom8088 + Windows
credits added.
