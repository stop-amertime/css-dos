# Logbook Protocol

This is mandatory. Non-negotiable. Every agent must follow this.

## Before starting work

1. Read `docs/logbook/LOGBOOK.md` — the entire file
2. Read the "Active blocker" and "What's next" sections carefully
3. If your task relates to an active blocker, you ARE continuing that work
4. If your task is NOT in "What's next", ask the user why before proceeding
5. Read any linked docs that are relevant to your specific task

## During work

- If you discover something surprising or non-obvious, note it for your
  logbook entry. These findings are the most valuable part of the entry.
- If you make a decision that a future agent might question, note why.
- If you hit a dead end, note what you tried and why it didn't work.

## Before finishing work (checkpoint)

Update `docs/logbook/LOGBOOK.md` with ALL of the following:

### 1. Update "Current status" section
- Change the conformance tick count if it moved
- Update "Active blocker" if the blocker changed
- Move completed items from "What's next" to "What's working"
- Add new items to "What's next" if you discovered new work

### 2. Update "Uncommitted work" section
- Add any files you changed
- Remove files that were committed

### 3. Update "Recent decisions" section
- Add any architectural or design decisions you made, with dates

### 4. Add an entry to "Entry log"
- Put it at the top (newest first)
- Format:

```markdown
### YYYY-MM-DD — [Session N]: [Brief title]

**What:** [1-2 sentences on what you did]

**Why:** [1-2 sentences on why — the motivation, not the mechanism]

**Key finding:** [The most important non-obvious thing you learned.
This is what makes the logbook valuable. If you didn't learn anything
surprising, say so — "No surprises, straightforward implementation."]

**Blocked on:** [What stopped you, or "Nothing — checkpoint complete."]
```

### 5. Update "What's next" priority order
- Reorder if your work changed priorities
- Add items you discovered
- Remove items you completed

## Entry quality

**Bad entry:** "Fixed INT 13h." (No one can learn from this.)

**Good entry:** "Fixed INT 13h hard disk probes. drbio calls AH=41h for
DL=80h-83h to check LBA extensions. Without CF=1 responses, the kernel
hangs in a retry loop at DDSC init. The `isHardDisk` guard pattern
(check DL >= 128) works for all hard disk subfunctions."

The difference: the good entry tells the next agent *what to expect* and
*why the solution works*. The next agent who touches INT 13h will know
about the hard disk probe pattern without re-discovering it.

## What NOT to put in the logbook

- Code snippets (that's what the code is for)
- Full debugging traces (put these in `docs/debugging/known-bugs.md`)
- Step-by-step implementation instructions (those go in `docs/plans/`)
- Speculation about future features (raise with the user instead)
