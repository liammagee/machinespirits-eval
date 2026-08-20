---
id: add-validator-only-ci-profile
title: Add a fail-closed validator-only CI profile
status: done
type: infra
priority: P1
owner: codex
source: review
created: 2026-08-19
updated: 2026-08-20
verification: "The exact PR #700 file set selects validator-only CI and runs its registered test plus targeted lint/format; the PR #699 file set and every mixed or unknown runtime path select full CI; policy/workflow contract tests and hosted full CI pass."
branch: codex/add-validator-only-ci-profile
links:
  prs:
    - 699
    - 700
    - 703
  items:
    - shorten-full-ci-critical-path
    - upgrade-github-actions-node-runtime
tags:
  - ci
  - latency
  - validation
  - developer-experience
---

PR #700 changed one zero-call authorization validator, its paired contract test,
and workplan metadata, but the generic `scripts/` and `tests/` boundaries
allocated the complete four-shard, PTY, risk-coverage, and repository-wide lint
suite. Add an exact validator registry so this already-bounded maintenance shape
can run its own contract and targeted static checks without weakening fail-closed
classification.

Acceptance:

- Register exact validator and paired-test paths; do not allow a generic
  `scripts/check-*` or `tests/*` pattern.
- Select validator-only CI only when every non-metadata path belongs to a
  registered group, and run every selected group's fixed test list.
- Run changed-range/JSON validation, the registered Node test, and targeted
  ESLint/Prettier checks after a clean dependency install.
- Keep workflow, package, lockfile, service, endpoint, analysis, unknown
  validator, and mixed change sets on full CI.
- Reclassify the exact PR #700 range as validator-only and retain full CI for
  the exact PR #699 range.

Log:

- 2026-08-19 — PR #700 CI run `32308585580` passed in 4m13s, with four standard
  shards taking 2m48s–3m07s; its actual validator contract was 7 tests. PR #699
  run `32307309525` took 6m48s because risk coverage waited 5m04s for a runner,
  and its wider service/analysis/endpoint diff remains outside this profile.
- 2026-08-19 — Added one exact validator/test registry entry and a conditional
  clean-install lane. The historical #700 range selects `validator-only`; the
  historical #699 range and mixed service, endpoint, or unregistered-validator
  examples select `full`. The registered 7-test contract passes in 1.33s and
  changed-range classification plus targeted ESLint/Prettier take another
  0.72s locally after dependencies are present. CI-policy/hermetic workflow
  contracts, manifest synchronization, YAML parsing, formatting, and workplan
  source validation pass; moved to review for the workflow-selected hosted full
  suite.
- 2026-08-20 — PR #703 merged the validator-only profile as
  `abddffd60f223ea06aa1e80f76639e6aa202e67b` after the complete hosted suite
  passed. The registered narrow lane and fail-closed full fallbacks satisfy the
  acceptance contract, so this card is done.
