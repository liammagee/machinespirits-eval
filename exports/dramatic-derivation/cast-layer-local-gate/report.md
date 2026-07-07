# Cast Layer Local Gate

Date: 2026-06-16  
World: `config/drama-derivation/world-006-hethel.yaml`  
Script: `config/drama-derivation/tutor-scripts/hethel-v001.md`  
Backend: mock only, zero paid calls

## Scope

Implemented a public cast layer and bounded tutor reinvention above hidden/proof-control machinery:

- `CastState`: deterministic, public-only, no proof-control authority.
- Role projections: director, tutor, learner, tutor superego behind `--cast-layer`.
- Pilot authored Hethel `cast` block.
- `TutorReinventionState`: behind `--cast-reinvention`, scene-bounded, one active stance change at a time, trigger cooldown.
- Engine/replay metadata: transcript and result rows record cast state and reinvention summaries.

No H/V selector work was revived. Reinvention changes stance/tone/figure/tempo/example/recognition conduct only.

## Commands

Focused tests:

```bash
node --test tests/dramaticDerivationCastLayer.test.js
node --test tests/dramaticDerivationWorlds.test.js
node --check scripts/run-derivation-loop.js
node --check scripts/run-derivation-episode.js
node --check services/dramaticDerivation/llmRoles.js
node --check services/dramaticDerivation/engine.js
```

Local S0/S1/S2 mock matrix:

```bash
node scripts/run-derivation-loop.js --world config/drama-derivation/world-006-hethel.yaml --script config/drama-derivation/tutor-scripts/hethel-v001.md --label cast-layer-local-s0-no-cast --out exports/dramatic-derivation/cast-layer-local-gate/matrix --superego --acts '{"minActTurns":3,"maxActTurns":8}' --scene-mode on --director-cadence scene --stage-prologue on --rhetorical-policy '{"mode":"deterministic","seed":1,"temperature":1}' --discursive-calibration --didactic-mode --critic off
node scripts/run-derivation-loop.js --world config/drama-derivation/world-006-hethel.yaml --script config/drama-derivation/tutor-scripts/hethel-v001.md --label cast-layer-local-s1-static-cast --out exports/dramatic-derivation/cast-layer-local-gate/matrix --superego --acts '{"minActTurns":3,"maxActTurns":8}' --scene-mode on --director-cadence scene --stage-prologue on --rhetorical-policy '{"mode":"deterministic","seed":1,"temperature":1}' --discursive-calibration --didactic-mode --cast-layer --critic off
node scripts/run-derivation-loop.js --world config/drama-derivation/world-006-hethel.yaml --script config/drama-derivation/tutor-scripts/hethel-v001.md --label cast-layer-local-s2-reinvention --out exports/dramatic-derivation/cast-layer-local-gate/matrix --superego --acts '{"minActTurns":3,"maxActTurns":8}' --scene-mode on --director-cadence scene --stage-prologue on --rhetorical-policy '{"mode":"deterministic","seed":1,"temperature":1}' --discursive-calibration --didactic-mode --cast-layer --cast-reinvention --critic off
```

Episode replay:

```bash
node scripts/run-derivation-episode.js --from exports/dramatic-derivation/cast-layer-local-gate/matrix/cast-layer-local-s0-no-cast --turn 7 --window 6 --label cast-layer-episode-s2-from-s0-t7 --out exports/dramatic-derivation/cast-layer-local-gate/episodes --cast-layer on --cast-reinvention on --critic off
```

Raw local artifacts remain under `exports/dramatic-derivation/cast-layer-local-gate/` but are not part of the committed evidence surface.

## State And Projections

Representative Hethel cast state at the reinvention turn:

- Tutor: `master of works`, public identity `a bridge-mason retained by the assize`, default stance `craft examiner`.
- Learner: `bridge-warden's young clerk`, public identity `keeps the assize-book under civic pressure`, likely failure `turns liability into causation`.
- Relation: `apprenticeship under public pressure`, current trust `working_but_thin`.
- Reinvention: `craft examiner -> co-investigator`, trigger `defensive_after_correction`, scope `scene`, started turn 7.
- Allowed changes: `tone`, `figure`, `tempo`, `example_style`, `recognition_act`.
- Forbidden changes: `release_timing`, `secret`, `proof_target`, `answer_assertion`, `restore_authority`, `hold_authority`.
- Leak audit: input and output audits clean.

Role projections are differentiated:

- Director sees tutor role, learner role, relation/stakes, and authorized stance.
- Tutor sees current stance, learner posture, relation pressure, rationale, allowed/forbidden changes.
- Learner sees only own public role, relation, speech habit, and stakes.
- Tutor superego sees stance/reinvention audit and the explicit proof-control boundary.

## Local Results

| Condition | Cast | Reinvention | Verdict | Turns | Final D | Forced | Asserted | Release deviations | Reinvention turns |
|---|---:|---:|---|---:|---:|---:|---:|---:|---|
| S0 no cast | no | no | `grounded_anagnorisis` | 20 | 0 | 20 | 20 | 0 | none |
| S1 static cast | yes | no | `grounded_anagnorisis` | 20 | 0 | 20 | 20 | 0 | none |
| S2 reinvention | yes | yes | `grounded_anagnorisis` | 20 | 0 | 20 | 20 | 0 | t7 |

Proof-control invariance held in the mock matrix:

- Same verdict in all three conditions.
- Same turn count.
- Same first forced turn and grounded assertion turn.
- Same final D.
- All eight scheduled releases on cue in all three conditions.
- No missed, unscheduled, or deviating releases.

Episode replay from the S0 prefix:

- Source: `exports/dramatic-derivation/cast-layer-local-gate/matrix/cast-layer-local-s0-no-cast`
- Episode: `exports/dramatic-derivation/cast-layer-local-gate/episodes/cast-layer-episode-s2-from-s0-t7`
- First live turn: 7
- Window: 6
- Overrides: `--cast-layer on --cast-reinvention on`
- Prefix integrity: `ok: true`, no mismatches, no expected divergence.
- Window result: `cap_reached` at turn 12, because this was a short local replay window, not a full-run endpoint.
- Releases inside window: `m_bond@t8`, `p_surface@t9`, both on cue.

## Transcript Excerpt

S2 around the reinvention:

```text
T6 tutor: Put the last two things in your own words: what do they show, and what is still missing?
  cast: craft examiner; reinv=none
T7 tutor: First keep the shown part; then mark the part still not shown.
  cast: co-investigator; reinv=defensive_after_correction
T8 tutor: First say the secure thing; then say what it still does not license.
  cast: craft examiner; reinv=none
T9 tutor: Set it beside what you hold, like for like: Break out the crown bed and the mortar tells on itself: still green to the knife, never set ...
  cast: craft examiner; reinv=none
```

The mock tutor prose is deterministic and not a strong reader-quality measure. The useful check is that the stance change is now bounded: it appears at t7 and then clears.

## Interpretation

This increment establishes the cast/reinvention plumbing and safety boundary. It does not establish mechanism-level learning improvement.

What the local gate supports:

- The cast layer can be authored publicly and projected differently by role without leaking proof internals.
- Reinvention can be represented as conduct adaptation rather than proof adaptation.
- The runtime can preserve proof-control dominance while logging cast/reinvention metadata.
- Episode replay can toggle S2 from an S0 prefix with formal prefix integrity intact.

What it does not support:

- No evidence yet that cast or reinvention improves grounding, turn count, impasse risk, uptake, or human-reader quality.
- The mock stack is too deterministic and too terse to judge character quality.
- The didactic overload signal still persists after the same formal proof path succeeds; that is a separate evaluation/frame issue, not evidence that cast improves proof outcomes.

## Paid-Run Decision

Do not launch Phase 7 paid validation yet. The local gate is safety-positive and proof-invariant, but it has not identified a concrete local uptake/turn/impasse improvement over hidden+proofDebt or over the already-working didactic/discursive stack. A paid run would mostly test prose variation, not a mechanism claim.

Recommended next step: either freeze this as implemented infrastructure, or run a blinded transcript-quality comparison separately if the research question is reader preference/character coherence rather than proof-control improvement.
