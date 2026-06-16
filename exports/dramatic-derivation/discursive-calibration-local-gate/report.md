# Discursive Calibration Local Gate

Generated: 2026-06-16

## Boundary

- Zero-paid local implementation gate.
- No episode replay launched.
- No fresh paid validation launched.
- No H/V selector work revived.
- Proof-control remains `hidden+proofDebt`/entitlement/conduct-policy territory.
- The new discursive calibration layer is advisory only: it can bias tempo and rhetorical move advice, but it cannot authorize release, restore, hold, or final assertion.

## Implementation

- Added `services/dramaticDerivation/discursiveCalibration.js`.
- Exported `deriveDiscursiveCalibrationState(...)`, `auditDiscursiveCalibrationPublicInput(...)`, and `DISCURSIVE_CALIBRATION_SCHEMA`.
- Extended `recommendRhetoricalMove(...)` so an explicitly supplied `discursiveCalibration` object can bias the existing rhetorical distribution.
- The overlay records `mayOverrideProofControl: false` and `proofControlDecision: null`.
- The public-input audit rejects hidden/proof-state keys such as `D`, `hiddenBoard`, `proofPath`, `rawBoard`, `secret`, and corruption/proof-path fields.

## Fixed-Obligation Gate

The test freezes a Hethel-style proof obligation:

- conduct move: `release_next_evidence`
- target premise: `p_point`

Then it varies only public learner/dialogue state:

| perturbation | posture | pressure | selected rhetorical stance |
|---|---|---|---|
| tentative but correct learner | `tentative_correct` | `light_confirming` | `situated_uptake_check` |
| defensive learner after repeated correction | `defensive_after_correction` | `lower_and_repair` | `recognitive_recap` |
| fluent echo without usable uptake | `fluent_echo` | `check_ownership` | `uptake_check` |
| learner asks why the evidence matters | `purpose_question` | `purpose_bridge` | `purpose_bridge` |
| near-final learner before final entitlement | `near_assertion` | `hold_assertion_boundary` | `assertion_boundary_check` |
| socially disengaging learner with recoverable board | `social_disengagement` | `restore_contact` | `repair_contact` |

For every perturbation, `selectConductMove(...)` remains `release_next_evidence` targeting `p_point`.

## Commands

```bash
node --test tests/dramaticDerivationDiscursiveCalibration.test.js

node --test \
  tests/dramaticDerivationDiscursiveCalibration.test.js \
  tests/dramaticDerivationConductPolicy.test.js \
  tests/dramaticDerivationScenes.test.js \
  tests/dramaticDerivationReplay.test.js

npm test
```

## Results

- New focused test: 3/3 passing.
- Focused conduct/scene/replay gate: 53/53 passing.
- Full suite: 3773 passing, 1 skipped, 0 failing.

## Interpretation

This establishes a clean local separation between two layers:

```text
proof-state layer: decides what can safely happen next
discursive layer: advises how to conduct that same authorized step
```

This does not yet show improved proof-control. It gives us a safer S1 candidate for replay: hidden+proofDebt plus explicit public-discourse calibration, with proof decisions held fixed and only rhetorical/tempo advice allowed to vary.

## Next Gate

The next useful step is a no-paid mock episode screen or prefix-controlled replay harness that injects the calibration object at a known proof step and verifies:

- prefix integrity;
- identical proof-control decision/release timing against S0;
- changed rhetorical/tempo advice under public perturbation;
- no leak audit failures;
- no conduct-policy drift into release/restore/hold/final-assert authority.
