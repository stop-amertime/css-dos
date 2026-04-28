# Calcite compiler mission — pointer

The strategic doc lives in calcite (the work happens there):

→ [`../../../calcite/docs/compiler-mission.md`](../../../calcite/docs/compiler-mission.md)

**One-line summary:** Calcite's bytecode interpreter has a 2–4×
peephole-fusion ceiling. The CSS calcite evaluates is a static pure-
functional dataflow graph; compiling that graph at load time has a
30–100× ceiling and matches the actual shape of the problem. This is
the road we're taking for ongoing perf work, in service of the
[doom-perf headline target](doom-perf-mission.md).

**Cardinal rules** (sharpened in [`../../CLAUDE.md`](../../CLAUDE.md)
§ The cardinal rule):

1. Calcite knows nothing above the CSS layer (no x86, BIOS, DOS,
   Doom, cabinet-specific addresses, Kiln emit choices).
2. Load-time compilation only — the "open a `.css` URL, it runs"
   workflow is sacred. No pre-baked artifacts, no allowlist.
3. Ground truth is Chrome / the JS reference, not the v1 interpreter.
   Calcite v2 ships standing alone; v1 stays as conformance backstop
   and debug tool, not as a maintained peer implementation.
4. Generality before performance.

**Status:** proposed, not started. See the calcite-side doc for the
phased plan, decision gates, and open questions. Logbook entries
about phase boundaries land in
[`../logbook/LOGBOOK.md`](../logbook/LOGBOOK.md).
