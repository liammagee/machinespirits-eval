---
id: push-lint-gate
title: "Run the CI lint lane at push time, not after"
status: done
type: infra
priority: P3
owner: claude
source: manual
created: 2026-08-24
updated: 2026-08-24
verification: "npm run lint:all runs exactly the three CI lint-lane commands (eslint, import cycles, prettier check); installing the hook preserves and chains the existing pre-push hook and uninstalling restores it; a push with a lint or format defect is blocked before it leaves the machine with the fix commands printed; a deletion-only push and a checkout without the script skip cleanly."
claim_status: methods
links:
  notes:
    - workplan/playbook/git-and-workflow.md
tags:
  - ci
  - git-hooks
milestone: board-pm
branch: claude/push-lint-gate
---

Noisy CI failures kept coming from one class: the CI lint lane runs
eslint, the import-cycle check, and prettier's format check, while agents
ran only part of that list before pushing. PR 810 burned a full CI round
on a prettier-only defect in one test file. The fix makes the push gate
equal to the CI lane: `npm run lint:all` is the one combined script,
the pre-push hook (`npm run lint:hook:install`, chained beside the
workplan-trailer hook) runs it and blocks on failure, and the agent docs
order it before any push. `git push --no-verify` stays the escape hatch,
with a stated reason.
