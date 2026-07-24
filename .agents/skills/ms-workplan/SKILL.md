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
- **`add`/`triage`/`set` auto-render** `BOARD.md` + `board.json` for the local
  dashboard. On feature branches, prefer `--no-render` and commit source files
  only; if the views were refreshed locally, leave their diffs out of the PR:
  ```bash
  npm run wp:source-check                         # feature-branch validation
  node scripts/workplan.js set <id> status active --no-render
  npm run wp:render                               # local/main rendering only
  npm run wp:check                                # strict source + generated check
  ```

## Conventions to enforce
- `items/` is the source of truth; `BOARD.md` / `board.json` are generated —
  never hand-edit them.
- Feature PRs must not commit `BOARD.md` / `board.json`; the serialized
  main-only renderer publishes them after merge. The
  `workplan-generated-update` label is reserved for deliberate renderer
  migrations.
- Link, don't copy: point at the paper §, the note, the export, the run, the PR.
- Every item needs a `verification` line before it can reach `done`.
- For research/paper items, keep `claim_status` in sync with the atlas
  (`docs/research/atlas/atlas.yaml`).

After acting, suggest the next step (triage new inbox items or run
`wp:source-check`; render only for a local dashboard refresh or on `main`).
