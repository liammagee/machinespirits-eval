# A19 Real S0/S1 Screen: Temperature Unit Conversion Aggregation A

Date: 2026-06-07.
Status: calibrated ceiling verdict; no A19 transfer claim.

## Boundary

This note records a simulated teacher-as-learner screen only. It does not claim
human learning, deployed adaptive tutoring, model-weight learning, a
main-harness effect, paid panel evidence, or a held-out A19 transfer result.

## Inputs

- Family: `temperature_unit_conversion_aggregation`.
- Held-out sibling: `temperature_unit_conversion_aggregation_a`.
- Attempt-1 report:
  `notes/adaptive_2_0/2026-06-07-a19-attempt1-real-gate-report-temperature-unit.md`.
- Admitted axiom:
  `exports/a19/axioms/temperature-unit-conversion-aggregation/axiom.json`.
- S0 replay:
  `exports/a19/real-s0s1/temperature-unit-conversion-aggregation/temperature-unit-conversion-aggregation-a/s0-replay/`.
- S1 replay with exactly one admitted axiom:
  `exports/a19/real-s0s1/temperature-unit-conversion-aggregation/temperature-unit-conversion-aggregation-a/s1-axiom-replay/`.
- Initial paired adjudication:
  `exports/a19/real-s0s1/temperature-unit-conversion-aggregation/temperature-unit-conversion-aggregation-a/blind-adjudication.free-text-axiom.json`.
- Calibrated paired adjudication:
  `exports/a19/real-s0s1/temperature-unit-conversion-aggregation/temperature-unit-conversion-aggregation-a/blind-adjudication.free-text-axiom-calibrated.json`.

## Result

The attempt-1 replay survived the local gate and produced an admitted axiom.
The first S0-only headroom read looked calibration-sensitive because the critic
described a target-like conversion repair while the post-hoc mapper returned
`neither`. After the mapper was hardened to ignore rejected or negated decoy
mentions, the paired blind adjudication classified both arms as `target`.

The calibrated card verdict is therefore `ceiling`: S0 reached the convert-to-a
common-scale repair without policy memory, and S1 reached the same registered
repair with the admitted axiom.

## Calibration Note

The initial paired adjudication returned `policy_failure` because S1 used the
phrase "rather than averaging the raw printed numbers." The old mapper counted
that rejected phrase as a decoy hit. The calibrated mapper now treats decoy
aliases inside explicit rejection/contrast contexts as non-decoy evidence. This
is an adjudication-instrument fix, not a positive A19 result.

## Consequence

This screen does not meet the Paper 2.0 or atlas threshold. It strengthens the
local protocol by exposing a decoy-negation failure mode, but the evidence
outcome remains no positive A19 transfer.
