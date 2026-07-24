# Git & workflow

Defaults, not laws. Deviate when it helps; note why in the item log.

## Branches
- One branch per active item (or a tight cluster). Name it `<agent>/<topic>`:
  `claude/…`, `codex/…`, `derivation/…`. Put the workplan item id in the branch
  or the PR body so the two are linked.
- `main` is the integration branch and the usual PR base. Don't commit straight
  to it; branch first (the harness enforces this).
- **Know which branch is live.** This fork has had stale look-alike branches
  (`claude/dramatic-derivation` went stale while
  `claude/derivation-fast-iteration` stayed live). Check `git log` before
  building on a branch; record the live branch in the item if it's ambiguous.
- Parallel agent work that mutates files should use isolated worktrees
  (`isolation: worktree` for subagents) so two writers don't collide.

## Commits
- Commit and push **only when asked**. Keep messages plain; the repo already uses
  topic prefixes: `paper:`, `derivation:`, `notes:`, `poetics:`.
- Agent-authored commits end with the `Co-Authored-By:` trailer the harness adds.
- Don't commit `data/` (the DB) or `logs/`. The DB and dialogue logs are
  consolidated into the private archive (standing infra task) — keep generated
  artifacts out of the eval repo.

## PRs
- Link the workplan item id in the PR body. If the template placeholder is left
  untouched, CI can infer the link only when exactly one item declares the PR's
  head branch; unknown and ambiguous branches fail closed. Editing the PR body
  reruns that check. When the work folds a result into the paper, also link the
  paper § and the version.
- Keep workplan changes source-only. Commit `workplan/items/*.md` and other
  authored inputs, but do not commit `workplan/BOARD.md` or
  `workplan/board.json`; they are shared aggregate outputs and are the usual
  source of otherwise pointless merge conflicts. Use `--no-render` with
  mutating workplan CLI commands when practical. If a local UI or command has
  refreshed the views, leave them unstaged or restore those two files before
  opening the PR. Run `npm run wp:source-check`; PR CI applies the same check and
  rejects generated-view diffs.
- A serialized workflow regenerates and strictly checks the views on `main`
  after source changes merge. The `workplan-generated-update` PR label is an
  audited exception for deliberate renderer migrations, not a routine conflict
  workaround.
- Daily-routine roundup PRs follow `notes/daily-notes/README.md`: non-overlapping
  windows, dedup by arxiv id, tile the timeline. Triage their actions into
  `workplan/inbox/` rather than letting them live only in the PR.

## Worktrees
- This checkout (`machinespirits-eval-derivation`) is itself a derivation
  worktree. Long arcs get their own worktree; clean them up once merged.

## When in doubt
Small, reversible, linked. A branch + PR that names its workplan item and states
its verification is the whole discipline.
