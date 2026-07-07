# Adaptive Tutor Three-Path Evaluation Plan

## Summary

Use the recent learner-object work as an evaluation layer, not a new proof-control policy. Keep `hidden+proofDebt` as the proof substrate, keep `--ownership-transfer-gate` off by default, and pursue three bounded paths: dual outcome reporting, blinded transcript-quality scoring, and targeted replay only when a concrete late ownership failure appears.

## Implementation Status

Status as of the first implementation pass:

- Path 1 is implemented in `scripts/analyze-derivation-learner-object-outcomes.js`, with focused tests in `tests/analyzeDerivationLearnerObjectOutcomes.test.js`.
- Path 1 report artifacts were generated at `exports/dramatic-derivation/learner-object-outcomes/summary.json` and `exports/dramatic-derivation/learner-object-outcomes/report.md`.
- Path 2 was run for the pre-declared Hethel pair under `exports/dramatic-derivation/ownership-transcript-quality-eval/`, scored with `claude/opus/max`.
- Path 2 result: the judge slightly preferred `world015-transferdetector-fresh-s2-ownership-r1` over `world015-transferdetector-fresh-s2-transfer-r1` on transcript quality. Both runs already matched on proof success and durable ownership, so this is transcript-quality evidence only.
- Path 3 now has a read-only trigger audit in `scripts/audit-derivation-ownership-replay-candidates.js`.
- The broader Path 3 audit found one actionable historical gate-off source, `world015-transfergate-s2-ownership-r1`, but also found an existing ownership-transfer-gate replay from that source: `world015-transfergate-detector-mock-from-t20`. That replay preserved prefix integrity, grounded the proof, and still ended with partial ownership missing `near_transfer`.
- The same audit found one already-gated first-pass failure, `world015-transfergate-s2-transfer-r1`, which is negative evidence for the gate rather than an actionable test of adding it.
- No duplicate replay was launched from this audit. The existing replay already covers the available actionable source and did not clear the local gate.
- `--ownership-transfer-gate` remains experimental and off by default.

## Path 1: Dual Outcome Reporting

Implement proof verdict plus learner-object ownership reporting for completed derivation runs.

- Add `scripts/analyze-derivation-learner-object-outcomes.js`.
- Accept run labels, run directories, or direct `result.json` files.
- Resolve labels from common derivation export directories:
  - `exports/dramatic-derivation/loop`
  - `exports/dramatic-derivation/episodes`
  - `exports/dramatic-derivation/ownership-transfer-detector-audit/fresh-runs`
  - `exports/dramatic-derivation/ownership-transfer-detector-audit/episodes`
- Write:
  - `exports/dramatic-derivation/learner-object-outcomes/summary.json`
  - `exports/dramatic-derivation/learner-object-outcomes/report.md`
- Report proof verdict, turns, final D, forced/asserted gap, final learner transformation, durability, missing ownership families, and leak-audit status.
- Classify each run as:
  - `proof_and_ownership_grounded`
  - `proof_grounded_ownership_partial`
  - `proof_failed`
  - `not_instrumented`

This path is evaluation-only. It must not change proof-control behavior.

## Path 2: Blinded Transcript-Quality Evaluation

Use the existing pairwise transcript harness to judge public transcript quality where proof reliability is already matched.

Initial packet:

```bash
node scripts/build-derivation-transcript-pairwise-eval.js \
  --loop-dir exports/dramatic-derivation/ownership-transfer-detector-audit/fresh-runs \
  --out-dir exports/dramatic-derivation/ownership-transcript-quality-eval \
  --pair heth15-transfergate-fresh=world015-transferdetector-fresh-s2-ownership-r1,world015-transferdetector-fresh-s2-transfer-r1 \
  --force
```

Score with the recent Opus CLI max convention:

```bash
node scripts/score-derivation-transcript-pairwise-eval.js \
  --packet-dir exports/dramatic-derivation/ownership-transcript-quality-eval \
  --judge-cli claude \
  --judge-model opus \
  --judge-effort max \
  --force
```

Interpret pairwise wins only as transcript-quality evidence unless the winning arm also improves proof or ownership metrics.

## Path 3: Targeted Episode Replay Gate

Do not run broad paid matrices for transfer gating.

Trigger replay only when a completed first-pass run satisfies all of:

- final proof is grounded or final assertion is available;
- final ownership is incomplete;
- exactly one declared ownership family is missing, especially `near_transfer`;
- the source artifact has complete `result.json` and `diagnosis.json`.

Replay pattern:

```bash
node scripts/run-derivation-episode.js \
  --from <source-run-dir> \
  --turn <first-live-turn> \
  --window 4 \
  --ownership-proof on \
  --ownership-transfer-gate on \
  --label <source-label>-ownership-replay-from-t<turn> \
  --out exports/dramatic-derivation/ownership-replay-gates
```

Accept replay only if prefix integrity is clean, proof verdict is no worse than the source, final ownership becomes transformed, forced/asserted gap is no worse by more than one turn, and leak audits remain clean. Only then run one fresh first-pass paid paired comparison under new labels.

## Assumptions

- `hidden+proofDebt` remains the default proof-control substrate.
- `--ownership-transfer-gate` remains experimental and off by default.
- Saved transcript re-scoring is detector audit only, not revised evidence.
- Ownership reporting is evaluation-layer instrumentation, not proof-control authority.
