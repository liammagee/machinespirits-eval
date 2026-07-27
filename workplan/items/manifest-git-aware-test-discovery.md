---
id: manifest-git-aware-test-discovery
title: Hermetic test manifest should ignore what Git ignores
status: review
type: infra
priority: P3
owner: claude
source: manual
created: 2026-07-27
updated: 2026-07-27
verification: >-
  `npm run test:manifest` passes in a working tree that contains gitignored
  agent worktrees under `.claude/worktrees/`, where it previously reported every
  one of their test files as classified drift; a new test in
  `tests/hermeticTestRunner.test.js` builds a real git fixture, puts test files
  in a gitignored directory and asserts they are not discovered, while an
  untracked-but-not-ignored test file still fails the check — and that test
  fails against the previous filesystem walk, so it is not vacuous.
claim_status: planned
branch: claude/manifest-git-aware-discovery
links:
  code:
    - scripts/hermetic-test-contract.js
    - tests/hermeticTestRunner.test.js
  items:
    - workplan-commit-trailer-check
tags:
  - infra
  - testing
  - ci
---

`npm run test:manifest` failed locally while passing in CI. The drift it reported
was every test file under `.claude/worktrees/wizardly-vaughan-9b35e0/` — a
gitignored checkout an agent worktree had left in the tree.

`discoverAllContractTestFiles` walked the filesystem and skipped directories by
**name**, against a hardcoded list (`.git`, `coverage`, `data`, `dist`,
`exports`, `logs`, `node_modules`, `prototypes`, `vendor`). `.claude` was not on
it, so the walk descended into a second full copy of the repo and reported its
tests as belonging to this one.

CI never saw this because CI clones fresh. That is the defect worth naming: **a
check whose local and CI answers differ teaches people to ignore it locally**,
and this one guards something real — that a new test file gets registered.

## The fix

Discovery now asks Git rather than a name list:
`git ls-files --cached --others --exclude-standard -- '*.test.js'`. Tracked files
plus untracked files Git would add, minus everything ignored.

Two properties this preserves deliberately:

- **Untracked-but-not-ignored test files still count.** Adding a test and
  forgetting to register it is exactly the drift the manifest exists to catch,
  and it should fail before the file is committed, not after. `--others` keeps
  that.
- **The filesystem walk remains as a fallback**, used when there is no Git or
  when `projectRoot` is not the repository root (which would make reported paths
  relative to the wrong base). The existing non-git fixture test at
  `tests/hermeticTestRunner.test.js` still exercises that path unchanged.

Checked before switching: every tracked `*.test.js` in the repo lives under
`tests/`, `services/` or `tutor-core/`, and none of the blocklisted directories
contains a tracked test file — so the name list was only ever guarding against
untracked or generated content, which Git's ignore rules already describe more
accurately.

## Provenance

Surfaced by [[workplan-commit-trailer-check]] — the failure was noticed while
running the local gates for that branch, and filed rather than fixed inline to
keep that diff to one concern.
