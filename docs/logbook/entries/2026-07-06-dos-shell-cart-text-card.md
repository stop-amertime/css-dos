# 2026-07-06 — dos-shell cart (stage 1) + cover-less text card + wide custom bar

New `carts/dos-shell`: nine FreeDOS 1.3 utilities (EDIT, EDLIN, DEBUG,
MEM, TREE, FIND, SORT, MORE, CHOICE — GPL2/MIT, provenance in
`carts/dos-shell/licenses/`) + README.TXT, `boot.runCommand: ""` →
drops to `A:\>`. Verified booting to prompt via fast-shoot @5M ticks;
individual programs NOT yet exercised (owner testing; disk is
read-only so editors can't save — that's the stage-2 plan).

Site: `display.bullets`/`display.accent` (schema + cart-format.md) —
a cover-less featured card rendered as "NAME with: <bullets>" on the
accent colour; the custom upload card became a full-width dashed bar
under the grid ("…or load your own program"). Playwright-verified:
6 grid cards, text card, wide bar → CustomPanel, pick → configure.

Also fixed cart-format.md's stale `boot.autorun`/`boot.args` sections
(removed 2026-04-27) to `boot.runCommand`, and refreshed the dead
`carts/README.md` table. Stages 2 (writable disk) + 3 (MS-DOS boot):
`docs/plans/2026-07-06-dos-shell-writability-msdos.md`.
