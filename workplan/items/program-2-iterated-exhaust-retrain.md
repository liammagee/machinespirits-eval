---
id: program-2-iterated-exhaust-retrain
title: "Iterated-exhaust retrain: teach the mini its own live moments"
status: dropped
type: experiment
priority: P2
owner: codex
source: manual
created: 2026-07-22
updated: 2026-08-05
verification: "The retrain is explicitly declined after both weights-attribution designs ended without a trained-versus-untuned treatment estimate; Paper §7.12 no longer presents it as future work; no dataset build, training run, or live confirmation is authorized, and the extracted live moments remain archival inputs only."
claim_status: killed
links:
  paper: §6.21, §7.12
  notes:
    - notes/program-2/2026-07-18-cloud-finetune-runbook.md
    - notes/program-2/2026-07-20-phase5-live-pilot-results.md
  items:
    - program-2-context-vs-weights-finetune
    - program-2-committee-floor-ablation
    - program-2-weights-interface-retest
tags:
  - tutor-stub
  - fine-tune
  - committee
  - distribution-shift
milestone: adaptive-tutor-evidence-v1
---

Historical proposal (2026-07-22): the one training route left with a mechanism
behind it. The KTO null
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

2026-08-05 Codex reconciliation: Dropped without building a dataset, training,
or making new paid calls. The required attribution gate did not resolve: the
committee-floor design was retired as under-informative, and its corrected
weights-by-interface successor stopped twice under its frozen pilot futility
rules before producing any trained-versus-untuned treatment estimate. PR #501
records the terminal ruling: no Amendment 2 is implied.

Running this retrain now would bypass the card's own sequence and could not say
whether any later gain came from the weights or from the committee harness.
The existing live-moment extracts remain useful archival inputs, but they do
not license a retrain. Reopening the question requires a new identification
design, a new card, a fresh preregistration, and fresh external-run authority;
it is not a continuation of this experiment.

Paper §7.12 and the v3.0.264 revision entry are corrected in the same change so
the canonical research record no longer recommends the spent attribution test
or its dependent retrain as live future work.
