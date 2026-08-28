---
id: ci-bootstrap-ref-governance-hardening
title: Harden CI bootstrap ordering and isolate ref-governance diagnostics
status: review
type: infra
priority: P2
owner: codex
source: review
created: 2026-08-28
updated: 2026-08-28
branch: codex/ci-bootstrap-ref-governance-hardening
verification: A job-scoped regression proves dependency installation precedes every dependency-bearing bootstrap check, local CI runs the same bootstrap cohort, ref governance has an independently selected hosted and local lane, aggregate CI reports every lane conclusion before failing, focused tests and source validation pass, and the hosted PR is green.
links:
  items:
    - ci-change-classifier-escape-audit
    - local-ci-parity-runner
  prs:
    - 838
    - 849
tags:
  - ci
  - reliability
  - developer-experience
---

Close only the residual CI gaps left after the classifier audit and the
test-contract install repair. Reuse `scripts/ci-change-policy.js` and
`scripts/run-local-ci.js`; do not add another classifier, dependency, package
alias, approval mechanism, or paid/model-backed check.

## Acceptance

- Replace global workflow-step counts with a regression scoped to the
  `test-contract` job and its required step order.
- Make the local contract lane run the same zero-network classifier/bootstrap
  tests as hosted CI.
- Give managed-ref validation its own selected hosted and local lane while
  retaining fail-closed selection for unclassifiable changes.
- Print every aggregate lane conclusion and every mismatch before the final CI
  result fails.
- Preserve the active `Protect main` ruleset unchanged.

## Log

- 2026-08-28: Started from `origin/main` at `f42c1b4e` after verifying PRs
  #838, #849, #851, and #850, the live no-bypass protection ruleset, green
  post-merge workflows, and the existing 70/70 focused CI contract cohort.
  No model-backed or paid activity is in scope.
- 2026-08-28: Added a dependency-free, job-scoped bootstrap-order regression;
  aligned the local contract and root/tutor-core lint cohorts with hosted CI;
  selected managed-ref governance independently from lint; added a weekly and
  managed-tag ref monitor; and changed aggregate CI to print and evaluate every
  lane conclusion before failing. The active `Protect main` ruleset was not
  modified.
- 2026-08-28: Verification passed: the pre-install bootstrap regression (1/1),
  focused CI/ref/local-runner tests (78/78), workflow YAML parsing, hermetic
  manifest sync, skill-permission policy, `npm run lint:all`, workplan source
  validation (554/554), current managed-ref validation, `git diff --check`, and
  an automatic local-CI dry run selecting the expected full, ref-governance,
  contract, root/tutor-core lint, test, coverage, validation, and workplan
  lanes. No model-backed or paid calls were made.
