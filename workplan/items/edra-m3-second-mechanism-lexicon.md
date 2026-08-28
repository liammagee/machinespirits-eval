---
id: edra-m3-second-mechanism-lexicon
title: "Finish EDRA M3: second mechanism lexicon, anchor demotion, paper amendment"
status: active
type: research
priority: P2
owner: codex
source: manual
created: 2026-08-27
updated: 2026-08-27
verification: >-
  Forward-only semantic v5 tutor-mechanism and learner-action measurement
  requires two independent, high-confidence judges with quoted before/after
  evidence; representation change is a role-paired subtype, regex cues are
  auxiliary, and ambiguity, invalid evidence, or judge disagreement yields
  measurement_indeterminate. Historical v4 reaggregation is isolated from the
  prospective v5 claim path and fails closed unless the complete v4 measurements
  or original item-gate file are present; missing values are never recoded as
  null, and no historical score is recomputed. D42 is a calibration boundary
  excluded from clean defaults; the frozen, outcome-blind D54-D57 screen promotes
  no candidate from insufficient existing evidence. Paper v3.0.295 distinguishes
  the contemporaneously reported 0.333 lift from a currently computationally
  reproducible result.
claim_status: methods
links:
  notes:
    - notes/poetics/2026-05-28-edra-m3-surgery-spec.md
    - notes/poetics/2026-05-26-stratified-adaptation-pilot.md
    - notes/poetics/2026-08-27-edra-m3-historical-v4-reproducibility-audit.md
    - docs/research/paper-full-2.0.md
  code:
    - scripts/analyze-poetics-tutor-adaptation.js
    - services/poeticsRepresentationChangeAdjudication.js
    - scripts/score-poetics-phase2.js
  tests:
    - tests/poeticsRepresentationChangeAdjudication.test.js
    - tests/runPoeticsAdaptationLoop.test.js
tags:
  - poetics
  - scorer
  - codex-sol
  - effort-ultra
branch: codex/edra-m3-second-mechanism-lexicon
---

The EDRA M3 surgery spec came out of a 13-agent adversarially verified design
pass on the organic-recognition saturation bug. Most of its fixes landed
(de-aliasing, origin demotion, quality-gate parity, retry core, the gate
aggregator). Three pieces are still open, confirmed against live source:

1. FIX 2, the second mechanism lexicon: the mechanism-shift patterns
   (`MECHANISM_SHIFT_PATTERNS`, analyze-poetics-tutor-adaptation.js:477) are
   still the old scenario-bound regex; representation swaps return no hits,
   and the in-file comment near line 841 says exactly that.
2. The anchor-set change: demote D42 to a calibration case, correct its YAML
   evaluation role, screen D54-D57 for a clean third anchor.
3. The paper amendment: the origin-ambiguity rule was never amended with the
   per-critic rationale; it appears only in the spec and a sidecar HTML doc,
   not in paper-full-2.0.md. Run the paper-claim audit after the edit.

The lexicon is the semantically hard part — it must catch real representation
swaps without minting hits from surface wording. That risk class (surface
pattern matched against text it was never tested on) has bitten five times
before; test every pattern on real transcript text first.

Suggested worker: Codex Sol at Ultra reasoning effort.

## Evidence

- 2026-08-27 — Audited the preserved May 2026 substrate without modifying it:
  the three 20260529 iterations retain 27 items and 104 critic rows but zero
  `tutor-adaptation-v4` rows, and the original emitted item-gate/aggregate file
  could not be recovered from repository refs, local project evidence stores,
  recorded task output, or unreachable Git commits. The historical 0.333 lift
  remains a contemporaneous report, not a currently reproducible aggregate.
- 2026-08-27 — Added `--historical-v4 --item-gates-in FILE` for pure
  reaggregation of a recovered sealed gate file. Database reproduction now
  stops before writing any output if an expected v4 measurement is absent. A
  synthetic 27-row contract pins the published 3-positive/6-null/0-leak
  arithmetic; a separate end-to-end 27-item database test pins the missing-
  substrate failure and confirms absent measurements cannot become nulls.
- 2026-08-27 — Amended Paper 2.0 as v3.0.295 to withdraw the 0.333 point estimate
  as active computationally reproducible support while preserving it as a
  historical report. No replacement outcome, score mutation, or historical
  recomputation was introduced; prospective semantic v5 remains separate.
- 2026-08-27 — Added a create-once semantic v5 measurement path while
  preserving the historical v4 analyzer. Stored fixtures cover semantic change
  despite a regex miss, a regex hit without semantic change, one-sided evidence,
  judge ambiguity, and valid label disagreement.
- 2026-08-27 — Split new semantic loops into a preparation stage
  (generate/score/ingest) and a resume stage (semantic analysis/report/gate), so
  item-specific transcripts necessarily exist before the two independent
  judgments. Preparation emits no pass/fail verdict. Claim paths require v5,
  incomplete packets and malformed persisted measurements fail before new
  create-once persistence, completed matching analyses resume at reporting, and
  mixed measurement protocols are reported as indeterminate rather than pooled.
- 2026-08-27 — Corrected D42's role to
  `topic_forced_reorientation_calibration_boundary` and removed it from clean
  loop defaults. Applied the registered two-repeat/four-critic screen to all of
  D54-D57 using only frozen control evidence; none qualifies, and treatment
  outcomes did not enter candidate selection.
- 2026-08-27 — Amended Paper 2.0 as v3.0.294 using its already-published
  022408Z critic-axis evidence and the prospective surgery note. No score,
  result, database row, abstract, headline N, or section number changed.
- 2026-08-27 — After rebasing onto current `origin/main`, the integrated
  fixture-only matrix passes 239/239; lint/format, diff checks, the hermetic
  manifest, commit-to-card linkage, and workplan source validation (543/543)
  also pass. Paper-manifest validation passes 60/60. The final claim audit
  traces every changed methods/empirical statement and finds no drift or
  historical recomputation. Its repository-wide discourse and legacy-integrity
  validators still report their unchanged source-layout guards (three failures
  each); none is caused by a changed empirical claim or guard/source file in
  this card.
- 2026-08-27 — Model/provider activity remained inactive: zero generation,
  judging, or paid calls. All verification used fixtures, mocks, local checks,
  and existing evidence.

## Log

- 2026-08-27 — Activated on
  `codex/edra-m3-second-mechanism-lexicon`; implementation is complete and
  independent current-tree review found no remaining actionable defect. The
  post-review rebase preserves both the upstream descriptive, non-gating
  hamartia-repair signal and this card's semantic-v5 workflow. The card remains
  active because the existing-evidence D54-D57 screen licenses no third clean
  anchor.
- 2026-08-27 — Historical-reproduction follow-up found a preservation blocker:
  the original v4 item-gate artifact and all 27 v4 adaptation measurements are
  absent. The runtime now fails closed, the paper carries the provenance
  correction, and the card remains active pending recovery of authentic
  historical gate evidence or prospective qualification of a third clean
  semantic-v5 anchor.
