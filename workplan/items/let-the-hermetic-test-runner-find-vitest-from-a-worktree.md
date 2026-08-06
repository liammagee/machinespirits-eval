---
id: let-the-hermetic-test-runner-find-vitest-from-a-worktree
title: Let the hermetic test runner find Vitest from a worktree
status: review
type: infra
priority: P3
owner: claude
source: manual
created: 2026-08-07
updated: 2026-08-07
verification: "npm test completes from a .claude/worktrees/* checkout: both the
  root Node phase and the in-housed tutor-core Vitest phase run and report. A
  unit case drives buildCoreTestArgs against a fixture main-checkout/worktree
  layout and against a root with no install above it."
claim_status: methods
links:
  code:
    - scripts/hermetic-test-contract.js
    - scripts/run-hermetic-tests.js
    - scripts/run-risk-coverage.js
tags:
  - testing
  - tooling
  - git-worktrees
milestone: evaluation-infrastructure
branch: claude/confident-jennings-9c45c6
---

`npm test` could not finish in a worktree under `.claude/worktrees/`. The root
Node phase passed, then the in-housed tutor-core phase died with
`Cannot find module '<worktree>/node_modules/vitest/vitest.mjs'` and the runner
reported `core Vitest phase omitted its JSON report` — which reads as a broken
report rather than a tool that was never there.

Both arg builders joined the entry point onto the project root:
`buildCoreTestArgs` in `run-hermetic-tests.js` and `buildVitestCoverageArgs` in
`run-risk-coverage.js`. A worktree installs no `node_modules` of its own. Node,
eslint and prettier all reach the main checkout's copy by walking the directory
tree upwards; the join asserts a location instead of asking, so it pointed at a
path nobody installed.

One shared `resolveVitestEntryPoint` in `hermetic-test-contract.js` walks up from
the project root for the first `node_modules/vitest/vitest.mjs` that exists, and
both builders call it. This is the same upward walk that already fixed the lint
hook — see [lint-hook-worktree-node-modules-fallback].

With no install above the root either, the unresolved project-root path comes
back, so a genuinely missing Vitest still fails naming the checkout the caller
asked about rather than the filesystem root.

Log:

- 2026-08-07 — Fixed and verified: the full hermetic gate now runs both phases
  from a worktree. The runner test asserts the fixture worktree layout, the
  fallback, and that the default core phase points at a Vitest on disk rather
  than restating how the path is built.
