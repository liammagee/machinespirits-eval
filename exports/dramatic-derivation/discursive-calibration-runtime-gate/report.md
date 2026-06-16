# Discursive Calibration Runtime Gate

Date: 2026-06-16

## Scope

This is a zero-cost mock episode screen for the new runtime `--discursive-calibration` flag. It is prefix-controlled debugging evidence, not paid validation and not held-out proof of mechanism effect.

Source prefix:

- `exports/dramatic-derivation/loop/hethel-phase5g-a20-fresh-selective-v4-r1`
- First live turn: `4`
- Window: `6` live turns, stopping after turn `9`
- Source world: `world_006_hethel`
- Source outcome: disengagement in the original first-pass run

Both screen arms force the same proof-control setup after the prefix:

- Hidden pacing: `--pacing-guard on`
- Selector v4 disabled: `--pacing-guard-selective-v4 off`
- Proof debt inherited/on
- Conduct policy and enforcement disabled
- Rhetorical policy enabled so advisory moves are observable
- Mock backend, no paid calls

## Commands

```bash
node scripts/run-derivation-episode.js \
  --from exports/dramatic-derivation/loop/hethel-phase5g-a20-fresh-selective-v4-r1 \
  --turn 4 \
  --window 6 \
  --pacing-guard-selective-v4 off \
  --pacing-guard on \
  --conduct-policy off \
  --conduct-policy-enforce off \
  --rhetorical-policy on \
  --label discursive-runtime-v2-s0-hethel-t4-rhetoric \
  --out exports/dramatic-derivation/episodes \
  --critic off

node scripts/run-derivation-episode.js \
  --from exports/dramatic-derivation/loop/hethel-phase5g-a20-fresh-selective-v4-r1 \
  --turn 4 \
  --window 6 \
  --pacing-guard-selective-v4 off \
  --pacing-guard on \
  --conduct-policy off \
  --conduct-policy-enforce off \
  --rhetorical-policy on \
  --discursive-calibration on \
  --label discursive-runtime-v2-s1-hethel-t4-calibration \
  --out exports/dramatic-derivation/episodes \
  --critic off
```

## Result Table

| Arm | Prefix integrity | Verdict | Turns | D path t3-t9 | Releases t4-t9 | Proof-debt actions | Leak audit |
| --- | --- | --- | ---: | --- | --- | --- | --- |
| S0 rhetorical baseline | ok | cap_reached | 9 | 5,4,4,4,4,4,3 | p_point@4, m_yard@6, m_bond@8, p_surface@9 | restore p_point@6, restore p_point@8 | n/a |
| S1 + discursive calibration | ok | cap_reached | 9 | 5,4,4,4,4,4,3 | p_point@4, m_yard@6, m_bond@8, p_surface@9 | restore p_point@6, restore p_point@8 | ok on all calibrated tutor turns |

S0 artifact:

- `exports/dramatic-derivation/episodes/discursive-runtime-v2-s0-hethel-t4-rhetoric/`

S1 artifact:

- `exports/dramatic-derivation/episodes/discursive-runtime-v2-s1-hethel-t4-calibration/`

## Advisory Difference

The formal proof-control trace is identical across S0 and S1. The discursive layer changes the advisory surface:

| Turn | S0 selected advice | S1 selected advice |
| ---: | --- | --- |
| 4 | `exemplum / release / concrete_exhibit / p_point` | `anaphora / release / recognitive_recap / p_point` |
| 5 | `erotema / test / ask / p_point` | `anaphora / consolidate / recognitive_recap` |
| 6 | `anaphora / restore / proof_debt_repair / p_point` | `anaphora / restore / recognitive_recap / p_point` |
| 7 | `exemplum / release / concrete_exhibit` | `anaphora / consolidate / recognitive_recap` |
| 8 | `anaphora / restore / proof_debt_repair / p_point` | `anaphora / restore / recognitive_recap / p_point` |
| 9 | `exemplum / release / concrete_exhibit / p_surface` | `anaphora / release / recognitive_recap / p_surface` |

S1 classified the public posture as `defensive_after_correction` throughout the live window and advised:

- pressure: `lower_and_repair`
- tempo: `hesitation`, `repair_request`, `recap`
- tutor acts: acknowledge prior line; separate correction from dismissal

## Gate Assessment

- Prefix integrity: pass.
- Same proof-control/release timing: pass.
- Same D trajectory: pass.
- Same proof-debt repair timing: pass.
- No raw proof/board/decay leaks in calibration input or output audit: pass.
- Changed rhetorical/tempo advice: pass.
- No drift into proof-control authority: pass after tightening the policy so calibration preserves proof-step intent and target on release/repair/final-assertion proof steps.

## Implementation Note

The first screen exposed a boundary problem: calibration could select a `consolidate` intent on a turn whose proof step was `release_next_evidence` or `repair_dependency`. The formal ledger still stayed fixed, but that was too close to proof-control authority. The runtime policy now preserves:

- `release_next_evidence` -> `release`
- `repair_dependency` -> `restore`
- `invite_final_assertion` -> `stage_recognition`
- `consolidate_subproof` -> `consolidate`

Calibration can still change figure, stance, pressure, tempo, and recognitive posture.

## Tests

```bash
node --test tests/dramaticDerivationDiscursiveCalibration.test.js tests/dramaticDerivationScenes.test.js tests/dramaticDerivationReplay.test.js
npm test
```

Both passed after the intent-preservation fix.

## Interpretation

The runtime flag is now a plausible local gate for the two-layer framing: hidden+proofDebt controls the proof continuity; discursive calibration changes how the same step is conducted under public learner strain. This screen shows a discourse-quality/advisory change only. It does not yet show proof-control improvement, faster grounding, or reduced impasse.

Next evidence should use one or two paid fresh first-pass runs only after a stronger local fixture shows S1 can improve uptake/engagement or turn count without changing hidden+proofDebt obligations.
