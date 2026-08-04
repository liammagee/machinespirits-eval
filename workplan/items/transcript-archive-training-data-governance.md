---
id: transcript-archive-training-data-governance
title: Govern transcript archives, ratings, and reusable training corpora
status: done
type: infra
priority: P1
owner: codex
branch: codex/transcript-archive-training-data-governance
source: manual
created: 2026-07-25
updated: 2026-08-04
verification: A clean-room build resolves every source through the private asset
  catalog, reproduces or exception-documents Program-2 v1, honors sole-owner
  opt-outs while excluding external/unknown human data and holdouts, emits
  row-level lineage and immutable manifests, and refuses unapproved training
  inputs.
claim_status: methods
links:
  prs:
    - https://github.com/liammagee/machinespirits-eval/pull/477
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
- 2026-08-04: Restored the tracked Program-2 v1-to-TRL exporter. A clean
  private-data rebuild reproduces the historical instruct, base, and KTO files
  byte-for-byte (865/865/1,676 rows) and emits explicit three-row exception
  and 2,541-row lineage ledgers without changing the frozen originals.
- 2026-08-04: Added tracked redacted asset/holdout/approval/corpus schemas,
  conservative validators, atomic seal/copy verification, retrospective audit,
  and append-only private registries. Initialized the private catalog with nine
  Program-2 assets plus five protected asset seeds and all 16 Program-2
  dev/heldout dialogue groups; every retrospective root/hash verifies.
- 2026-08-04: Added stable immediate/enriched rating joins (including a legacy
  migration), source trace asset IDs, and a zero-model candidate exporter. It
  requires a sealed catalogued source, owner reuse eligibility, safety, and
  holdout clearance; strips comments; keeps the three outcomes separate; and
  rejects exact, normalized, and near duplicates.
- 2026-08-04: Gated the frozen Program-2 SFT/KTO entrypoints on the exact
  approved corpus manifest, purpose, model, active approval, file hashes, and
  inherited holdouts before the Python training stack loads. Focused tests
  cover refusal before approval, acceptance after scoped approval, revocation,
  tamper detection, restore/seal verification, and tutor-stub integration.
- 2026-08-04: PR #477 merged as `797ea044`; verification passed and the card
  closed. The private approval registry remains empty by design, so this
  governance boundary authorizes no training on its own.
