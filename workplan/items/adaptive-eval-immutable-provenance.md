---
id: adaptive-eval-immutable-provenance
title: Immutable evidence kernel for adaptive-tutor experiments
status: review
type: infra
priority: P0
owner: codex
source: review
created: 2026-07-11
updated: 2026-07-11
branch: codex/adaptive-tutor-implementation
verification: "Repository manifest phase0-mock-qa-evidence-v1-61ceb224bb43 checksum-binds a fake-CLI QA parent and semantic child; clean-room restore verifies 11/12 hash-chained events, 14/8 artifacts, two jobs, one seeded draw, and tutor/learner/analyzer role plumbing, then regenerates reports without source mutation. Mock Phase 6, corruption, resume, packaging, focused, lint, workplan, provenance, and hermetic checks pass."
claim_status: methods
links:
  notes:
    - PLAN_4_0/2026-07-11-adaptive-tutor-implementation-plan.md
    - PLAN_4_0/2026-07-11-adaptive-tutor-state-of-evidence.html
    - config/adaptive-tutor-evidence/phase0-mock-qa-evidence-v1-61ceb224bb43.manifest.json
  items:
    - field-planner-phase6-gate
tags:
  - adaptive-tutor
  - provenance
  - reproducibility
  - tutor-stub
  - phase6-gate
milestone: adaptive-tutor-evidence-v1
---

Build Phase 0 of the linked implementation plan. The shared service must keep
intent, execution history, and closeout evidence in separate immutable or
append-only artifacts. New claim-bearing runs remain mock-only until its
clean-room replay and checksum gate passes.

Acceptance boundaries:

- Capture Git and dirty-tree fingerprints without embedding source or secrets.
- Record requested, resolved, and observed models separately by role.
- Record master/per-job seeds, exact job order, lineage, and candidate draws.
- Preserve original, repaired, fallback, and delivered outputs as distinct data.
- Seal a complete checksummed artifact inventory and fail closed on drift.

2026-07-11 Codex: Started on an isolated branch from `preconscious@8f6f6baa`
so the unrelated in-progress DAG-dropout reporting repair remains untouched.

2026-07-11 Codex: Shared write-once plan/append-only events/write-once seal,
deterministic draw replay, strict model-role provenance, guard accounting,
fixed-horizon raw endpoints, archive/restore, and byte-preserving derived
reports are implemented. Fake-model live-like auto-eval and QA transactions,
mock Phase 6, corruption, resume, packaging, and clean-room restore tests pass;
the card is in review pending handoff.

2026-07-11 Codex: Packaged the bounded fake-CLI QA fixture under repository
manifest `phase0-mock-qa-evidence-v1-61ceb224bb43`. A checksum-verified restore
into `/tmp/phase0-mock-qa-evidence-v1-restore` independently verified the QA
parent and semantic learner-profile child: 11/12 hash-chained events, 14/8
inventoried artifacts, two planned jobs, one exact seeded policy draw, and the
three required model-role plumbing observations. Report-only regeneration left
the restored plan, events, and seal byte-identical and both runs still verified.
The manifest discloses the fixed-response PATH shim and excludes model-quality,
state-validity, policy-effect, learning, and provider-attestation claims; its
bulk archive remains a local ignored file.
