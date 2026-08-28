---
id: ci-change-classifier-escape-audit
title: "Audit the CI change classifier for regression escape paths"
status: triaged
type: infra
priority: P2
owner: codex
source: manual
created: 2026-08-27
updated: 2026-08-27
verification: A written audit enumerates every path through the change
  classifier (full, focused, validator-only) and, for each skipped lane, either
  proves the skip safe or lands a fix; each found escape gets a regression
  test that plants a change of that class and asserts the classifier requires
  the full lanes; the audit note is committed under notes/.
claim_status: methods
links:
  notes:
    - scripts/ci-change-policy.js
    - .github/workflows/test.yml
tags:
  - ci
  - codex-sol
  - effort-ultra
---

Only the test-contract lane runs on every push. The lint lane, both test
shards, the pty-concurrency lane, and the risk-coverage lane all hang on the
change classifier (`scripts/ci-change-policy.js`) saying a full run is
required. If its focused or validator-only classification can mislabel a
change that alters runtime behavior, a real regression merges with green CI.

The job: adversarial audit, not rewrite. Enumerate the classification rules,
construct concrete change sets that each rule would wave through, and decide
for each whether the waved-through set can change behavior a skipped lane
would have caught. Fix what fails, with a planted-change regression test per
escape. Renamed files, deleted tests, config-only edits that feed runtime
loaders, and workflow edits themselves are the likely weak spots.

Suggested worker: Codex Sol at Ultra reasoning effort — the value is in the
adversarial enumeration, and the whole audit runs offline.
