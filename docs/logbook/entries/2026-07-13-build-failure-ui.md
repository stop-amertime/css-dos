# 2026-07-13 - build page: failures now show the error instead of silently resetting

Tag: LANDED

Owner-reported (during the WIN100.BIN live-site incident): when a
build threw, `Build.svelte` unmounted the whole progress panel
(`{#if build.busy || build.done}` - both false after the catch), so
the UI snapped back to "Ready to build." with the error only in the
un-rendered progress log. Fix: new `build.failed`/`build.buildError`
state (set in `runBuild()`'s catch, cleared on new build/pick), the
panel now also renders on `failed`, `BuildProgress` shows a red
error box with the message + red bar fill, hint says "Build failed -
details below." Verified e2e via Playwright against the dev server:
404-stubbed `/assets/msdos4/IO.SYS`, built 0windows101 → red bar,
"Build failed: fetch /assets/msdos4/IO.SYS failed: 404 Not Found"
box, panel persists.
