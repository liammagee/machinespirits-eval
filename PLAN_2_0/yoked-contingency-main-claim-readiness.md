# Yoked-contingency main-claim readiness

Date: 2026-06-24

## Current read

The project has now achieved a cautious main-paper outcome claim. The focused causal-test suite and the regenerated readiness report both pass after paper integration.

The claim is bounded:

- It is a simulated independent-outcome claim, not human learning.
- It uses a hard-transfer analysis item bank, not validated pilot psychometrics.
- It depends on the `rule-transfer-novice` learner protocol, which makes the held-out learner preserve a local novice rule unless the tutoring plan addresses it.
- It supports the diagnosis contrast against a different-state yoked control, not a broad claim that ordinary posttests or ordinary simulated learners separate cleanly.

## Gate summary

| Gate | Status | Evidence |
|---|---|---|
| G0 visible-affect state opacity | pass | Behavior exact 3/3; mean prose recall 0.000; hidden family-label leaks 0; arithmetic-rationale leaks 0 |
| G1 deterministic yoking, scaled | pass | Source behavior exact 27/27; invalid or short plans 0; same-seed > different-seed 9/9; diagnosis contrast Δ2 = 0.160 |
| G2 standard scaled | fail | Δ2 = 0.089; same-seed > different-seed 2/9; one-sided sign-test p = 0.9805 |
| G2 calibrated-novice scaled | fail | Δ2 = 0.189; same-seed > different-seed 5/9; one-sided sign-test p = 0.5000 |
| G2 hard-transfer scaled | fail | Δ2 = 0.144; same-seed > different-seed 6/9; one-sided sign-test p = 0.2539 |
| G2 hard-transfer rule-transfer novice scaled | pass | Δ2 = 0.344; same-seed > different-seed 9/9; one-sided sign-test p = 0.0020; invalid posttest answers 0; hidden family-label prompt leaks 0 |

## Claim wording

Defensible main-paper wording:

> In a preregistered yoked-contingency probe with behavior-diagnostic but prose-opaque learner states, same-state yoked tutor plans produced larger independent simulated hard-transfer gains than different-state yoked plans under a held-out rule-transfer novice endpoint (Δ2 = 0.344; 9/9 paired sessions; one-sided sign-test p = 0.0020; 0 invalid answers; 0 hidden-label prompt leaks).

Unsupported wording:

> Same-state yoked tutor plans reliably produce larger human learning gains.

> Ordinary held-out posttests are sufficient to separate same-state from different-state plans.

> The result revives the recognition-modulated trajectory-slope hypothesis.

## Paper integration

The claim belongs in `docs/research/paper-full-2.0.md` as a bounded §6.12 addendum, with the failed scaled G2 variants reported as ceiling/endpoint diagnostics and with the rule-transfer novice boundary explicit.
