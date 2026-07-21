---
id: program-2-iterated-exhaust-retrain
title: "Iterated-exhaust retrain: teach the mini its own live moments"
status: triaged
type: experiment
priority: P2
owner: unassigned
source: manual
created: 2026-07-22
updated: 2026-07-22
verification: "A LoRA retrain whose data mixture adds the live committee's own audit-labeled moments (Phase 5/5b/5c extractions via scripts/program2-extract-live-moments.mjs) to the v1 corpus, run under a fresh frozen prereg (mixture, serving pin, bars fixed before training), then confirmed by a fresh live committee run that beats the 5b reference (0.386 vs pooled control 0.150) with CI separation, at no coverage cost and seam parity."
claim_status: planned
depends_on:
  - program-2-committee-floor-ablation
links:
  paper: §6.21, §7.12
  notes:
    - notes/program-2/2026-07-18-cloud-finetune-runbook.md
    - notes/program-2/2026-07-20-phase5-live-pilot-results.md
  items:
    - program-2-context-vs-weights-finetune
tags:
  - tutor-stub
  - fine-tune
  - committee
  - distribution-shift
milestone: adaptive-tutor-evidence-v1
branch: main
---

The one training route left with a mechanism behind it. The KTO null
(2026-07-21: 58/58 byte-identical to SFT, both arms) proved the mini has
extracted everything the archived labels contain; its live weakness is
distribution shift — trained on 865 moments that frontier tutors
created, deployed into moments its own questions create (drift symptoms:
two-question replies, 15/75 no-question moments in Phase 5). The
DAgger-shaped cure: collect the committee's own live moments, label them
with the same frozen audits, retrain on the mixture.

In hand already: 75 Phase-5 moments extracted with the exact live
requests + verdicts (15 compliant SFT-eligible, 60 labeled failures) at
~/.machinespirits-data/program-2/datasets/phase5-live-v1; the 5b (83)
and 5c (61, cross-world) moments are extractable the same way now both
are sealed — ~219 live moments total against the 865 archived. Turnkey
Lambda recipe in the runbook §Session 2b (~$2-3, ~1h).

Gates before any training: (1) the instrument decision must be settled
first — whichever compliance rule is in force defines which live moments
count as training targets (v1 stands per user decision 2026-07-20; a v2
adoption would change the label set); (2) the floor ablation
([[program-2-committee-floor-ablation]]) should run first — if the
harness alone reproduces 0.386, candidate quality is not the binding
organ and this retrain targets the wrong lever; (3) compliant-target
thinness (15-40 rows vs 865) may want a round of committee dialogues run
purely as data harvest before training. Fresh prereg required; nothing
is licensed by the spent Phase 2 ledger.
