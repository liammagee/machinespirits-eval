---
id: lint-hook-worktree-node-modules-fallback
title: Let the lint hook find node_modules from a worktree
status: done
type: infra
priority: P3
owner: claude
source: manual
created: 2026-07-30
updated: 2026-07-30
verification: "Seven cases run against the command extracted from settings.json with jq, so what is tested is what ships: a clean .js in a worktree with no local install exits 0; a relative path exits 0; a non-.js file exits 0; a .js outside any eslint project exits 0 rather than erroring; a real no-undef error exits 2 with the eslint diagnostic; a project with a config but no install anywhere above it exits 1 with the npm install hint; prettier still rewrites badly formatted but lint-clean files. Confirmed live through the harness: a clean Write in this worktree passes, a Write with an undefined variable blocks with the eslint output."
claim_status: methods
links:
  notes:
    - .claude/settings.json
tags:
  - tooling
  - git-worktrees
  - lint
milestone: board-pm
branch: claude/funny-jones-1cc324
---

The `PostToolUse` lint hook ran `./node_modules/.bin/eslint` after `cd`-ing to
`CLAUDE_PROJECT_DIR` — and with that variable unset it fell back to `.`, the
current worktree. Worktrees under `.claude/worktrees/` carry no install of their
own; Node finds dependencies by walking up to the main checkout, but the hook
did not. So every `.js` edit in a worktree failed with
`/bin/sh: ./node_modules/.bin/eslint: No such file or directory` and `exit 2`,
which reads as a lint failure. The linter had not run at all.

Two upward walks replace the single fixed path:

- **Project root** — nearest directory at or above the edited file holding
  `eslint.config.js`. This is what fixes which config and ignore rules apply,
  and the hook `cd`s there before running.
- **Binary** — nearest `node_modules/.bin/eslint` at or above that root, which
  is how Node resolves imports, so a worktree borrows the main checkout's
  install.

Starting from the edited file's own directory rather than the project directory
also fixes a quieter bug. The old hook `cd`ed to `CLAUDE_PROJECT_DIR` and passed
an absolute path from elsewhere, so editing a file in a second registered
working directory — each of which has its own config and install — linted it
under the wrong project's rules.

Two failure modes now report instead of masquerading:

- No install found anywhere above the root: `exit 1` with a `npm install` hint.
  Non-blocking, because a missing toolchain is the operator's problem, not a
  defect in the edit.
- File outside the resolved project: `exit 0` and skipped. Editing a throwaway
  `.js` in a scratchpad used to hit eslint and could fail on a
  file-not-matched-by-config error.
