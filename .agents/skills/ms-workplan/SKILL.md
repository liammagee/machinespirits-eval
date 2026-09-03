---
name: ms-workplan
description: Read, capture, triage, or update the canonical workplan in workplan/items and workplan/inbox. Use for project status and task tracking; do not write live work to TODO.md or treat generated BOARD.md and board.json as sources.
---

Route the user's request to the workplan board. The board lives in
`workplan/` (see `workplan/README.md` for the full contract) and is driven by
`scripts/workplan.js`.

## First, read the contract
If you haven't this session, read `workplan/README.md` — it defines the item
schema, lifecycle states, and how each surface interacts. Read only the
playbook file relevant to the requested transition or operation.

## Guard closed work
Immediately before suggesting, resuming, or reopening a named item, resolve its
exact id and read the current `workplan/items/<id>.md`. If its status is `done`,
`archived`, or `dropped`, report that disposition and do not present an older
next action as current. Thread history, notes, artifacts, generated board views,
and memory may explain the item but cannot override its current source status.
Never reopen a closed item without an explicit user request. Treat a genuinely
new follow-up as a new item rather than silently extending the closed one.

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
  node scripts/workplan.js add --inbox --title "<one line>" --source manual --no-render
  ```
- **"triage the inbox / promote this capture"**
  ```bash
  node scripts/workplan.js triage inbox/<file>.md --no-render
  ```
- **"update status / pick this up"**
  ```bash
  node scripts/workplan.js set <id> status active --owner <claude|codex|gemini> --branch <branch> --no-render
  ```
- **"pull in TODO + daily-routine items"**
  ```bash
  node scripts/workplan.js ingest --no-render    # TODO.md open items + notes/daily-notes actions -> inbox/
  ```
- **`add`/`triage`/`set` write item sources.** Their compatibility export can
  be skipped with `--no-render`; the Scriptorium reads item sources directly.
  Commit source files only:
  ```bash
  npm run wp:source-check                         # validate authored sources
  node scripts/workplan.js set <id> status active --no-render
  node scripts/workplan.js summary                # concise current counts
  npm run wp:render                               # optional ignored local export
  npm run wp:check                                # source + in-memory renderability
  ```

## Conventions to enforce
- `items/` is the source of truth. `BOARD.md` / `board.json` are ignored local
  exports; never hand-edit, stage, or force-add them.
- Feature PRs commit item/source files only. CI rejects reintroduction of the
  derived views, and no post-merge renderer advances `main`.
- Link, don't copy: point at the paper §, the note, the export, the run, the PR.
- Every item needs a `verification` line before it can reach `done`.
- For research/paper items, keep `claim_status` in sync with the atlas
  (`docs/research/atlas/atlas.yaml`).

After acting, run `npm run wp:source-check` if item sources changed, then stop.
Mention another step only when a concrete unresolved dependency remains; do not
turn a routine board update into a new checklist, card, PR, or approval loop.
