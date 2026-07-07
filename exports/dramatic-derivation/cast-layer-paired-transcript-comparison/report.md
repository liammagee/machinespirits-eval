# Cast Layer Paired Transcript Comparison

Date: 2026-06-17  
World: `config/drama-derivation/world-006-hethel.yaml`  
Script: `config/drama-derivation/tutor-scripts/hethel-v001.md`  
Backend: real role bridge, first-pass, no rerolls  
Judge: blinded pairwise transcript judge via `codex/default`

## Scope

This run tests the reader-quality question left open by the mock cast-layer gate:

- **S0:** no cast layer;
- **S1:** static public cast layer;
- **S2:** static cast layer plus bounded tutor reinvention.

Proof-control substrate and discourse stack were held fixed across arms:

- `--superego`
- `--acts '{"minActTurns":3,"maxActTurns":8}'`
- `--scene-mode on`
- `--director-cadence scene`
- `--stage-prologue on`
- `--register modern`
- `--rhetorical-policy '{"mode":"deterministic","seed":1,"temperature":1}'`
- `--discursive-calibration`
- `--didactic-mode`
- `--critic off`

Environment:

```bash
DERIVATION_PROVIDER=codex
DERIVATION_LEARNER_PROVIDER=claude
DERIVATION_LEARNER_MODEL=sonnet
DERIVATION_CLI_TIMEOUT_MS=900000
DERIVATION_LLM=real
DERIVATION_TRACE=0
```

## Run Outcomes

| Arm | Label | Verdict | Turns | Final D | Forced turn | Grounded assertion | Release deviations | Cast/reinvention |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| S0 | `cast-layer-pairwise-hethel-real-s0-no-cast-r1` | `grounded_anagnorisis` | 22 | 0 | 20 | 22 | 0 | none |
| S1 | `cast-layer-pairwise-hethel-real-s1-static-cast-r1` | `grounded_anagnorisis` | 20 | 0 | 20 | 20 | 0 | static cast |
| S2 | `cast-layer-pairwise-hethel-real-s2-reinvention-r1` | `grounded_anagnorisis` | 21 | 0 | 20 | 21 | 0 | co-investigator t2-t4; patient demonstrator t18-t20 |

All three runs preserved release adherence: eight scheduled releases, all on cue, with no deviations, missed releases, or unscheduled releases.

## Blinded Pairwise Results

Pair packet: `exports/dramatic-derivation/cast-layer-paired-transcript-comparison/pairwise`  
Scores: `exports/dramatic-derivation/cast-layer-paired-transcript-comparison/pairwise/scores.json`  
Pairwise report: `exports/dramatic-derivation/cast-layer-paired-transcript-comparison/pairwise/report.md`

| Pair | Preferred | Strength | Mean scores | Formalism leak noted |
| --- | --- | --- | --- | --- |
| S0 vs S1 | S1 static cast | slight | S1 4.00 vs S0 3.83 | S0 yes, S1 no |
| S0 vs S2 | S0 no cast | slight | S0 4.50 vs S2 4.17 | S0 yes, S2 no |
| S1 vs S2 | S1 static cast | moderate | S1 4.67 vs S2 3.83 | no |

Aggregate:

| Arm | Appearances | Wins | Losses | Mean pair score |
| --- | ---: | ---: | ---: | ---: |
| S1 static cast | 2 | 2 | 0 | 4.33 |
| S0 no cast | 2 | 1 | 1 | 4.17 |
| S2 cast + reinvention | 2 | 0 | 2 | 4.00 |

## Transcript Evidence

S1’s strongest local evidence is that it made the distinction-work readable without delaying the proof. The judge cited learner self-correction and compact orientation:

- `Does that match what you're pointing at?`
- `Yes: a yard isn't a hand.`
- `I was jumping past the first step to get to the yard.`
- Final closure at the same turn as the forced final release, t20.

S0 remained strong as a didactic proof but leaked public formalism:

- `That much Rule 7 gives us cleanly.`
- It still moved coherently through `place first, cause next, blame last`, but needed two extra post-D=0 turns before assertion.

S2 improved explicit acknowledgement but became more repetitive:

- Early reinvention: `I hear the pressure: Reyner's name is on the work, and that matters.`
- The learner’s useful distinction appeared early: `liable isn't the same as the hand that brought it down.`
- But the middle and final scenes repeated already-settled Reyner/Caudle lines and asserted at t21, one turn later than S1.

## Interpretation

This is the first positive evidence that **static cast may be useful** beyond plumbing:

- It preserved proof reliability.
- It shortened the run relative to no-cast in this first-pass Hethel sample.
- It won both blinded pairwise transcript comparisons in which it appeared.
- It avoided the public `Rule 7` leak that appeared in S0.

The same cannot be said for reinvention:

- S2 preserved proof reliability and remained bounded.
- But it lost both pairwise transcript comparisons.
- It did not beat S1 on turn count or assertion timing.
- Its explicit recognition/stance changes looked reader-friendly in places but also increased repetition and padding.

So the current evidence supports a narrow next policy:

> Keep the public static cast layer as a candidate default for transcript quality and proof-neutral character continuity. Do not promote bounded reinvention by default yet; keep it behind a flag and tighten its trigger/exit policy before any broader validation.

## Caveats

- This is one world, one first-pass sample per arm.
- The judge is an LLM judge, not a human-reader panel.
- The comparison is transcript-quality evidence, not a proof-control mechanism claim.
- S1’s apparent turn-count gain is encouraging but not yet stable evidence.
- S0’s formalism leak may be partly stochastic; it should be treated as a first-pass observed artifact, not a guaranteed no-cast defect.

## Commands

S0:

```bash
DERIVATION_PROVIDER=codex DERIVATION_LEARNER_PROVIDER=claude DERIVATION_LEARNER_MODEL=sonnet DERIVATION_CLI_TIMEOUT_MS=900000 DERIVATION_LLM=real DERIVATION_TRACE=0 node scripts/run-derivation-loop.js --world config/drama-derivation/world-006-hethel.yaml --script config/drama-derivation/tutor-scripts/hethel-v001.md --label cast-layer-pairwise-hethel-real-s0-no-cast-r1 --out exports/dramatic-derivation/cast-layer-paired-transcript-comparison/runs --real --superego --acts '{"minActTurns":3,"maxActTurns":8}' --scene-mode on --director-cadence scene --stage-prologue on --register modern --rhetorical-policy '{"mode":"deterministic","seed":1,"temperature":1}' --discursive-calibration --didactic-mode --critic off
```

S1:

```bash
DERIVATION_PROVIDER=codex DERIVATION_LEARNER_PROVIDER=claude DERIVATION_LEARNER_MODEL=sonnet DERIVATION_CLI_TIMEOUT_MS=900000 DERIVATION_LLM=real DERIVATION_TRACE=0 node scripts/run-derivation-loop.js --world config/drama-derivation/world-006-hethel.yaml --script config/drama-derivation/tutor-scripts/hethel-v001.md --label cast-layer-pairwise-hethel-real-s1-static-cast-r1 --out exports/dramatic-derivation/cast-layer-paired-transcript-comparison/runs --real --superego --acts '{"minActTurns":3,"maxActTurns":8}' --scene-mode on --director-cadence scene --stage-prologue on --register modern --rhetorical-policy '{"mode":"deterministic","seed":1,"temperature":1}' --discursive-calibration --didactic-mode --cast-layer --critic off
```

S2:

```bash
DERIVATION_PROVIDER=codex DERIVATION_LEARNER_PROVIDER=claude DERIVATION_LEARNER_MODEL=sonnet DERIVATION_CLI_TIMEOUT_MS=900000 DERIVATION_LLM=real DERIVATION_TRACE=0 node scripts/run-derivation-loop.js --world config/drama-derivation/world-006-hethel.yaml --script config/drama-derivation/tutor-scripts/hethel-v001.md --label cast-layer-pairwise-hethel-real-s2-reinvention-r1 --out exports/dramatic-derivation/cast-layer-paired-transcript-comparison/runs --real --superego --acts '{"minActTurns":3,"maxActTurns":8}' --scene-mode on --director-cadence scene --stage-prologue on --register modern --rhetorical-policy '{"mode":"deterministic","seed":1,"temperature":1}' --discursive-calibration --didactic-mode --cast-layer --cast-reinvention --critic off
```

Packet and adjudication:

```bash
node scripts/build-derivation-transcript-pairwise-eval.js --loop-dir exports/dramatic-derivation/cast-layer-paired-transcript-comparison/runs --out-dir exports/dramatic-derivation/cast-layer-paired-transcript-comparison/pairwise --pair s0_vs_s1=cast-layer-pairwise-hethel-real-s0-no-cast-r1,cast-layer-pairwise-hethel-real-s1-static-cast-r1 --pair s0_vs_s2=cast-layer-pairwise-hethel-real-s0-no-cast-r1,cast-layer-pairwise-hethel-real-s2-reinvention-r1 --pair s1_vs_s2=cast-layer-pairwise-hethel-real-s1-static-cast-r1,cast-layer-pairwise-hethel-real-s2-reinvention-r1 --force
node scripts/score-derivation-transcript-pairwise-eval.js --packet-dir exports/dramatic-derivation/cast-layer-paired-transcript-comparison/pairwise --out exports/dramatic-derivation/cast-layer-paired-transcript-comparison/pairwise/scores.json --report exports/dramatic-derivation/cast-layer-paired-transcript-comparison/pairwise/report.md --judge-cli codex --force
node --test tests/derivationTranscriptPairwiseScoring.test.js
```
