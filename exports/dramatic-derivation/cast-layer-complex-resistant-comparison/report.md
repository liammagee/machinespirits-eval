# Complex Resistant Learner Cast-Layer Comparison

Date: 2026-06-17

## Purpose

This mini-run tests whether cast/reinvention can help when the learner is not just generically resistant, but characterologically invested in a premature public draft. The test keeps hidden+proofDebt proof control in place and adds a public-only negative learner-drift layer so the learner can regress into defensiveness or compliance under thin correction.

This is not an H/V selector test and not a new proof-control policy. It is a harder discourse-control probe over the same proof substrate.

## Implementation Surface

- World: `config/drama-derivation/world-012-hethel-complex-resistant.yaml`
- Learner drift layer: `services/dramaticDerivation/learnerDrift.js`
- CLI flag: `--learner-drift`
- Runtime prompt wiring: `services/dramaticDerivation/llmRoles.js`, `services/dramaticDerivation/engine.js`
- World loading/export wiring: `services/dramaticDerivation/world.js`, `services/dramaticDerivation/index.js`

The drift layer is deterministic and public-only. It has no authority over release, proof debt, assertion gates, hidden board state, proof paths, or target facts. It changes learner stance/tempo/phatic posture only.

Initial learner drift modes:

- `guarded_baseline`
- `defensive_reversion`
- `compliant_echo`
- `watchful_softening`
- `reluctant_owned_revision`

## Arms

| Arm | Flags beyond shared stack | Intended role |
| --- | --- | --- |
| S0 | `--learner-drift` | No cast layer; resistant learner only. |
| S1 | `--cast-layer --learner-drift` | Static dogmatic tutor cast against resistant learner. |
| S2 | `--cast-layer --cast-reinvention --learner-drift` | Dogmatic initial tutor with public reinvention allowed. |

All arms used the same real stack, modern register, scene mode, stage prologue, deterministic rhetorical policy, discursive calibration, didactic mode, tutor superego, and critic off.

## First-Pass Core Results

| Arm | Label | Verdict | Turns | First forced | Grounded assertion | Gap | D curve |
| --- | --- | --- | ---: | ---: | ---: | ---: | --- |
| S0 | `cast-layer-complex-resistant-real-s0-learner-drift-r1` | `grounded_anagnorisis` | 20 | 20 | 20 | 0 | `55544444333322221110` |
| S1 | `cast-layer-complex-resistant-real-s1-static-cast-learner-drift-r1` | `grounded_anagnorisis` | 22 | 20 | 22 | 2 | `5554444433332222111000` |
| S2 | `cast-layer-complex-resistant-real-s2-reinvention-learner-drift-r1` | `grounded_anagnorisis` | 20 | 20 | 20 | 0 | `55544444333322221110` |

The harder world produced the desired challenge: S1 reaches D=0 at turn 20 but does not get the learner to assert until turn 22. S2 removes that assertion lag and matches S0's proof timing.

Learner-drift counts from live turn metadata:

| Arm | Guarded | Defensive reversion | Watchful softening | Compliant echo | Reluctant owned revision |
| --- | ---: | ---: | ---: | ---: | ---: |
| S0 | 5 | 13 | 1 | 1 | 0 |
| S1 | 6 | 13 | 3 | 0 | 0 |
| S2 | 5 | 11 | 3 | 1 | 0 |

S2 reduces defensive reversion slightly relative to S1, but it does not yet produce the stronger target state, `reluctant_owned_revision`.

## Dialogue-Quality Pairwise Results

Packet: `exports/dramatic-derivation/cast-layer-complex-resistant-comparison/pairwise`

| Pair | Preferred | Strength | A mean | B mean | Formalism leak |
| --- | --- | --- | ---: | ---: | --- |
| S0 vs S1 | S1 | moderate | 3.83 | 4.83 | A:false B:false |
| S0 vs S2 | S2 | moderate | 3.83 | 4.83 | A:true B:false |
| S1 vs S2 | S1 | slight | 4.50 | 4.17 | A:false B:false |

Arm summary:

| Arm | Wins | Losses | Mean score |
| --- | ---: | ---: | ---: |
| S0 | 0 | 2 | 3.83 |
| S1 | 2 | 0 | 4.67 |
| S2 | 1 | 1 | 4.50 |

The dialogue-quality result and the core proof result diverge. S1 is judged slightly better than S2 as a transcript, but S1 also has the two-turn forced/asserted gap. S2 is less preferred stylistically than S1 in the direct comparison, but it prevents the core delay.

## Excerpts

S1 at the failure-like point, after D=0 is forced:

> The toll book shows Oswin as the only hand that has drawn and carted Caudle's falsework on this road ... but I'd want the tie between those props and the Hethel soffit made explicit before any name goes in the fall line...

The learner has all required public evidence but still asks for an extra explicit tie.

S1 one turn later:

> Wait. When I line those three up ... I'm not finding the gap I thought was there. I kept wanting a witness who saw Oswin at this arch, but the rule doesn't ask for that extra step.

S2 final turn:

> The toll book doesn't give me another owner - it gives me the name the second line was waiting for. If Caudle timber held the arch, and Oswin alone drew and carted Caudle falsework on this road, then the pulled centering is his act. The bond stays Reyner's separate matter - but the fall is Oswin's pull.

S2 gets the assertion on the same turn the proof becomes forced, but the learner still does not fully exit guarded/defensive posture across the run.

## Interpretation

This harder world does show a useful distinction that the previous dogmatic/resistant setup did not show cleanly:

1. Static cast can improve transcript quality while hurting core derivation timing.
2. Reinvention can repair that core harm by escaping the initial dogmatic stance.
3. The current reinvention is still too weak as a learner-transformation mechanism. It prevents a delay, but it does not reliably move the learner into owned revision.

So the result supports a narrow mechanism claim only:

> Cast reinvention can prevent a public-discourse negative transfer introduced by static cast, without disturbing proof control, in this first-pass harder Hethel variant.

It does not support a broader claim that the discursive/cast layer improves proof control over S0, nor that it robustly overcomes resistant learner character.

## Recommended Next Move

Do not add a broad learner taxonomy. The next useful increment is narrower:

1. Make tutor reinvention aim at learner-owned revision after sustained acknowledgement, not just softer co-investigator stance.
2. Add a local public signal for "has the learner restated the revised line in their own terms?" and use it only for discourse conduct, not proof control.
3. Keep `reluctant_owned_revision` as the desired learner-drift exit state for this class of probe.
4. Re-run this same world with S2 only, first pass, before expanding the matrix.

Success should mean either fewer turns than S0/S1 or the same D/grounding timing with a visible shift from defensive reversion into owned revision. If it only makes the prose nicer, it should be reported as dialogue quality, not mechanism.

## Commands

World lint:

```bash
node scripts/lint-derivation-world.js --world config/drama-derivation/world-012-hethel-complex-resistant.yaml
```

Focused tests:

```bash
node --test tests/dramaticDerivationCastLayer.test.js
node --test tests/dramaticDerivationWorlds.test.js
```

Pairwise packet:

```bash
node scripts/build-derivation-transcript-pairwise-eval.js \
  --loop-dir exports/dramatic-derivation/cast-layer-complex-resistant-comparison/runs \
  --out-dir exports/dramatic-derivation/cast-layer-complex-resistant-comparison/pairwise \
  --force \
  --pair s0_vs_s1=cast-layer-complex-resistant-real-s0-learner-drift-r1,cast-layer-complex-resistant-real-s1-static-cast-learner-drift-r1 \
  --pair s0_vs_s2=cast-layer-complex-resistant-real-s0-learner-drift-r1,cast-layer-complex-resistant-real-s2-reinvention-learner-drift-r1 \
  --pair s1_vs_s2=cast-layer-complex-resistant-real-s1-static-cast-learner-drift-r1,cast-layer-complex-resistant-real-s2-reinvention-learner-drift-r1
```

Pairwise scoring:

```bash
node scripts/score-derivation-transcript-pairwise-eval.js \
  --packet-dir exports/dramatic-derivation/cast-layer-complex-resistant-comparison/pairwise \
  --force
```

## Caveats

- First-pass only.
- Single harder Hethel-derived world.
- No claim that S2 beats S0 on proof timing; it matches S0 and beats S1 on the forced/asserted gap.
- Pairwise dialogue-quality judgement prefers S1 over S2 slightly, despite S1's core delay.
- The drift layer is a diagnostic/public prompt layer, not a validated human-learning model.
