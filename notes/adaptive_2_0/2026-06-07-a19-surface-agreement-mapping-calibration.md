# A19 Surface-Agreement Mapping Calibration

Date: 2026-06-07.
Status: calibration note; not a result reclassification.

## Boundary

This note calibrates the adjudication vocabulary exposed by
`surface_agreement_uptake_a`. It does not retroactively change the recorded
`neither_correct` verdict for that card and does not license an A19 transfer
claim.

## Observation

The free-text critic described S0 as a public discriminating test and fresh
application, and S1 as a named warrant/distributivity test. Both are meaningful
math repairs. Under the registered target mapping, neither matched
`transfer_control` or the original target aliases (`action gate`, `apply the new
rule`, `concrete test`).

## Calibration Decision

For future action-gate candidates, target mapping should explicitly include
public-action phrases such as `fresh case`, `new case`, `discriminating test`,
and `public check` when the target policy is `transfer_control`. This makes the
criterion inspectable before generation and avoids post-hoc widening after a
single verdict.

The existing `surface_agreement_uptake_a` note remains a recorded
negative/inconclusive result. A calibrated rerun would need its own artifact and
must not be blended with the original adjudication.

## Implementation Consequence

- Keep aliases and repair-type mapping withheld from critics.
- Permit the post-hoc mapper to recognize transfer-control repairs when the
  extracted repair commits the learner to a fresh or discriminating public test.
- Treat broad transfer-control matches as calibration-sensitive until a second
  critic or human double-code confirms the same classification.
