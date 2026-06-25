# Yoked-contingency model-invariance smoke note

Date: 2026-06-24.

Scope: bounded smoke evaluation of
`PLAN_2_0/yoked-contingency-model-invariance-plan.md`. This is not a
main-paper claim. It is a readiness check for a scaled model-invariance run.

## Validation

Focused yoked-contingency tests passed:

```bash
node --test \
  tests/yokedContingencyG0PaidSmoke.test.js \
  tests/yokedContingencyG1PaidSmoke.test.js \
  tests/yokedContingencyG2IndependentOutcome.test.js \
  tests/yokedContingencyModelInvariance.test.js
```

Result: 23/23 passing.

## Smoke rows

Frozen scaled G1 input:
`exports/yoked-contingency-g1-scaled.json`, copied from the prior causal-test
worktree into this worktree's ignored `exports/` directory.

All passing rows below used:

- `learnerProtocol`: `rule-transfer-novice`
- `posttestProfile`: `hard-transfer`
- `sessionLimit`: 1
- invalid answers: 0
- hidden-family prompt leaks: 0
- same-state yoked gain > different-state yoked gain: 1/1

| Plan source | Held-out learner | Status | delta2 diagnosis |
|---|---|---|---:|
| frozen G1 | `claude-code:haiku` | pass | 0.400 |
| frozen G1 | `claude-code:sonnet` | pass | 0.600 |
| frozen G1 | `openrouter:z-ai/glm-4.7` | pass | 0.400 |
| regenerated `claude-code:sonnet` G1 | `claude-code:haiku` | pass | 0.200 |
| regenerated `claude-code:sonnet` G1 | `claude-code:sonnet` | pass | 0.600 |

One initial frozen-G1/Haiku row timed out under a 180-second per-call limit. A
targeted rerun with the standard 420-second Claude timeout passed, so this is
recorded as an infrastructure timeout boundary, not an observed contrast
failure.

## Local artifacts

- `exports/yoked-contingency-model-invariance-dry-run/matrix.md`
- `exports/yoked-contingency-model-invariance-claude-smoke/matrix.md`
- `exports/yoked-contingency-model-invariance-claude-smoke-frozen-haiku-rerun/matrix.md`
- `exports/yoked-contingency-model-invariance-openrouter-smoke/matrix.md`

These are ignored generated artifacts. The tracked evidence boundary is this
note plus the committed runner.

## Next gate

The smoke warrants a scaled run if the user wants to promote model-invariance
toward a paper claim. The scaled gate should keep the same endpoint and use:

```bash
OPENROUTER_ENV_FILE=/Users/lmagee/Dev/machinespirits/machinespirits-eval/.env \
CLAUDE_CODE_TIMEOUT_MS=420000 \
node scripts/run-yoked-contingency-model-invariance.js \
  --g1-json exports/yoked-contingency-g1-scaled.json \
  --learner-backends claude-code:haiku,claude-code:sonnet,openrouter \
  --planner-backends claude-code:sonnet \
  --session-limit 9 \
  --max-calls-per-run 27 \
  --max-plan-calls 27 \
  --learner-protocol rule-transfer-novice \
  --posttest-profile hard-transfer
```

Promotion rule: do not write a main-paper model-invariance claim unless the
scaled rows preserve same-state > different-state, have zero invalid answers,
have zero hidden-family prompt leaks, and pass the scaled sign-test criterion.

