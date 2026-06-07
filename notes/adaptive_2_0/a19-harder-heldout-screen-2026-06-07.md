# A19 Harder Held-Out Screen

Date: 2026-06-07.
Status: one clean local `policy_headroom` card; threshold not met for Paper 2.0
or atlas projection.

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

## Consequence

This is one clean local A19 headroom card. It is not enough to update Paper 2.0
or the atlas. The current escalation threshold remains at least two clean
`policy_headroom` cards before canonical prose or atlas projection.

The useful next unit is another surface-agreement or uptake-gate sibling, not
more obvious concrete arithmetic/measurement cards, because the concrete-domain
cards continue to collapse into S0 self-solve.
