# Priority-1 retired-worktree audit — 2026-07-22

This is a read-only retention audit. No worktree, branch, tag, or untracked file
was deleted.

## Safe removal candidates after an explicit deletion decision

- `.claude/worktrees/agon-game` is clean. Its branch is already an ancestor of
  current `main`, and its former remote branch is gone.
- `.claude/worktrees/blueprint-composition` is clean and detached at
  `bec132f6`, preserved by `archive/worktree-blueprint-composition`. Its merge
  topology is not a direct ancestor of `main`, but the worktree's material
  paper delta is already present through the merged blueprint closeout.
- `../machinespirits-eval-human-coding-ui` is clean. Branch
  `codex/human-coding-admin-ui` at `445c9c39` is already an ancestor of
  current `main`.

## Conditional candidate: inspect/discard obsolete untracked copies first

- `../ms-phase5-pinned` is at `27aae3b7`, preserved by
  `archive/program-2-phase5-pinned-runtime`; its former remote branch is gone.
  It contains two untracked files:
  `scripts/analyze-program2-live-pilot-5d.mjs` and
  `scripts/program2-phase5d-safety-breakdown.mjs`. Comparison against current
  `main` found the maintained copies on `main` to be at least as complete: the
  main analyzer contains the self-contained span predicate fix and both main
  copies include later formatting. These are obsolete local copies, not unique
  improvements. Do not remove this worktree until the operator explicitly
  authorizes discarding those two untracked files and rechecks the archive tag.

## Runbook consequence

Future Program-2 probes must start from a fresh isolated worktree at current
`main`, freeze that experiment's exact SHA, and treat the archive tags only as
provenance. They must not reactivate the Phase 5 pinned runtime as a maintained
execution line.
