---
id: transcript-archive-training-data-governance
title: Govern transcript archives, ratings, and reusable training corpora
status: active
type: infra
priority: P1
owner: codex
branch: codex/transcript-archive-management-plan
source: manual
created: 2026-07-25
updated: 2026-07-25
verification: A clean-room build resolves every source through the private asset
  catalog, reproduces or exception-documents Program-2 v1, honors sole-owner
  opt-outs while excluding external/unknown human data and holdouts, emits
  row-level lineage and immutable manifests, and refuses unapproved training
  inputs.
claim_status: methods
links:
  notes:
    - docs/transcript-archive-and-training-data-management.md
    - PROGRAM-2-FINETUNE-PLAN.md
    - PROGRAM-2-PHASE2-PREREGISTRATION.md
  items:
    - program-2-context-vs-weights-finetune
    - consolidate-logs-db-private-archive
    - adaptive-eval-immutable-provenance
    - impasse-corpus-phase1
    - a1-human-learner-validation
tags:
  - data-governance
  - transcripts
  - fine-tuning
  - tutor-stub
  - provenance
  - privacy
---

Implement the management plan in four bounded slices:

1. Restore Program-2's missing v1-to-TRL formatter, reconcile the tracked 868
   train positives with the frozen 865-row SFT files, and retrospectively
   register its source, corpus, adapters, and evaluations.
2. Add private asset/holdout/approval registries plus tracked redacted schemas
   and inventory/seal verification without moving existing bulk data.
3. Add a fail-closed, zero-call ratings candidate exporter that keeps
   subjective helpfulness, objective progress, and next adaptation separate;
   excludes raw comments; treats sole-owner human/mixed sessions as candidates
   unless opted out; and defaults external/unknown human data to `do_not_train`.
4. Gate training entrypoints on immutable approved corpus manifests, then audit
   retention/replication and complete a clean-room restore drill.

Do not train from a working trace directory or treat an archive, SQL
projection, tuning candidate, guard pass, or rating as an implicit license.

## Log

- 2026-07-25: Implemented the first P2 runtime slice: sole-owner opt-out
  defaults and CLI/keyboard `/settings` controls; remembered settings;
  fail-closed external/unknown classification; session-recipe, trace-resume,
  feedback, transcript, closeout, and learning-summary provenance. The global
  holdout registry and zero-call exporter remain pending.
