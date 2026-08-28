---
id: tutor-core-lint-and-format
title: "Cover the in-housed tutor-core with lint and formatting checks"
status: triaged
type: maintenance
priority: P3
owner: unassigned
source: manual
created: 2026-08-27
updated: 2026-08-27
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
