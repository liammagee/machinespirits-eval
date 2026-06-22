# Learner Object Three-Path Evaluation Report

## Boundary

This mini-arc treated learner-object ownership as evaluation-layer instrumentation. It did not change proof control, release policy, assertion gates, learner behavior, or default runtime policy. `--ownership-transfer-gate` remains experimental and off by default.

## Path 1: Dual Outcome Reporting

Implemented `scripts/analyze-derivation-learner-object-outcomes.js` to report proof verdict plus learner-object ownership outcome for completed `result.json` artifacts. The analyzer accepts run labels, run directories, and direct `result.json` paths, then writes `summary.json` and `report.md` under `exports/dramatic-derivation/learner-object-outcomes/`.

Current analyzed set:

| Outcome | Count |
| --- | ---: |
| `proof_and_ownership_grounded` | 2 |
| `proof_grounded_ownership_partial` | 1 |
| `proof_failed` | 0 |
| `not_instrumented` | 1 |
| total | 4 |

Interpretation: both fresh paid Hethel detector runs grounded the proof and reached durable transformed ownership. The only partial ownership case was a mock replay missing `near_transfer`. The prefix-only replay was correctly classified as `not_instrumented`.

## Path 2: Blinded Transcript-Quality Evaluation

Built and scored the pre-declared pairwise packet:

```bash
node scripts/build-derivation-transcript-pairwise-eval.js \
  --loop-dir exports/dramatic-derivation/ownership-transfer-detector-audit/fresh-runs \
  --out-dir exports/dramatic-derivation/ownership-transcript-quality-eval \
  --pair heth15-transfergate-fresh=world015-transferdetector-fresh-s2-ownership-r1,world015-transferdetector-fresh-s2-transfer-r1 \
  --force

node scripts/score-derivation-transcript-pairwise-eval.js \
  --packet-dir exports/dramatic-derivation/ownership-transcript-quality-eval \
  --judge-cli claude \
  --judge-model opus \
  --judge-effort max \
  --force
```

Unblinded result:

| Pair | Preferred | Strength | Losing arm | Mean scores | Formalism leak |
| --- | --- | --- | --- | --- | --- |
| `heth15-transfergate-fresh` | `world015-transferdetector-fresh-s2-ownership-r1` | slight | `world015-transferdetector-fresh-s2-transfer-r1` | 4.00 vs 3.67 | none observed |

The judge rated both transcripts competent and non-formalist. The preference was modest and based on smoother dialogue texture, more varied framing, and less mechanical repetition. Because proof and durable ownership were already matched, this is transcript-quality evidence only, not proof-control mechanism evidence.

## Path 3: Targeted Replay Gate

Added a read-only trigger audit:

```bash
node scripts/audit-derivation-ownership-replay-candidates.js \
  --root exports/dramatic-derivation \
  --out exports/dramatic-derivation/ownership-replay-candidate-audit
```

The audit scanned 589 completed artifacts with diagnoses. It found:

| Category | Count |
| --- | ---: |
| first-pass ownership-instrumented artifacts | 5 |
| Path 3 trigger candidates | 2 |
| actionable gate-off candidates | 1 |
| already-gated failures | 1 |

The one actionable source is `world015-transfergate-s2-ownership-r1`: first-pass, non-mock, complete `result.json` plus `diagnosis.json`, grounded proof, final assertion available, incomplete ownership, exactly one missing family (`near_transfer`), and `--ownership-transfer-gate` off.

However, this source already has a recorded gate replay: `world015-transfergate-detector-mock-from-t20`. That replay preserved prefix integrity and grounded the proof, but still ended with partial ownership missing `near_transfer`. Therefore a duplicate replay was not launched.

The already-gated failure is `world015-transfergate-s2-transfer-r1`, which also ended with `near_transfer` missing despite the gate. That is negative evidence for the gate, not an actionable test of adding it.

## Commands And Tests

Path 1 report command:

```bash
node scripts/analyze-derivation-learner-object-outcomes.js \
  --run world015-transferdetector-fresh-s2-ownership-r1 \
  --run world015-transferdetector-fresh-s2-transfer-r1 \
  --run world015-transfergate-detector-mock-from-t20 \
  --run world015-transfergate-detector-replay-from-t23 \
  --out exports/dramatic-derivation/learner-object-outcomes
```

Verification commands:

```bash
node --test tests/analyzeDerivationLearnerObjectOutcomes.test.js
node --test tests/derivationTranscriptPairwiseScoring.test.js
node --test tests/derivationTranscriptPairwiseEval.test.js
node --test tests/dramaticDerivationLearnerTransformation.test.js
node --test tests/dramaticDerivationObjectOwnership.test.js
npm test
```

## Interpretation

The useful move is dual reporting: proof success and learner-object ownership should now be tracked separately. The latest evidence does not justify promoting the ownership transfer gate. It also does not show a new proof-control advantage, because the fresh pair already matched on proof and durable ownership. The only positive Path 2 signal is narrower: among two successful Hethel transcripts, the ownership run was slightly preferred for public didactic-play quality.

The next empirical trigger should be a real first-pass late-ownership failure, not another broad matrix. If such a failure appears, use the targeted replay gate exactly once from the preserved prefix before considering any fresh paid paired run.
