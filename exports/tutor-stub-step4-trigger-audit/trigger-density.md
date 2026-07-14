# Step 4 Trigger-Density Audit

Zero model calls. Every input trace was SHA-256 verified before deterministic replay.

Corpus: 68 runs (60 selected Step 2 runs + 8 Green Room performances), one world, profiles affective_resistant and proof_skipper, learner turns 3--24.

## Decision

Retain two claim-bearing triggers. Assign at most one per turn, with `stagnant_repeat` taking priority over `warrant_skip` on co-fires.

| Trigger | Assigned opportunities | Runs firing | Median/run | Baseline compliance | Decision |
| --- | ---: | ---: | ---: | ---: | --- |
| warrant_skip | 484 | 66/68 | 7 | 152/484 (31%) | retain |
| stagnant_repeat | 204 | 55/68 | 2.5 | 57/204 (28%) | retain |
| affective_risk | 53 | -- | -- | -- | reject: unstable false positives |
| regloss | 57 | -- | -- | -- | reject: sparse/imbalanced |

## Cohorts

| Family | Profile | Runs | Warrant opportunities (baseline pass) | Stagnation opportunities (baseline pass) |
| --- | --- | ---: | ---: | ---: |
| greenroom-sonnet | proof_skipper | 8 | 77 (14) | 49 (15) |
| sonnet | affective_resistant | 15 | 38 (8) | 26 (7) |
| sonnet | proof_skipper | 15 | 162 (35) | 43 (9) |
| terra | affective_resistant | 15 | 47 (22) | 52 (18) |
| terra | proof_skipper | 15 | 160 (73) | 34 (8) |

## Frozen trigger forms

- **warrant_skip:** evidence_use is omits_warrant or overleaps_evidence; suppress near-closure and close_inquiry turns. Target: expose_warrant: ask exactly one public, focused question linking the claim to an evidence item or rule; release no premise.
- **stagnant_repeat:** replayed stagnation >= 0.60 and the proposed action family repeats the four immediately preceding tutor actions; suppress glossary, near-closure, and close_inquiry turns. Target: break_stagnation: release a due public premise, otherwise reanchor a different already-public exhibit or material domain.

The deterministic review sample contained 12/12 valid warrant opportunities and 12/12 valid stagnation opportunities. This is an instrument audit, not an outcome claim.

## Launch gate carried into the pre-registration

Each arm x speaking-tutor family pools 10 dialogues (two profiles x n=5). It must yield at least 25 assigned warrant opportunities and 12 assigned stagnation opportunities. Falling below a minimum is an instrument failure for that trigger, not a coaching null.
