# Recognition-Pressure Ablation Report

Date: 2026-06-15  
World: `world_009_ravensmark`  
Source active run: `ravensmark-recognition-cognitive-real-r1`  
Off full run: `ravensmark-recognition-cognitive-off-real-r1`  
Off replay: `ravensmark-recognition-cognitive-off-from-t13-r1`

## Question

Does the new `recognitionNeed` pressure improve derivation outcomes, or should it remain a diagnostic signal while the scene tempo/rhetorical stack does the main work?

The ablation changes only scene-mode recognition pressure:

```json
"recognitionNeed": false
```

Scene tempo, director cadence, sampled register, prologue, tutor superego, act bounds, learner voice, world, script, and stochastic rhetorical-policy seed were held fixed against the active baseline.

## Result Table

| run | condition | verdict | turns | forced | asserted | gap | final D |
|---|---:|---:|---:|---:|---:|---:|---:|
| `ravensmark-recognition-cognitive-real-r1` | active full | grounded_anagnorisis | 16 | 15 | 16 | 1 | 0 |
| `ravensmark-recognition-cognitive-off-real-r1` | off full | grounded_anagnorisis | 16 | 15 | 16 | 1 | 0 |
| `ravensmark-recognition-cognitive-off-from-t13-r1` | off replay from t13 | grounded_anagnorisis | 15 | 15 | 15 | 0 | 0 |

The prefix-controlled replay preserved turns 1-12 exactly:

```json
{"ok":true,"mismatches":[],"expectedDivergence":false}
```

## Dialogue Metrics

| run | exchange mix | tempo mix | cognitive tempo | recognition need | phatic recognition | learner words |
|---|---|---|---|---|---|---:|
| active full | confusion 4; resistance 9; substantive 1; hypothesis 1; assertion 1 | hesitation 2; evidence 5; uptake 2; recap 5; repair 1; recognition 1 | deliberative 16 | peak 0.63; medium 8, high 3 | 10 | 1007 total / 62.9 avg |
| off full | confusion 1; resistance 1; substantive 2; hypothesis 11; assertion 1 | hesitation 3; evidence 5; uptake 2; recap 5; recognition 1 | deliberative 16 | off by design | 13 | 1033 total / 64.6 avg |
| off replay | confusion 3; resistance 8; substantive 1; hypothesis 2; assertion 1 | hesitation 2; evidence 5; uptake 2; recap 5; repair 1 | deliberative 15 | off in live suffix | 11 | 948 total / 63.2 avg |

The active run did not produce fast-reflex or situated-uptake phatic turns; every learner turn classified as deliberative. Recognition pressure was therefore responding mostly to sustained confusion/resistance, not to short phatic punctuation.

## Interpretation

This bounded probe does not support making `recognitionNeed` a default outcome-improving policy yet.

The strongest datum is the prefix-controlled replay. With the active prefix held formally identical through turn 12, the off suffix asserted on turn 15, while the active source waited until turn 16. This is not decisive because the live suffix still redraws LLM text, but it shows that recognition pressure is not obviously necessary for this resistance-heavy Ravensmark case and may sometimes add an extra staging turn.

The independent off full run also succeeded with the same forced/asserted gap as active. It shifted the learner profile from resistance-heavy to hypothesis-heavy, but did not improve total turns or forced/asserted gap. There was no evidence that disabling recognition pressure caused formal leakage, release deviation, or disengagement.

The tutor did not obviously over-recap when recognition pressure was active: both full runs used recap tempo 5 times. However, active recognition pressure did keep generating medium/high debt from resistance and confusion. That may be useful diagnostically, but it did not clearly buy performance in this sample.

## Recommendation

Keep the recognition machinery, but split its status:

- `classifyCognitiveTempo`, strict `phaticRecognition`, and `recognitionNeed` diagnostics should stay on.
- Using `recognitionNeed` to bias tempo/figure selection should remain experimental, controlled by `sceneMode.recognitionNeed`.
- Do not claim an outcome benefit until it beats or matches the off condition over several first-pass worlds or replays.

Next useful probe: one small paired matrix over 3-4 worlds/runs, active vs off, with no taxonomy expansion. Primary endpoints should be success, forced/asserted gap, turn count, and whether recognition pressure reduces resistance/confusion without increasing recap drag.

## Commands And Artifacts

Active baseline artifact:

```bash
exports/dramatic-derivation/loop/ravensmark-recognition-cognitive-real-r1/transcript.md
```

Independent off run:

```bash
DERIVATION_PROVIDER=codex DERIVATION_LEARNER_PROVIDER=claude DERIVATION_LEARNER_MODEL=sonnet DERIVATION_CLI_TIMEOUT_MS=900000 DERIVATION_LLM=real DERIVATION_TRACE=0 \
node scripts/run-derivation-loop.js --real \
  --world config/drama-derivation/world-009-ravensmark.yaml \
  --script config/drama-derivation/tutor-scripts/ravensmark-v001.md \
  --label ravensmark-recognition-cognitive-off-real-r1 \
  --group scene-recognition-cognitive-ablation \
  --critic off --superego \
  --acts '{"minActTurns":3,"maxActTurns":8}' \
  --scene-mode '{"maxExchanges":6,"maxPhaticExchanges":4,"closeOnDDecrease":false,"closeOnConfusion":false,"recognitionNeed":false,"tempo":{"mode":"sample","seed":17,"temperature":0.8,"weights":{"uptake_only":0.35,"repair_request":0.12,"recap":0.28,"hesitation":0.18,"hypothesis":0.07,"evidence":0.2,"recognition":0.2}}}' \
  --director-cadence scene --register sample \
  --rhetorical-policy-stochastic \
  --rhetorical-policy '{"seed":61,"temperature":1.1}'
```

Prefix-controlled off replay:

```bash
DERIVATION_PROVIDER=codex DERIVATION_LEARNER_PROVIDER=claude DERIVATION_LEARNER_MODEL=sonnet DERIVATION_CLI_TIMEOUT_MS=900000 DERIVATION_LLM=real DERIVATION_TRACE=0 \
node scripts/run-derivation-episode.js \
  --from ravensmark-recognition-cognitive-real-r1 \
  --turn 13 --window 4 --real --critic off \
  --scene-mode '{"maxExchanges":6,"maxPhaticExchanges":4,"closeOnDDecrease":false,"closeOnConfusion":false,"recognitionNeed":false,"tempo":{"mode":"sample","seed":17,"temperature":0.8,"weights":{"uptake_only":0.35,"repair_request":0.12,"recap":0.28,"hesitation":0.18,"hypothesis":0.07,"evidence":0.2,"recognition":0.2}}}' \
  --label ravensmark-recognition-cognitive-off-from-t13-r1 \
  --out exports/dramatic-derivation/episodes
```

Verification:

```bash
node --check services/dramaticDerivation/rhetoricalMovePolicy.js services/dramaticDerivation/engine.js scripts/run-derivation-loop.js scripts/run-derivation-episode.js tests/dramaticDerivationScenes.test.js
node --test tests/dramaticDerivationScenes.test.js tests/dramaticDerivationReplay.test.js
```
