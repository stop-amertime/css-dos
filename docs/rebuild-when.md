# When to rebuild what

The honest answer: **don't think about it.** Use `ensureFresh` (or its
`ensureArtifact(name)` wrapper) and the right thing happens. This doc is
for understanding what's going on under the hood, or for the rare case
where you're building the artifacts manually.

## The artifact graph

```
                     ┌──────────────────────────┐
                     │  carts/<name>/           │
                     │  kiln/                   │
                     │  builder/                │
                     └──────────┬───────────────┘
                                │
                                ▼
   ┌─────────────────┐    ┌─────────────────────┐
   │ bios/corduroy/  │───▶│ web/prebake/        │
   │ bios/gossamer/  │    │   corduroy.bin      │
   │ bios/muslin/    │    │   gossamer.bin      │
   └─────────────────┘    │   muslin.bin        │
                          └──────────┬──────────┘
                                     │
                                     ▼
                          ┌─────────────────────┐
                          │ tests/bench/cache/  │
                          │   doom8088.css      │
                          │   zork1.css         │
                          │   ...               │
                          └─────────────────────┘

   ┌─────────────────────────────────┐    ┌────────────────────────────┐
   │ ../calcite/crates/calcite-core  │    │ ../calcite/target/release/ │
   │ ../calcite/crates/calcite-cli   │───▶│   calcite-cli.exe          │
   └─────────────────────────────────┘    └────────────────────────────┘

   ┌─────────────────────────────────┐    ┌────────────────────────────┐
   │ ../calcite/crates/calcite-core  │    │ ../calcite/web/pkg/        │
   │ ../calcite/crates/calcite-wasm  │───▶│   calcite_wasm_bg.wasm     │
   └─────────────────────────────────┘    └────────────────────────────┘
```

## The single source of truth

`tests/bench/lib/artifacts.mjs` declares every artifact, its inputs, and
its rebuild command. Adding a new artifact is one entry. ensureFresh
walks the graph, mtime-checks each artifact against its inputs, and
rebuilds anything stale.

```js
import { ensureArtifact } from './tests/bench/lib/artifacts.mjs';

// Returns the absolute path; rebuilds if stale (transitively).
const path = await ensureArtifact('cabinet:doom8088');
```

## Manual rebuild reference

If you want to build something by hand (say, you're poking at the result
in isolation):

| Edit                           | Rebuild                                                    | Command                                                                   |
|--------------------------------|------------------------------------------------------------|---------------------------------------------------------------------------|
| `carts/<name>/`                | Cabinet                                                    | `node builder/build.mjs carts/<name> -o tests/bench/cache/<name>.css`     |
| `kiln/`, `builder/`            | All cabinets that reference them                           | (same — rebuild whichever cabinet you care about)                         |
| `bios/corduroy/`               | `web/prebake/corduroy.bin` (then any cabinet using it)     | `node web/scripts/prebake.mjs corduroy`                                   |
| `bios/gossamer/` or `muslin/`  | Equivalent prebake bin                                     | `node web/scripts/prebake.mjs <flavor>`                                   |
| `../calcite/crates/calcite-core/`, `calcite-cli/` | Native CLI                              | `cargo build --release -p calcite-cli --manifest-path ../calcite/Cargo.toml` |
| `../calcite/crates/calcite-core/`, `calcite-wasm/` | Web WASM                                | `wasm-pack build ../calcite/crates/calcite-wasm --target web --out-dir ../../web/pkg --release` |
| `../calcite/crates/calcite-debugger/` | Debugger binary (held open by the daemon if running) | `kill-and-rebuild.bat` (calcite repo)                                     |

## Cache layers (clearing browser-side state)

Editing source ≠ the browser sees the new code. The browser caches at
multiple layers:

- **HTTP cache** — the dev server sets `no-store`, so this is fine.
- **Cache Storage** — the player's service worker stashes `/cabinet.css`
  here. Stale cabinet → stale game.
- **Service Worker** — itself cached by the browser.
- **WASM module cache** — the browser caches compiled WebAssembly.
- **Calcite's load-time compile cache** — in-memory, per-tab. Refreshing
  the tab is enough.

The dev server exposes two endpoints to deal with these:

- **`http://localhost:5173/_status`** — JSON of what the server is
  currently serving (commits, file mtimes, hashes).
- **`http://localhost:5173/_reset`** — wipe `web/pkg/` + `web/prebake/`
  on the server side, rebuild both from HEAD.
- **`http://localhost:5173/_clear`** — visit in browser; tiny page that
  unregisters the SW + clears Cache Storage + reloads.

The right reset sequence after a cross-cutting calcite change:

1. `curl http://localhost:5173/_reset` (server-side rebuild)
2. Visit `http://localhost:5173/_clear` in the browser tab (client-side wipe)
3. Reload the player tab

## Why this isn't `make`

We thought about a Makefile. It's true the artifact graph is
make-shaped. But:

- Most of the inputs are JS source for tools that already do their own
  staleness logic (kiln rebuilds opaquely; cargo handles its own
  staleness). Make adds redundant tracking.
- The set of artifacts is small (<10) and rarely grows.
- The bench harness is the primary consumer and is itself JS — calling
  `ensureArtifact()` from JS is one line; shelling out to `make
  cabinet:doom8088` is no clearer.
- A make-graph would be authoritative duplication: the cargo invocation
  for `cli:calcite` already lives in `Cargo.toml`'s metadata; restating
  it in a Makefile means two places to update.

ensureFresh is 200 lines, has one consumer, and gets out of the way.
