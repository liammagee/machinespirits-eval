---
id: expedite-ci-expensive-boundaries
title: Gate expensive CI boundaries and avoid incidental Electron packaging
status: review
type: infra
priority: P1
owner: codex
source: manual
created: 2026-08-18
updated: 2026-08-18
branch: codex/ci-boundary-gating
verification: "Classifier tests prove unrelated package scripts skip the macOS job while runtime, dependency, lockfile, desktop, shared-surface, and workflow changes run it; focused CI/workflow tests and workplan source validation pass, then one hosted PR confirms the classified job behavior."
links:
  items:
    - local-ci-parity-runner
    - automate-browser-and-packaged-electron-tutor-stub-acceptance
tags:
  - ci
  - electron
  - developer-experience
---

Recent study-specific npm aliases changed `package.json`, which legitimately
matched the packaged tutor-surface workflow and allocated a macOS runner even
though the commands did not affect the packaged app. Preserve the fail-closed
Electron parity gate while removing incidental triggers.

Acceptance:

- Record the current hosted workflow and step timing before changing it.
- Remove narrow study-validator aliases and update their call sites to invoke
  the scripts directly with `node`; retain durable or frozen-contract entry
  points.
- Keep manifest and lockfile path filters, but classify `package.json`
  semantically before allocating the macOS runner. Only unrelated scripts-only
  edits may skip; missing/ambiguous metadata must run the full lane.
- Use the same classification in local CI and hosted CI, with tests for both
  skip and fail-closed cases.
- Document the expensive-boundary rule for agents and PR authors without
  weakening Node 20/22, risk-coverage, workplan, or packaged-surface coverage.

Log:

- 2026-08-18 — Baseline inspection found that PR #665's package-only command
  alias triggered the packaged-surface workflow. The macOS job executed for
  1m55s after about 6m of runner queueing; Electron install itself was cached at
  3s, while native ABI rebuild and packaging took 52s combined. The main CI
  matrix remained the critical execution path at about 4m35s.
- 2026-08-18 — Began a source-only implementation on
  `codex/ci-boundary-gating`: remove three narrow aliases, retain the
  live-readiness alias pinned by the frozen HOLD packet, add one shared
  fail-closed classifier for hosted/local CI, and document the boundary.
- 2026-08-18 — Local verification passed: 28 focused workflow, local-CI,
  packaged-surface, registration, route-canary, readiness, and GO-request tests;
  22/22 workplan tests; hermetic manifest sync; workplan source validation
  (513/513); ESLint; zero static cycles; repository Prettier; workflow YAML
  parsing; classifier manual/range/fail-closed smokes; and `git diff --check`.
  The card is in review pending one hosted PR observation. Because this change
  modifies the workflow/classifier boundary itself, that PR should run the full
  packaged lane once; a later unrelated scripts-only manifest change is the
  skip-path confirmation.
- 2026-08-18 — PR #666's first hosted run passed the new classifier and full
  packaged-Electron lane, but both Node-version shard-2 jobs caught a stale
  artifact-lifecycle inventory exemption after the tutor-stub path list moved
  from `run-local-ci.js` to `tutor-stub-surface-ci-policy.js`. Move the
  source-inventory exemption with its owner and rerun the focused audit plus
  the exact shard before updating the PR.
