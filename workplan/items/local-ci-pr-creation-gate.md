---
id: local-ci-pr-creation-gate
title: Gate repository PR creation with adaptive local CI
status: review
type: infra
priority: P1
owner: codex
source: manual
created: 2026-08-07
updated: 2026-08-07
branch: codex/local-ci-pr-create
verification: "A repository PR command validates clean committed state and the final workplan-linked body, passes quick local CI before any push/PR write, detects hosted checks without duplicating the full suite, falls back to full local CI when checks do not appear, and is covered by zero-network orchestration tests."
depends_on:
  - local-ci-parity-runner
links:
  items:
    - local-ci-parity-runner
tags:
  - ci
  - developer-experience
  - github
  - reliability
---

Wrap the repeated commit/push/PR handoff in one repository-owned command. The
command should use local CI as an adaptive admission gate without imposing the
complete expensive suite both locally and on GitHub when Actions is healthy.

Acceptance:

- Require a clean, committed, non-main branch and a valid workplan-linked PR
  body before external writes.
- Run the quick local profile before pushing or creating a PR.
- Push with ordinary hooks intact, create a draft PR, and verify remote SHA
  parity.
- In `auto` mode, briefly wait for hosted checks: mark ready when they attach;
  if none attach, run the full local gate, add its report to the PR body, then
  mark ready.
- Support explicit `quick`, `full`, and draft-preserving modes without shell
  interpolation of user-provided title/body values.
- Keep `gh`, Git, CI execution, polling, and time injectable so tests cover
  success and failure paths without network access or real PR creation.

Log:

- 2026-08-07 — Added `npm run pr:create` with clean-branch and synchronized-base
  preflight, final-body workplan validation, quick local admission before
  remote writes, draft-first creation, hosted-check detection, SHA-matched full
  fallback evidence, and explicit quick/full/draft modes.
- 2026-08-07 — Eleven zero-network orchestration tests cover hosted and fallback
  routes, gate failures, source drift, argument safety, body governance, and
  report provenance. ESLint, Prettier, the hermetic manifest, and workplan
  source validation pass.
