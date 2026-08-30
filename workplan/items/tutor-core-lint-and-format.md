---
id: tutor-core-lint-and-format
title: "Cover the in-housed tutor-core with lint and formatting checks"
status: done
type: maintenance
priority: P3
owner: claude
source: manual
created: 2026-08-27
updated: 2026-08-28
verification: Every committed tutor-core JavaScript file is covered by a
  committed ESLint and Prettier policy, npm run lint:all passes, and the
  tutor-core re-extraction seam guard remains green.
links:
  notes:
    - eslint.config.js
    - .prettierignore
    - TUTOR-CORE-INHOUSING.md
  items:
    - tutor-core-runtime-lint-defects
  prs:
    - https://github.com/liammagee/machinespirits-eval/pull/851
depends_on:
  - tutor-core-runtime-lint-defects
tags:
  - lint
  - formatting
  - tutor-core
  - dependency-seam
---

The in-housed `tutor-core/` tree is excluded from both the repository ESLint
configuration and Prettier while the comment still refers to upstream rules
that are no longer present.

Acceptance:

- Choose and commit one clear policy: adopt `tutor-core/` into the repository
  lint and format configuration, or give the module a real self-contained
  configuration that the root lint lane invokes.
- Cover every committed JavaScript file under `tutor-core/`; do not retain a
  broad exclusion that silently lets new files escape.
- Keep `tutor-core/` re-extractable: it must not import eval-repo services,
  config, routes, scripts, tests, or public assets.
- Run the resulting lint/format lane and `tests/tutorCoreSeamGuard.test.js`.

This is deliberately separate from `codex-default-drift-and-tutor-core-lint`,
which owns only the provider-default projection repair.

- 2026-08-27 — A no-ignore audit found 30 ESLint errors and formatting drift in
  27 of 35 JavaScript files. Two findings can throw at runtime and were split
  into `tutor-core-runtime-lint-defects`; this card now waits for that focused
  repair and owns only the broad policy/formatting adoption.
- 2026-08-27 — Split from the combined default-drift card before any lint or
  formatting configuration was changed.
- 2026-08-28 — Landed. Policy chosen: the module carries its own configuration
  (`tutor-core/eslint.config.js`, `.prettierrc.json`, `.prettierignore`) and the
  root lane invokes it. A policy held in the parent repo would not survive
  re-extraction; one inside the module does. The rules match the eval repo's, so
  a contributor meets one style in both trees, and eslint/prettier are now
  tutor-core's own devDependencies so the module can run its policy alone.
  The root ESLint config still ignores `tutor-core/` — only so nothing is linted
  twice under two rule sets — and its stale comment about absent upstream rules
  is replaced by the real reason. `lint:all` gained `lint:tutor-core` and
  `format:check:tutor-core`; CI runs its lint steps one by one, so both were
  added there too.
  All 28 remaining errors are fixed: 11 `prefer-const` (one destructure split so
  the single reassigned binding keeps its `let`), unused imports removed, and
  accepted-but-unread fields marked `_`-prefixed rather than deleted, so the
  shape a function accepts stays visible. Three documented private helpers
  (`resetStepCounter`, `logFlowEntry`, `getFallbackConfig`) have no caller in
  the vendored tree; they carry a one-line targeted disable rather than being
  deleted, since pruning a vendored module's helpers is its owner's call. 27
  files formatted.
  `tests/tutorCoreLintPolicy.test.js` is the new guard: it asks the tools
  themselves which files they cover and fails if a committed tutor-core file
  escapes, so the broad exclusion cannot quietly return.
  Verification: `npm run lint:all` passes, core suite 142/142,
  `tests/tutorCoreSeamGuard.test.js` green (the module still imports nothing
  from the eval repo).
