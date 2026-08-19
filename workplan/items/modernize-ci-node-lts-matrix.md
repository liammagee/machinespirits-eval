---
id: modernize-ci-node-lts-matrix
title: Replace EOL Node 20 CI with the supported LTS matrix
status: done
type: infra
priority: P1
owner: codex
source: manual
created: 2026-08-19
updated: 2026-08-19
verification: "The full hosted workflow passes two root shards on Node 22 and Node 24, the hermetic contract starts independently of classification, local parity targets Node 24, package/runtime declarations agree on Node >=22.12, and the resulting hosted critical path is compared with PR #683's four-shard baseline."
branch: agent/modernize-ci-node-lts
links:
  items:
    - optimize-ci-agent-iteration-loop
    - local-ci-parity-runner
tags:
  - ci
  - node
  - developer-experience
  - latency
---

The four root shards are balanced, but the two Node 20 jobs dominate the full
CI critical path. Node 20 is end-of-life, the root dependency graph already
contains a `>=22.12` package, and `better-sqlite3@12.11.1` has no Node 20 Linux
prebuild, so both Node 20 jobs compile it from source.

Acceptance:

- Preserve two full root shards on each of two supported LTS Node versions.
- Replace Node 20 with Node 24 and raise the root package engine floor to the
  repository's existing Node 22.12 runtime boundary.
- Keep local Docker parity and the npm developer entrypoint aligned with the
  hosted secondary runtime.
- Start the hermetic test contract in parallel with change classification while
  retaining both as prerequisites for every selected expensive lane.
- Update workflow contracts and operator documentation without weakening test,
  risk-coverage, PTY/lifecycle, validation, workplan, or packaged-Electron gates.
- Use the first full hosted PR run to compare job and step timing with PR #683.

Baseline:

- 2026-08-19 — PR #683's successful full CI run took 6m26s end to end. Node 22
  shards completed in 2m55s and 2m57s, including 11–12s installs and 2m16s–
  2m23s root tests. Node 20 shards completed in 4m53s and 4m56s, including
  1m34s–1m35s installs and 2m39s–2m52s root tests. The shard membership is
  already balanced; the obsolete runtime and native source build are the tail.

Implementation:

- 2026-08-19 — Prepared the Node 22/24 matrix, Node 24 local parity lane,
  Node >=22.12 package contract, supported publish runtime, parallel contract
  classification stage, focused workflow/runner tests, and operator guidance.
  The final-state card may merge only after the full hosted workflow is green.
