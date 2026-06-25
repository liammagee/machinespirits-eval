# Yoked-contingency model-invariance smoke note

Date: 2026-06-24.

Scope: bounded evaluation note for
`PLAN_2_0/yoked-contingency-model-invariance-plan.md`. It began as a smoke
readiness check and now records the scaled closeout boundary: completed Claude,
GLM 5.2, and Codex/OpenAI-family rows support the endpoint.

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

## Scaled closeout rows

All completed scaled rows used `learnerProtocol=rule-transfer-novice`, `posttestProfile=hard-transfer`, and `sessionLimit=9`. Every completed row has invalid answers 0 and hidden-family prompt leaks 0.

| Plan source | Held-out learner | Status | delta2 | same > different | p | Calls |
|---|---|---|---:|---:|---:|---:|
| frozen Codex G1 | `claude-code:haiku` | pass | 0.322 | 9/9 | 0.0020 | 27 |
| frozen Codex G1 | `claude-code:sonnet` | pass | 0.389 | 9/9 | 0.0020 | 27 |
| frozen Codex G1 | `codex` | pass | 0.378 | 9/9 | 0.0020 | 27 |
| regenerated `claude-code:sonnet` G1 | `claude-code:haiku` | pass | 0.311 | 8/9 | 0.0195 | 27 |
| regenerated `claude-code:sonnet` G1 | `claude-code:sonnet` | pass | 0.445 | 9/9 | 0.0020 | 27 |
| regenerated `openrouter:z-ai/glm-5.2` G1 | `openrouter:z-ai/glm-5.2` | pass | 0.400 | 9/9 | 0.0020 | 28 |
| regenerated `codex` G1 | `codex` | pass | 0.366 | 9/9 | 0.0020 | 27 |
## Local artifacts

- `exports/yoked-contingency-model-invariance-dry-run/matrix.md`
- `exports/yoked-contingency-model-invariance-claude-smoke/matrix.md`
- `exports/yoked-contingency-model-invariance-claude-smoke-frozen-haiku-rerun/matrix.md`
- `exports/yoked-contingency-model-invariance-openrouter-smoke/matrix.md`
- `exports/yoked-contingency-model-invariance-claude-planner-scaled/matrix.md`
- `exports/yoked-contingency-model-invariance-codex-planner-scaled/matrix.md`
- `exports/yoked-contingency-model-invariance-glm52-planner-scaled/matrix.md`
- `exports/yoked-contingency-model-invariance-scaled-summary/summary.md`

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

Promotion rule update: the completed Claude, GLM 5.2, and Codex/OpenAI-family
rows now warrant a bounded main-paper addendum. The claim must stay limited to
completed rows and must not be inflated into model-universal invariance.

