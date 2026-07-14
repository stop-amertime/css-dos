# Logbook Protocol

The logbook is **not one growing file**. It is:

- **`STATUS.md`** - the durable handbook (auto-loaded by CLAUDE.md).
  Current state, release bar, sentinels, active work (≤5 items),
  gotchas. Edit in place when a fact changes. Hard cap ~170 lines -
  if it grows, something belongs in an entry or a plan, not here.
- **`LOGBOOK.md`** - the **index only**. A tagged table, newest
  first. One row per entry. **Never append a full entry to it.**
- **`entries/`** - one file per entry: `YYYY-MM-DD-slug.md`.

## Writing a new entry

1. Create `entries/YYYY-MM-DD-slug.md`. **≤~15 lines.** Capture only
   what a future agent needs: the finding, the file paths, the
   verification step, the gotcha. No session journal, no narration of
   what you tried in order.
2. Add **one row** to the `LOGBOOK.md` table, newest first:
   `| DATE | TAG | [≤20-word summary](entries/FILE.md) |`
3. Pick the TAG honestly - it is how future agents triage:
   - `LANDED` - shipped AND verified present on main/master
   - `BRANCH` - exists only on an unmerged branch, NOT in main.
     If you write "phase N landed" but it's on a branch, the tag is
     `BRANCH` and the summary must say so.
   - `DEAD` - tried then reverted/abandoned. Summary must say what
     was tried and that it failed.
   - `FINDING` - a measurement/diagnosis still true. State the
     conclusion and the number it hinges on.
   - `PLAN` - a plan was filed; the plan file is the live doc.
   - `SUPERSEDED` - later work invalidated this; name what supersedes.

## Rules

- **Verify before you tag.** A wrong `LANDED` on branch-only or
  reverted work is the single worst thing you can do to this index -
  it is exactly the failure this structure exists to prevent. When a
  "landed" claim is load-bearing, confirm with git/code, not prose.
- **Prune as you add.** If your work made an old entry's conclusion
  false, change its tag to `SUPERSEDED` and point at yours. The index
  must not contain two contradictory live claims.
- **Don't silently rewrite a wrong past entry.** Correct it forward
  with a dated note (see the 2026-05-18 entry for the pattern) so the
  correction is auditable.
- If your entry changes a STATUS.md fact (sentinel, gotcha, current
  state, active work), update STATUS.md in the **same commit**.
- Calcite-engine work logs in `../../../calcite/docs/log.md`, not
  here (per CLAUDE.md). Cross-cutting work logs in both with a
  cross-link. A one-line `FINDING`/`LANDED` index row here pointing
  at the calcite log is fine; the detail lives there.
