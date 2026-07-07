# Recognition-Pressure v2 Regression Report

Date: 2026-06-15
Group: `recognition-pressure-v2-regression-20260615`

## Question

The v1 recognition-pressure matrix showed a real discourse effect but no reliability advantage. It also produced a small negative transfer case in Bitterwell: the learner reached `D=0` at the forced cue, but did not assert until the following recognition beat.

This v2 probe tested a narrower policy:

- keep recognition-need scoring and logging;
- do not make recognition pressure policy-active after a single confusion/resistance;
- activate recognition pressure only after repeated unacknowledged breakdown or repeated fast-reflex uptake;
- keep forced-answer recognition available after `D=0`, but do not treat ordinary recognition debt as a global scene objective.

## Implementation

The policy is versioned through scene config:

```json
{"recognitionNeed":"gated-v2"}
```

Compatibility boundary:

- `recognitionNeed: true` remains v1/direct.
- `recognitionNeed: false` remains off.
- `recognitionNeed: "gated-v2"` logs the same recognition-need signal but suppresses prompt/tempo/rhetorical effects unless the gate opens.

Touched files:

- `services/dramaticDerivation/rhetoricalMovePolicy.js`
- `services/dramaticDerivation/engine.js`
- `services/dramaticDerivation/llmRoles.js`
- `services/dramaticDerivation/index.js`
- `tests/dramaticDerivationScenes.test.js`

Validation before paid runs:

```bash
node --test tests/dramaticDerivationScenes.test.js
npm test
```

Both passed.

## Run Stack

Same real stack as the v1 matrix:

```bash
DERIVATION_PROVIDER=codex
DERIVATION_LEARNER_PROVIDER=claude
DERIVATION_LEARNER_MODEL=sonnet
DERIVATION_CLI_TIMEOUT_MS=900000
DERIVATION_LLM=real
DERIVATION_TRACE=0
node scripts/run-derivation-loop.js \
  --real \
  --superego \
  --acts '{"minActTurns":3,"maxActTurns":8}' \
  --scene-mode '{"recognitionNeed":"gated-v2", ...}' \
  --director-cadence scene \
  --register sample \
  --rhetorical-policy-stochastic \
  --rhetorical-policy '{"seed":61,"temperature":1.1}' \
  --critic off
```

The wrapper printed `date: invalid argument 's' for -I` on macOS when stamping logs. This affected wrapper timestamps only; all three runs completed with status 0 and normal artifacts.

## Regression Table

| World | Arm | Verdict | Turns | Forced | Asserted | Gap | Exchange profile | Gate activity |
|---|---|---|---:|---:|---:|---:|---|---|
| Ravensmark | v1 active | grounded_anagnorisis | 15 | 15 | 15 | 0 | C1 R3 H9 S1 A1 | n/a |
| Ravensmark | off | grounded_anagnorisis | 15 | 15 | 15 | 0 | C3 R6 H1 S3 Repair1 A1 | n/a |
| Ravensmark | v2 gated | grounded_anagnorisis | 15 | 15 | 15 | 0 | R2 H11 S1 A1 | 1 active, 14 suppressed |
| Bitterwell | v1 active | grounded_anagnorisis | 16 | 15 | 16 | 1 | C3 R3 H6 S3 A1 | n/a |
| Bitterwell | off | grounded_anagnorisis | 15 | 15 | 15 | 0 | C4 R2 H7 S1 A1 | n/a |
| Bitterwell | v2 gated | grounded_anagnorisis | 16 | 15 | 16 | 1 | C2 R2 H9 S2 A1 | 0 active, 16 suppressed |
| Withercombe | v1 active | grounded_anagnorisis | 20 | 19 | 20 | 1 | H12 S7 A1 | n/a |
| Withercombe | off | grounded_anagnorisis | 20 | 19 | 20 | 1 | C2 R6 H8 S3 A1 | n/a |
| Withercombe | v2 gated | grounded_anagnorisis | 20 | 19 | 20 | 1 | R2 H13 S4 A1 | 1 active, 19 suppressed |

Legend: C = confusion, R = resistance, H = hypothesis, S = substantive, A = assertion.

## Findings

The v2 gate did what it was coded to do: it mostly logged recognition pressure without making it policy-active. That preserved more visible friction than v1 active in Bitterwell and Withercombe.

But it did not fix the key endpoint:

- Ravensmark still passes cleanly at turn 15, gap 0.
- Bitterwell still forces at turn 15 and asserts at turn 16, gap 1.
- Withercombe still forces at turn 19 and asserts at turn 20, gap 1.

Therefore the sequence should stop here. The planned held-out validation should not run under this v2 as if it passed the regression gate.

## Interpretation

The Bitterwell failure is probably not caused by ordinary recognition-pressure smoothing. In this run v2 kept the recognition signal suppressed on every Bitterwell turn, yet the learner still failed to assert at the forced cue. The remaining cause looks closer to the assertion policy / learner uptake contract:

- the final evidence turn adopted the last premise and made `D=0`;
- the learner described the final conjunction substantively;
- but the learner did not convert that conjunction into the answer until the next turn.

So the next useful fix is not "more/less recognition pressure." It is a small assertion-gate intervention: when a release turn makes the answer forced, the learner should be allowed and encouraged to answer in the same turn if their board settles it. That should be implemented separately from recognition pressure, probably as a learner-side instruction or end-of-turn assertion affordance.

## Formalism Check

The public transcript scan found no explicit predicate/formal syntax leakage in the three v2 runs.

## Artifacts

Regression logs:

- `exports/dramatic-derivation/recognition-pressure-v2-regression-logs/recneed-v2-ravensmark-gated-r1.log`
- `exports/dramatic-derivation/recognition-pressure-v2-regression-logs/recneed-v2-bitterwell-gated-r1.log`
- `exports/dramatic-derivation/recognition-pressure-v2-regression-logs/recneed-v2-withercombe-gated-r1.log`

Loop artifacts:

- `exports/dramatic-derivation/loop/recneed-v2-ravensmark-gated-r1/`
- `exports/dramatic-derivation/loop/recneed-v2-bitterwell-gated-r1/`
- `exports/dramatic-derivation/loop/recneed-v2-withercombe-gated-r1/`

## Recommendation

Do not freeze v2 for held-out validation.

Keep the code path because it is useful and tested: `gated-v2` is a cleaner diagnostic policy than v1 active. But the next reliability increment should target final-turn assertion conversion, not recognition-pressure gating.
