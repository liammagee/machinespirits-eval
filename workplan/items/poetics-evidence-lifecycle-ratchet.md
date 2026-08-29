---
id: poetics-evidence-lifecycle-ratchet
title: "Make poetics claim evidence durable before a run can close"
status: done
type: infra
priority: P1
owner: codex
source: review
created: 2026-08-28
updated: 2026-08-28
branch: codex/poetics-evidence-lifecycle-ratchet
verification: Fixture-only poetics runs preserve the run, items, critic rows,
  labels, tutor adaptations, semantic measurements, item-gate stream, reports,
  and referenced raw artifacts in a hash-verified durable bundle before
  terminal success; missing or unclassified evidence prevents closeout, an
  interrupted run preserves its partial record, and an inventory test catches
  every new claim-bearing table or runner surface.
claim_status: methods
links:
  code:
    - scripts/package-poetics-run.js
    - scripts/publish-poetics-run-archive.js
    - services/poeticsStore.js
  items:
    - edra-m3-second-mechanism-lexicon
    - enforce-tutor-stub-artifact-lifecycle
    - run-artifact-archiving
  prs:
    - https://github.com/liammagee/machinespirits-eval/pull/847
tags:
  - poetics
  - provenance
  - archive
  - fail-closed
  - supplementary-scan
---

The poetics packager currently exports runs, items, scores, labels, review
flags, tutor-adaptation rows, and referenced files only when someone invokes
it. It does not own the emitted `item_gates.jsonl` evidence, and the prospective
semantic-v5 measurements in the EDRA branch are outside its current bundle.

That is now a demonstrated risk rather than a theoretical one: the EDRA M3
audit retains 27 historical items and 104 critic rows but cannot recover the
original v4 item-gate aggregate or any of its 27 adaptation measurements.

Acceptance:

- Define the complete claim-bearing poetics evidence inventory in one place,
  including database tables and sidecar files, with explicit non-claim-bearing
  exemptions.
- Make successful run/loop closeout write a create-once, hash-verified bundle
  to stable private storage automatically; public release remains a separate
  explicit action.
- Preserve partial and failed attempts without selecting, replacing, or
  recomputing outcomes; resume may fill only genuinely missing prospective
  units.
- Make the packager fail on missing or unclassified claim evidence and add a
  CI ratchet so a new table or runner cannot silently escape the lifecycle.
- Prove the contract entirely with synthetic fixtures and no model calls. Do
  not alter sealed historical manifests or manufacture the missing v4 rows.

The implementation can begin on the existing packager and inventory surfaces
without touching the pending EDRA scorer changes.

2026-08-28: Implemented the post-EDRA-M3 inventory, atomic create-once private
bundle, terminal loop hook, fail-closed manual packaging, and synthetic
inventory/partial-attempt fixtures on
`codex/poetics-evidence-lifecycle-ratchet`; focused tests and source/lint checks
pass. Awaiting PR review.
