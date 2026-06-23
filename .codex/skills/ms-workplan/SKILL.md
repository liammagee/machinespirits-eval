---
name: ms-workplan
description: Read, capture, triage and update project work on the workplan board (workplan/ folder + scripts/workplan.js)
argument-hint: <request, e.g. "what's active", "capture: <idea>", "what's blocked on budget">
allowed-tools: Bash, Read, Write, Edit
---

Route the user's request (`$ARGUMENTS`) to the workplan board. The board lives in
`workplan/` (see `workplan/README.md` for the full contract) and is driven by
`scripts/workplan.js`.

## First, read the contract
If you haven't this session, read `workplan/README.md` — it defines the item
schema, lifecycle states, and how each surface interacts. The best-practice
playbook is in `workplan/playbook/`.

## Common routes
- **"what's active / what's blocked / show the board"**
  ```bash
  node scripts/workplan.js list                  # all items, grouped by status
  node scripts/workplan.js list --status active
  node scripts/workplan.js list --blocked
  node scripts/workplan.js show <id>
  ```
- **"capture this idea"** → write an `inbox/` file (don't commit to `items/` yet;
  capture and commitment are separate steps):
  ```bash
  node scripts/workplan.js add --inbox --title "<one line>" --source manual
  ```
- **"triage the inbox / promote this capture"**
  ```bash
  node scripts/workplan.js triage inbox/<file>.md
  ```
- **"update status / pick this up"**
  ```bash
  node scripts/workplan.js set <id> status active --owner <claude|codex|gemini> --branch <branch>
  ```
- **"pull in TODO + daily-routine items"**
  ```bash
  node scripts/workplan.js ingest    # TODO.md open items + notes/daily-notes actions -> inbox/
  ```
- **`add`/`triage`/`set` auto-render** `BOARD.md` + `board.json` (the dashboard
  reads `board.json`), so you rarely call `render` directly:
  ```bash
  node scripts/workplan.js render    # only needed after hand-editing item files
  node scripts/workplan.js validate  # frontmatter vs schema/item.schema.json
  ```

## Conventions to enforce
- `items/` is the source of truth; `BOARD.md` / `board.json` are generated —
  never hand-edit them.
- Link, don't copy: point at the paper §, the note, the export, the run, the PR.
- Every item needs a `verification` line before it can reach `done`.
- For research/paper items, keep `claim_status` in sync with the atlas
  (`docs/research/atlas/atlas.yaml`).

After acting, suggest the next step (triage new inbox items, run `validate`, or
`render` to refresh the dashboard).
