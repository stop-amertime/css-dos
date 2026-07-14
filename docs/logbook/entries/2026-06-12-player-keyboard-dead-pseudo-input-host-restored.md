# 2026-06-12 - player keyboard was dead since the 5-28 merge; pseudo-input host stack restored

User report: calcite player boots doom but keys do nothing. Root
cause: merge `e6c9749` (2026-05-28) resolved its host-side conflicts
to the OLD keyboard model - player hrefs `/_kbd?key=0xSSAA`, SW
`{type:'kbd'}`, bridge `engine.set_keyboard(v)` - while calcite's
matching merge (`8de61a8`) **deleted** `set_keyboard` (x86-aware
side-channel, retired for genericity). Every click threw TypeError
inside a bare `try{}catch{}`. Invisible for 2 weeks because the bench
injects keys via `setvar_pulse` watch actions, never the real path.

Fix (ported from the branch side the merge dropped): hrefs →
`/_kbd?class=kb-X`, SW → `{type:'kbd-active', selector}`, bridge →
`set_pseudo_class_active('active', sel, true/false)` pulses (v48);
first failure now logs loudly instead of being swallowed. Also added
kb-comma/period/slash to kiln's key table (player had them, cabinet
had no rule) and plumbed `disk.sectorsPerCluster` through the
browser-builder (was Node-only, so site builds still loaded slow).
Verified: new e2e `web/tests/kbd-e2e.playwright.mjs` - site build →
player → on-screen Enter ×6 → menu → usergame → ingame. Smoke PASS.
