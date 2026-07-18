---
id: program-2-context-vs-weights-finetune
title: "Program-2: context-versus-weights fine-tune (form-carrier hypothesis)"
status: active
type: experiment
priority: P1
owner: claude
source: manual
created: 2026-07-18
updated: 2026-07-18
verification: "A LoRA-tuned small open model (4-8B), trained on the apparatus's own sealed audit-labeled turns (SFT on audit-passing originals; KTO on unpaired audit labels only if SFT misses), clears pre-registered pass bars on held-out warrant_skip trigger moments graded by the frozen step4-frozen-2026-07-14.v1 deterministic check plus guards and leak audit, AND is non-inferior in a blinded quality review against matched audit-passing originals. Floor (untuned base) measured before thresholds freeze; one SFT + one conditional KTO run licensed; no-tune-and-retry from the Phase 2 freeze."
claim_status: planned
links:
  paper: §7.12, §6.18, §6.19
  notes:
    - PROGRAM-2-FINETUNE-PLAN.md
    - PLAN_4_0/2026-07-17-continue-or-fold.md
    - POINT-OF-ACTION-COACHING-PREREGISTRATION.md
  items:
    - tutor-stub-side-coaching-gate
tags:
  - tutor-stub
  - fine-tune
  - insight-action-gap
  - form-carrier
milestone: adaptive-tutor-evidence-v1
branch: main
---

Test the one hypothesis the closed adaptation programme cannot answer from
existing evidence (paper §7.12): whether the insight-action gap is a
context-versus-weights boundary. Every prior intervention held weights fixed
and moved words; the signature (content present in context, never realized;
realized only under enforcement, at cost) is what a parametric gap predicts.
Train a small open model on the apparatus's own sealed labels (2,076 audited
Step 4 turns; 645 trigger moments; 1,096 audit-passing drafts; 980 failed
drafts as unpaired negatives) and grade with the audits that produced the
labels — zero-call, deterministic, no new judge.

Design guards carried from the fold: DPO on natural repair pairs is
prohibited (the repair side reads worse, §6.18 −0.60 — training toward it
reproduces the documented style regression); KTO on unpaired labels instead.
Blinded quality check gates against template collapse. Phases 0-1 (extraction
+ floor) are free and sanctioned by the plan; training starts only after the
Phase 2 prereg freeze and an explicit user go.

2026-07-18 Claude: Plan drafted and committed (PROGRAM-2-FINETUNE-PLAN.md)
after the user approved developing a fine-tune plan with cloud compute
available. Data availability verified against the archives: the sealed
turn_complete records store the actual speaking-tutor system prompts, so
training examples reconstruct the identical interface the large models faced.
Provider layer already supports OpenAI-compatible base_url for the eventual
live phase (scripts/tutor-stub.js:3021). Awaiting Phase 0-1 execution, then
the Phase 2 freeze gate.

2026-07-18 Claude: PHASE 0 COMPLETE, both gates PASS (user go: "do Phase 0").
Extractor scripts/program2-extract-dataset.mjs walks the sealed Step 4
archive fail-closed (provenance SHA enforced per trace) and emits v1 datasets
to ~/.machinespirits-data/program-2/datasets/v1/: taskA-sft 141 rows
(compliant + original-accepted + leak-clean; the 40 compliant-via-repair
turns are excluded from SFT and retained in eval), general-sft 1,096, kto
2,076 (1,096 true / 980 false), eval-moments 645 (with sealed-trace pointers
for the offline graders), splits.json (seed 20260718, 64/8/8 dialogues
stratified family x profile). Counts reconcile EXACTLY with plan §4 and the
independent Step 4 analysis tallies; leak-filter loss 0%. Training inputs use
original-role model_call requests only (repair-role prompts excluded — they
carry repair instructions). Register/headroom tarballs deferred to a v2
dataset if Phase 3 wants a larger general pool. Manifest:
config/adaptive-tutor-evidence/program-2-dataset-v1.manifest.json; report:
notes/program-2/2026-07-18-phase0-extraction.md. Next: Phase 1 floor
(offline grader + untuned base), then the Phase 2 freeze.

2026-07-18 Claude: Typed-performance SFT corpus v1 extracted (engineering
tier, outside the claim set; Task B data side). Extractor
scripts/program2-extract-typed-performance-corpus.mjs merges the accepted
record fail-closed: Step 4 accepted originals (1,096), V17
character-generalization passing repertoire (15), V52/V53 accepted Tallow
compiled-entry draws (2 + 3 unique of 4), campaign-fixture compiled-entry
originals (3) = 1,119 {prompt, completion} pairs with verbatim recorded
requests; split BY WORLD mirroring V53's transfer matrix (train 1,116;
heldout = ravensmark/skyway/foxtrot, 3 V17-foxtrot pairs + 3 V53
transfer-cell eval contexts with saved rejected drafts); aux
register-outcome frames 4,697. Repair-channel text excluded everywhere per
the plan's DPO prohibition rationale. Deterministic (rerun byte-identical),
split-purity and no-target-in-prompt asserted. Dataset machine-local in
exports/program2-corpus/; tracked manifest
config/adaptive-tutor-evidence/program-2-corpus-v1.manifest.json; note
notes/program-2/2026-07-18-typed-performance-corpus.md. Nothing trains on
it before the Phase 2 freeze + explicit go.
