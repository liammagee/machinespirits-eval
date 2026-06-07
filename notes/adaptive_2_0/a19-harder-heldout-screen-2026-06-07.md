# A19 Harder Held-Out Screen

Date: 2026-06-07.
Status: two clean local `policy_headroom` cards in one family; threshold met
only for a bounded Paper 2.0 / atlas scope update, not for a pooled A19 rate.

## Boundary

This note records simulated teacher-as-learner screens only. It does not claim
human learning, deployed adaptive tutoring, model-weight learning, a main-harness
effect, paid panel evidence, or a general A19 transfer effect.

## Protocol Change

The v3 materializer now supports sibling-specific held-out learner resistance.
That prevents held-out cards from silently inheriting the training-seed learner
line, which made earlier concrete-domain cards too easy for S0 to self-solve.
The validator also checks selected-policy marker leakage in held-out learner
resistance, not only in held-out setup text.

## Candidates Screened

### `fraction_common_unit_counterexample_c`

- Held-out base:
  `exports/a19/materialized-attempts-v3/fraction-common-unit-counterexample/fraction-common-unit-counterexample-c/heldout-base.full.md`.
- S0 replay:
  `exports/a19/real-s0s1-harder/fraction-common-unit-counterexample/fraction-common-unit-counterexample-c/s0-replay/`.
- Initial S0 adjudication:
  `exports/a19/real-s0s1-harder/fraction-common-unit-counterexample/fraction-common-unit-counterexample-c/s0-headroom.free-text.json`.
- Calibrated S0 adjudication:
  `exports/a19/real-s0s1-harder/fraction-common-unit-counterexample/fraction-common-unit-counterexample-c/s0-headroom.free-text-calibrated.json`.

Result: stop before S1. The first mapper read was a false headroom candidate:
S0 named the old shortcut as the failed move and already converted the fractions
to a common unit. After alias and failed-shortcut calibration, S0 classified as
`target`. Verdict: ceiling/self-solve, not transfer evidence.

### `temperature_unit_conversion_aggregation_c`

- Held-out base:
  `exports/a19/materialized-attempts-v3/temperature-unit-conversion-aggregation/temperature-unit-conversion-aggregation-c/heldout-base.full.md`.
- S0 replay:
  `exports/a19/real-s0s1-harder/temperature-unit-conversion-aggregation/temperature-unit-conversion-aggregation-c/s0-replay/`.
- S0 adjudication:
  `exports/a19/real-s0s1-harder/temperature-unit-conversion-aggregation/temperature-unit-conversion-aggregation-c/s0-headroom.free-text.json`.

Result: stop before S1. S0 converted readings onto one thermometer scale before
averaging and was adjudicated `target`. Verdict: ceiling/self-solve, not
transfer evidence.

### `surface_agreement_uptake_c`

- Held-out base:
  `exports/a19/materialized-attempts-v3/surface-agreement-uptake/surface-agreement-uptake-c/heldout-base.full.md`.
- S0 replay:
  `exports/a19/real-s0s1-harder/surface-agreement-uptake/surface-agreement-uptake-c/s0-replay/`.
- S0 headroom adjudication:
  `exports/a19/real-s0s1-harder/surface-agreement-uptake/surface-agreement-uptake-c/s0-headroom.free-text.json`.
- S1 replay with exactly one admitted axiom:
  `exports/a19/real-s0s1-harder/surface-agreement-uptake/surface-agreement-uptake-c/s1-axiom-replay/`.
- Paired free-text adjudication:
  `exports/a19/real-s0s1-harder/surface-agreement-uptake/surface-agreement-uptake-c/blind-adjudication.free-text-axiom.json`.

Result: local `policy_headroom`. S0 was adjudicated `neither`: it supplied a
domain warrant about simplifying inside terms, but did not commit to the
registered public transfer-control move. S1, with exactly one admitted
surface-agreement axiom and no replay bundle, was adjudicated `target`: it used a
public check/value test and a fresh expansion procedure to force the learner's
old rule against a discriminating case.

### `surface_agreement_uptake_d`

- Held-out base:
  `exports/a19/materialized-attempts-v4/surface-agreement-uptake/surface-agreement-uptake-d/heldout-base.full.md`.
- S0 replay:
  `exports/a19/real-s0s1-harder/surface-agreement-uptake/surface-agreement-uptake-d/s0-replay/`.
- S0 headroom adjudication:
  `exports/a19/real-s0s1-harder/surface-agreement-uptake/surface-agreement-uptake-d/s0-headroom.free-text.json`.

Result: stop before S1. S0 was adjudicated `target`: without policy memory, it
already refused agreement as transfer, used a public value check on `(a + b) / a`,
and named the cancellation boundary. Verdict: ceiling/self-solve, not transfer
evidence. This is a useful calibration negative because it shows that the
surface-agreement family is not automatically counted positive.

### `surface_agreement_uptake_e`

- Held-out base:
  `exports/a19/materialized-attempts-v5/surface-agreement-uptake/surface-agreement-uptake-e/heldout-base.full.md`.
- S0 replay:
  `exports/a19/real-s0s1-harder/surface-agreement-uptake/surface-agreement-uptake-e/s0-replay/`.
- S0 headroom adjudication:
  `exports/a19/real-s0s1-harder/surface-agreement-uptake/surface-agreement-uptake-e/s0-headroom.free-text.json`.
- S1 replay with exactly one admitted axiom:
  `exports/a19/real-s0s1-harder/surface-agreement-uptake/surface-agreement-uptake-e/s1-axiom-replay/`.
- Paired free-text adjudication:
  `exports/a19/real-s0s1-harder/surface-agreement-uptake/surface-agreement-uptake-e/blind-adjudication.free-text-axiom.json`.

Result: local `policy_headroom`. S0 was adjudicated `neither`: it supplied the
correct square-of-a-sum warrant through a split-square model, but did not commit
to the registered public transfer-control move. S1, with exactly one admitted
surface-agreement axiom and no replay bundle, was adjudicated `target`: it forced
the learner's "square passes through plus" rule against a two-route numerical
check and then required re-application to a fresh expression.

## Consequence

This is now two clean local A19 headroom cards, both in
`surface_agreement_uptake` (`surface_agreement_uptake_c`,
`surface_agreement_uptake_e`). That is enough to update Paper 2.0 and the atlas
with a narrow, scope-bound local pilot result. It is not enough for a pooled A19
rate, a sidecar empirical claim independent of Paper 2.0, or any human-learning,
deployed-tutor, model-weight-learning, main-harness, or paid-panel claim.

The useful next unit is another surface-agreement or uptake-gate sibling, not
more obvious concrete arithmetic/measurement cards, because the concrete-domain
cards continue to collapse into S0 self-solve. Before stronger sidecar claims,
the current positive cards need stability reruns, multi-critic or paid-panel
adjudication, and eventually human expert double-coding for high-value claims.
