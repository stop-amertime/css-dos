## 2026-05-15 - Branch reorg: calcite main == working keyboard state; retire-keyboard + dependents parked

Cleaned up the calcite/CSS-DOS branch divergence that cost the
2026-05-14 session hours of confusion.

**Problem.** CSS-DOS master is post-`old-kbd`-merge (old keyboard
side-channel: `setvar_pulse=keyboard`, SW `?key=`, bridge `'kbd'`).
Calcite `main` had advanced past that with `a5e8eee`/`866d1b3`
(retire keyboard side-channel → `:active` pseudo-class input edges)
plus everything built on top. So CSS-DOS master + calcite main
didn't work together; the bench needed
`CALCITE_REPO=...calcite/.claude/worktrees/old-kbd` as a workaround,
and STATUS (which describes the post-retire path) contradicted the
shipped code.

**What was done.**
- Calcite `main` reset to `ef44f20` (the ex-`old-kbd` tip - the
  keyboard state CSS-DOS master needs). Bench now works on main
  with no `CALCITE_REPO`.
- All the work that was on calcite main past `ef44f20` is preserved
  intact on calcite branch **`feat/retire-keyboard`** (tip
  `a05d85c`): the retire-keyboard input-edge work, the
  crate-extraction refactor (`calcite-pc-video` /
  `calcite-debug-summary`), the rep_fast_forward genericity phases
  1/2/3a, the dispatch-specialise phases 1/2/3.
- CSS-DOS un-reverted retire-keyboard harness/SW/bridge work
  preserved on CSS-DOS branch **`feat/retire-keyboard`** (tip
  `8c54435`).
- Redundant `old-kbd` branches + worktrees deleted from BOTH repos
  (CSS-DOS `old-kbd` was an ancestor of master via `5c4b0ad`;
  calcite `old-kbd` == new main).

**Attempted and abandoned: cherry-pick disentanglement (option B).**
Tried to separate the genericity mission (cardinal-rule work, wanted
on trunk) from the keyboard work (parked) by cherry-picking the
non-keyboard commits onto the reset main. Landed 5 commits clean
(rep_fast_forward phases 1/2/3a + probe_bif_predecessor), each
gated on `cargo build -p calcite-core`. **But that gate was too
narrow** - `4f3efae` (phase 2) silently removed
`State::render_framebuffer` / `read_framebuffer_rgba` (the "move
CGA renderer to calcite-pc-video" half of the genericity mission),
which broke `calcite-cli`/`calcite-wasm` while `calcite-core` still
built. The destination crate (`calcite-pc-video`) is only created
by the later `1dd5151`, whose caller-side rewiring is interleaved
with the keyboard work in `calcite-wasm`/`calcite-cli`/
`calcite-debugger`. **Conclusion: genericity → depends on →
crate-extraction → interleaved with → keyboard. It's one ball.**
Cherry-pick disentanglement is not viable; separating them means
redoing the crate-extraction refactor by hand on a keyboard-free
base (a real task, not a cherry-pick). All cherry-picks fully
backed out; calcite main is exactly `ef44f20`.

**Lesson for future branch surgery on calcite:** gate every
cherry-pick / merge with
`cargo build --release -p calcite-core -p calcite-cli -p calcite-wasm`,
never `-p calcite-core` alone. The video/render code moving between
crates means core can build green while the binaries that matter
for the bench are broken.

**To resume the genericity / perf work:** check out
`feat/retire-keyboard` on both repos. It's all there, in order,
building. The keyboard story (forward to `:active` everywhere, or
stay on the side-channel) has to be decided before that branch can
merge to trunk - that decision is the actual blocker, not the
mechanics.
