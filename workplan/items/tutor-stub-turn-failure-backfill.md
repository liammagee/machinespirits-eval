---
id: tutor-stub-turn-failure-backfill
title: Backfill turn-level tutor-stub failure labels for corrective training
status: done
type: infra
priority: P1
owner: codex
source: manual
created: 2026-07-23
updated: 2026-07-24
verification: Versioned zero-model-call records are emitted incrementally and at
  trace seal, backfilled from current and legacy-compatible JSONL, and ingested
  idempotently into namespaced SQLite tables/views; targeted tests cover guards
  and repairs, point-of-action triggers, immediate and next-turn human feedback
  versus ground-truth validation, next-turn outcomes, seal/quarantine
  exclusions, mode filtering, fail-closed malformed input, SQL replacement, and
  the permanent training-license gate; workplan validation passes.
branch: codex/turn-failure-backfill
depends_on: []
links:
  items:
    - impasse-corpus-phase1
    - program-2-iterated-exhaust-retrain
  prs:
    - https://github.com/liammagee/machinespirits-eval/pull/174
tags:
  - tutor-stub
  - turn-level-labels
  - fine-tuning
  - backfill
---

Build the shared normalization layer behind failure-focused corrective datasets.
The first slice consumes evidence already present in traces and makes no model
calls. It must keep learner signals, rejected tutor candidates, delivered tutor
failures, interaction outcomes, and infrastructure failures distinct.

This item does not replace the human impasse-labeling gate. Automatically
detected no-progress signals remain candidates until validated against that
ground truth.

2026-07-23 Codex: Started in a clean sibling worktree from current
`origin/main`. Initial scope frozen to the deterministic backfill service, CLI,
and targeted tests; live trace emission and SQL ingestion are follow-up slices.

2026-07-23 Codex: Added incremental and sealed `turn_failure_recorded` trace
events plus idempotent SQL ingestion into `tutor_stub_turn_failure_records` and
`tutor_stub_turn_failure_labels`. Human ratings are explicitly human-reported,
not ground-truth validation; all stored records remain unlicensed for training.

2026-07-23 Codex: Verification passed and the implementation moved to review
for branch handoff.

2026-07-24 Codex: Rebased the implementation onto current `origin/main`, reran
the focused and full test suites, and opened PR #174 for review.

2026-07-24 Codex: PR #174 merged as `5c07d2cb` with lint, validation,
workplan, Node 20, Node 22, and review checks passing; moved to done.
