# CSS-DOS Documentation Index

Pick the section you need. Don't read everything — read the minimum required
for your current task.

## Start here

| Doc | When to read |
|-----|-------------|
| [Logbook](logbook/LOGBOOK.md) | **ALWAYS. Before doing anything.** Current status, active bugs, recent decisions. |
| [Architecture overview](architecture/overview.md) | When you need to understand how CSS-DOS works |
| [Calcite relationship](architecture/calcite.md) | When your work touches calcite or CSS evaluation |

## Architecture (read when you need to understand *how things work*)

| Doc | Contents |
|-----|----------|
| [Overview](architecture/overview.md) | What CSS-DOS is, the cardinal rule, the canonical PC machine |
| [V3 execution model](architecture/v3-execution-model.md) | uOp microcode, double buffer, cycle counter, memory model |
| [CSS-BIOS](architecture/css-bios.md) | How BIOS interrupts work as microcode (INT 10h, 13h, 16h, etc.) |
| [ROM disk plan](architecture/rom-disk-plan.md) | How disk I/O will work for large programs (Doom, etc.) |
| [Calcite relationship](architecture/calcite.md) | Calcite as JIT for CSS, the cardinal rule from both sides |
| [Architecture history](architecture/history.md) | v1 JSON, v2 transpiler, v3 microcode — why each transition |

## Reference (read when you need to *do a specific thing*)

| Doc | Contents |
|-----|----------|
| [Transpiler agent guide](../transpiler/AGENT-GUIDE.md) | How to add/modify 8086 instructions in the transpiler |
| [Conformance testing](reference/conformance-testing.md) | How to run tests, compare traces, find divergences |
| [Debugging DOS kernel](reference/debugging-dos-kernel.md) | EDR-DOS internals, map file, Ralf Brown's, edrdos source |
| [Tools reference](reference/tools.md) | NASM path, Playwright, generate-hacky vs generate-dos |
| [Kernel boot sequence](reference/kernel-boot-sequence.md) | What EDR-DOS does during boot, what BIOS services it needs |
| [Project layout](reference/project-layout.md) | File tree with what each directory/file does |

## Debugging (read when you're investigating a bug)

| Doc | Contents |
|-----|----------|
| [Debugging workflow](debugging/workflow.md) | Standard process: find divergence, diagnose, fix, verify |
| [Known bugs & findings](debugging/known-bugs.md) | Bugs found and fixed, patterns to watch for |
| [Calcite debugger](debugging/calcite-debugger.md) | HTTP API, endpoints, typical debugging sessions |

## Logbook & coordination (read ALWAYS)

| Doc | Contents |
|-----|----------|
| **[LOGBOOK.md](logbook/LOGBOOK.md)** | **THE source of truth for project status.** Current state, active work, what's next. |
| [Logbook protocol](logbook/PROTOCOL.md) | How to write logbook entries (mandatory for all agents) |

## Plans (read when picking up or continuing a workstream)

Plans live in `docs/plans/`. Each plan is a self-contained task list with checkboxes.

## Archive

Completed specs, old plans, and session notes live in `docs/archive/`. Read these
only if you need historical context for a specific decision.

## Calcite docs (sibling repo)

These live in `../calcite/docs/` and cover the JIT compiler side:

| Doc | Contents |
|-----|----------|
| `../calcite/docs/debugger.md` | HTTP debug server API (endpoints, workflows) |
| `../calcite/docs/conformance-testing.md` | fulldiff.mjs, diagnose.mjs, ref-dos.mjs — full tool reference |
| `../calcite/docs/codebug.md` | Co-execution debugger for side-by-side JS/calcite comparison |
| `../calcite/docs/benchmarking.md` | Performance numbers, Chrome comparison |
| `../calcite/CLAUDE.md` | Calcite architecture, cardinal rule, project layout |
