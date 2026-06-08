# A19 Real Weak-S0 Screen: Productive Impasse Answer Leakage A

Date: 2026-06-07.
Status: weak-baseline protocol screen; no A19 transfer claim.

## Boundary

This note records one v0.2 real attempt-1 survivor, one admitted axiom, one weak
S0-first held-out screen, and one paired weak S0/S1 free-text adjudication. It
does not license a pooled A19 rate, human-learning claim, deployed tutor claim,
model-weight-learning claim, main-harness effect, paid-panel result, Paper 2.0
claim, atlas projection, or sidecar empirical claim.

The family's S0 stratum is `weak_single_pass_no_policy_memory`. Under the v0.2
protocol this is a protocol-screen-only baseline; it cannot support stronger
claims without a later `recursive_full_no_policy_memory` rerun.

## Attempt-1 Gate

- Family: `productive_impasse_answer_leakage`.
- Materialized prompt:
  `exports/a19/materialized-attempts-v11/productive-impasse-answer-leakage/attempt1.full.md`.
- Initial attempt-1 output:
  `exports/a19/real-attempt1/productive-impasse-answer-leakage/`.
- Retry feedback:
  `exports/a19/real-attempt1/productive-impasse-answer-leakage-feedback-device-specificity.md`
  and
  `exports/a19/real-attempt1/productive-impasse-answer-leakage-feedback-old-warrant.md`.
- Surviving attempt-1 output:
  `exports/a19/real-attempt1/productive-impasse-answer-leakage-retry2/`.
- Attempt-1 gate report:
  `notes/adaptive_2_0/a19-attempt1-real-gate-report-productive-impasse.md`.

The first pass was blocked by `device_specificity=0.62 < 0.7`. The first retry
fixed device specificity but was blocked by
`old_warrant_misclassification=0.55 < 0.7`. The second retry survived with no
gate warnings. The checker extracted the old warrant as a last-line result
check that accepted `x = 14/3` on the broken line while failing against the
original equation, forcing a diagnostic error-location menu.

## Axiom Gate

- Admitted axiom:
  `exports/a19/axioms/productive-impasse-answer-leakage/axiom.json`.
- Axiom ID:
  `a19_productive_impasse_answer_leakage_diagnostic_options_before_answer_001`.
- Repair type: `offer_diagnostic_options`.

The axiom is bounded to cases where the learner asks for the answer because the
source of impasse is unclear. Its replacement move is to offer a small
diagnostic menu and ask the learner to choose or test the stuck point before any
answer reveal. The S1 memory contract remains one axiom only; a full
`revision.json` bundle is not allowed as A19 policy memory.

## Weak S0-First Screen

- Held-out sibling:
  `productive_impasse_answer_leakage_a`.
- Held-out base:
  `exports/a19/materialized-attempts-v11/productive-impasse-answer-leakage/productive-impasse-answer-leakage-a/heldout-base.full.md`.
- Weak S0 replay:
  `exports/a19/real-s0s1/productive-impasse-answer-leakage/productive-impasse-answer-leakage-a/s0-weak-replay/`.
- S0 headroom adjudication:
  `exports/a19/real-s0s1/productive-impasse-answer-leakage/productive-impasse-answer-leakage-a/s0-headroom.free-text.json`.

S0 survived the weak local replay gate. The blind single-arm extractor mapped it
as `neither` against the registered `offer_diagnostic_options` target and
extracted a `transfer_control` repair. This left nominal target headroom, but
only under the weak protocol-screen baseline.

## Paired Weak S0/S1 Contrast

- S1 axiom-only weak replay:
  `exports/a19/real-s0s1/productive-impasse-answer-leakage/productive-impasse-answer-leakage-a/s1-axiom-weak-replay/`.
- Paired free-text adjudication:
  `exports/a19/real-s0s1/productive-impasse-answer-leakage/productive-impasse-answer-leakage-a/blind-adjudication.free-text-axiom-weak.json`.
- S0 class: `neither`; repair type `transfer_control`.
- S1 class: `neither`; repair type `transfer_control`.
- Verdict: `neither_correct`.

The S1 transcript visibly used an A/B/C diagnostic menu, but the blind extractor
treated the final committed repair as transfer control: checking the corrected
answer in the original equation before closure. Because neither arm mapped to
the registered `offer_diagnostic_options` target, this is not a positive A19
transfer result even under the weakened S0 baseline.

## Consequence

The v0.2 new-family branch produced a useful attempt-1 survivor and a valid
single-axiom memory record, but the held-out contrast did not show target-policy
transfer. The immediate failure mode is target granularity: generated tutoring
prose tends to collapse diagnostic-options repair into transfer-control/action
gating at adjudication time.

No recursive-full S0 rerun, stability run, paid panel, Paper 2.0 update, atlas
projection, or sidecar claim is triggered by this result. The next legitimate
protocol work is to decide prospectively whether `offer_diagnostic_options`
should remain a distinct repair family, be retargeted as a subtype of
`transfer_control`, or require an adjudication prompt that distinguishes
choosing a diagnostic lane from merely applying a repaired check.
