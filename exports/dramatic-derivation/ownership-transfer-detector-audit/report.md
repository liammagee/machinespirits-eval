# Ownership Transfer Detector Audit

Generated: 2026-06-17T22:48:00Z

## Boundary

- This audit tightens the learner-object ownership detector and checks whether the ownership transfer gate deserves promotion.
- Saved transcript re-scoring is detector audit only. It does not rewrite or promote prior paid evidence.
- Episode replay is used for prefix integrity and prompt/detector wiring, not as fresh behavioral evidence.
- The fresh two-arm paid comparison is first-pass evidence, no rerolls. The initial launcher failed before useful artifacts because of a readonly shell variable; the exact labels were relaunched once and both completed successfully.

## Detector Changes

- `near_transfer` now requires an explicit transfer marker plus transported structure.
- Generic "like" no longer credits near transfer.
- "different file" / "structure travels" only credit near transfer when the liability/cause or first-line/second-line distinction actually travels.
- Structural learner restatement now counts as owned wording when it is not merely echoing the tutor.
- Earlier echo no longer cancels later owned restatement.

Focused tests and full suite passed:

```bash
node --test tests/dramaticDerivationObjectOwnership.test.js
node --test tests/dramaticDerivationLearnerTransformation.test.js
npm test
```

Full suite result: 3883 passing, 1 skipped, 0 failed.

## Saved Transcript Detector Audit

| Run | Gate | Verdict | Turns | Forced | Asserted | Gap | Final ownership | Missing | First near transfer | Durability |
| --- | --- | --- | ---: | ---: | ---: | ---: | --- | --- | --- | --- |
| world015-hard-s0-drift-r1 | off | grounded_anagnorisis | 21 | 20 | 21 | 1 | partial_ownership | near_transfer | none | not_transformed |
| world015-hard-s1-static-cast-r1 | off | grounded_anagnorisis | 23 | 20 | 23 | 3 | partial_ownership | near_transfer | none | not_transformed |
| world015-hard-s2-reinvention-r1 | off | grounded_anagnorisis | 20 | 20 | 20 | 0 | partial_ownership | near_transfer | none | not_transformed |
| world015-hard-s2-ownership-r1 | off | grounded_anagnorisis | 20 | 20 | 20 | 0 | partial_ownership | near_transfer | none | not_transformed |
| world015-transfergate-s2-ownership-r1 | off | grounded_anagnorisis | 20 | 20 | 20 | 0 | partial_ownership | near_transfer | none | not_transformed |
| world015-transfergate-s2-transfer-r1 | on | grounded_anagnorisis | 22 | 20 | 22 | 2 | transformed | none | t22 | single_point_transformation |

The saved transfer-gate transcript contains a valid different-file two-line transfer at closure:

> "First line: the bonded builder raised the work under his own seal ... Second line: the yard-mark..."

That validates prompt/detector agreement, but only retrospectively on an old paid transcript. It is not policy evidence by itself.

## Episode Replay Gates

| Replay | Source | Prefix | Window | Result | Ownership | Prefix integrity | Interpretation |
| --- | --- | ---: | ---: | --- | --- | --- | --- |
| world015-transfergate-detector-replay-from-t23 | saved gate success | 22 turns | 1 | grounded, forced t20, asserted t22 | not recomputed; no live suffix turn | ok | prefix integrity only |
| world015-transfergate-detector-mock-from-t20 | saved ungated prefix | 19 turns | 3 | grounded, forced/asserted t20 | partial_ownership, missing near_transfer | ok | mock ignored transfer advisory; wiring check only |

The replay gate did not justify policy promotion. It showed prefix integrity and that the transfer prompt can be present without changing proof-control authority, but the mock suffix did not produce the missing transfer.

## Fresh Paid Comparison

Both arms used the same paid stack and feature set:

```bash
DERIVATION_PROVIDER=codex
DERIVATION_LEARNER_PROVIDER=claude
DERIVATION_LEARNER_MODEL=sonnet
DERIVATION_CLI_TIMEOUT_MS=900000
DERIVATION_LLM=real
DERIVATION_TRACE=0
node scripts/run-derivation-loop.js \
  --world config/drama-derivation/world-015-hethel-public-reversal.yaml \
  --script config/drama-derivation/tutor-scripts/hethel-v001.md \
  --real --superego \
  --acts '{"minActTurns":3,"maxActTurns":8}' \
  --scene-mode on \
  --director-cadence scene \
  --stage-prologue on \
  --register modern \
  --rhetorical-policy '{"mode":"deterministic","seed":1,"temperature":1}' \
  --discursive-calibration \
  --didactic-mode \
  --cast-layer \
  --cast-reinvention \
  --learner-drift \
  --ownership-proof \
  --critic off
```

The transfer arm added `--ownership-transfer-gate`.

| Label | Gate | Verdict | Turns | Forced | Asserted | Gap | Final ownership | First complete | Durability | Leak audits |
| --- | --- | --- | ---: | ---: | ---: | ---: | --- | ---: | --- | --- |
| world015-transferdetector-fresh-s2-ownership-r1 | off | grounded_anagnorisis | 21 | 20 | 21 | 1 | transformed | t5 | durable_transformation | ok |
| world015-transferdetector-fresh-s2-transfer-r1 | on | grounded_anagnorisis | 21 | 20 | 21 | 1 | transformed | t7 | durable_transformation | ok |

Intermediate trajectory:

- The control reached detector-complete ownership at t5.
- The transfer-gate arm reached detector-complete ownership at t7.
- Both reached D=2 at t13, D=1 at t17, D=0 at t20, and grounded assertion at t21.
- Both survived all subsequent release challenges once complete.

## Interpretation

The detector patch is useful: it prevents cheap near-transfer credit from topical "different file" or preference-language uses of "like," while still recognizing a real transported two-line distinction.

The runtime ownership-transfer gate is not validated by this mini-run. In fresh first-pass evidence, the ungated ownership arm already produced durable transformation earlier than the gated arm, and both arms finished with identical proof timing and verdict. The gate therefore did not rescue a failure, reduce turns, improve final grounding, or improve assertion timing.

Do not promote `--ownership-transfer-gate` into the default derivation arm on this evidence. Keep it as an experimental/debug flag for cases where the specific failure is "final assertion occurs while near_transfer remains missing."

## Recommended Next Step

The next useful move is not another broad paid matrix. Keep the detector tightening, but treat transfer gating as a narrow contingency:

1. Commit the detector/test/report increment if the worktree slice is otherwise coherent.
2. Leave the gate off by default.
3. If a future first-pass run reaches final assertion with ownership missing only `near_transfer`, use episode replay from the late prefix to test a targeted transfer prompt.
4. Only run paid validation for the gate when the replayed prefix shows it can fix that exact late missing-family failure without delaying proof closure.

## Artifacts

- Detector/report directory: `exports/dramatic-derivation/ownership-transfer-detector-audit/`
- Saved transcript audit summary: `exports/dramatic-derivation/ownership-transfer-detector-audit/summary.json`
- Episode replays: `exports/dramatic-derivation/ownership-transfer-detector-audit/episodes/`
- Fresh paid runs: `exports/dramatic-derivation/ownership-transfer-detector-audit/fresh-runs/`
- Fresh logs and manifest: `exports/dramatic-derivation/ownership-transfer-detector-audit/logs/`
