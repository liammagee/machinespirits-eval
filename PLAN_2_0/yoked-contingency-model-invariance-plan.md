# Yoked-contingency model-invariance follow-up plan

Status: scaled follow-up closed for completed rows. Claude, GLM 5.2, and Codex/OpenAI-family routes support the endpoint.

This plan tests whether the yoked-contingency finding survives changes in the
model used to play the held-out learner, and then whether it survives a
non-Codex planner. It is not a main-paper claim until the scaled run passes and
the result is integrated into `docs/research/paper-full-2.0.md`.

## Five steps

1. Keep the frozen G1 plan artifact.

   Primary input is `exports/yoked-contingency-g1-scaled.json`. This preserves
   the already-generated tutor plans, so any change in G2 reflects the held-out
   learner model rather than a new planning sample.

2. Re-run G2 with held-out learner model variants.

   Run the same G2 endpoint with at least two non-identical learner backends.
   Prefer `claude-code:haiku`, `claude-code:sonnet`, and one
   `openrouter:<model>` selected through `OPENROUTER_MODEL` or an explicit
   model suffix when the key is available.

3. Regenerate plans with one non-Codex planner.

   Add at least one regenerated G1 artifact using `claude-code:sonnet` or an
   OpenRouter model. This separates "the frozen Codex-authored plan works" from
   "the causal contrast survives another planner's tutor plan distribution."

4. Hold the endpoint constant.

   Every row uses `--learner-protocol rule-transfer-novice` and
   `--posttest-profile hard-transfer`. The success condition is the same one:
   same-state yoked gain must be greater than different-state yoked gain with
   zero invalid answers and zero hidden-family prompt leaks.

5. Treat failures as boundary evidence.

   A row that fails is not discarded. It is classified as invalid-answer
   boundary, hidden-label leak, same-state-not-above-different-state, sign-test
   boundary, or runtime/infrastructure boundary. The next paper claim must state
   that boundary or repair it before scaling.

## Scaled closeout update (2026-06-24)

The scaled gate is no longer just planned. Seven completed scaled rows preserve the same-state-over-different-state hard-transfer endpoint:

| Plan source | Held-out learner | Status | delta2 | same > different | Boundary |
|---|---|---|---:|---:|---|
| frozen Codex G1 | `claude-code:haiku` | pass | 0.322 | 9/9 | completed support |
| frozen Codex G1 | `claude-code:sonnet` | pass | 0.389 | 9/9 | completed support |
| frozen Codex G1 | `codex` | pass | 0.378 | 9/9 | completed support |
| regenerated `claude-code:sonnet` G1 | `claude-code:haiku` | pass | 0.311 | 8/9 | completed support |
| regenerated `claude-code:sonnet` G1 | `claude-code:sonnet` | pass | 0.445 | 9/9 | completed support |
| regenerated `openrouter:z-ai/glm-5.2` G1 | `openrouter:z-ai/glm-5.2` | pass | 0.400 | 9/9 | completed support |
| regenerated `codex` G1 | `codex` | pass | 0.366 | 9/9 | completed support |

All completed rows have invalid answers 0 and hidden-family prompt leaks 0. The paper-safe wording is cross-model robustness across completed Claude/GLM/Codex rows, not model-universal invariance.

Summary artifact: `exports/yoked-contingency-model-invariance-scaled-summary/summary.md`.
## Smoke command

Use one session first. This is the paid-safe check.

```bash
node scripts/run-yoked-contingency-model-invariance.js \
  --g1-json exports/yoked-contingency-g1-scaled.json \
  --learner-backends claude-code:haiku,claude-code:sonnet \
  --planner-backends claude-code:sonnet \
  --session-limit 1 \
  --max-calls-per-run 3 \
  --max-plan-calls 3 \
  --learner-protocol rule-transfer-novice \
  --posttest-profile hard-transfer
```

If using OpenRouter, either set `OPENROUTER_ENV_FILE` to a local `.env` that
contains `OPENROUTER_API_KEY` and `OPENROUTER_MODEL`, or pass the model in the
backend string:

```bash
OPENROUTER_ENV_FILE=/Users/lmagee/Dev/machinespirits/machinespirits-eval/.env \
node scripts/run-yoked-contingency-model-invariance.js \
  --g1-json exports/yoked-contingency-g1-scaled.json \
  --learner-backends claude-code:haiku,claude-code:sonnet,openrouter \
  --planner-backends claude-code:sonnet \
  --session-limit 1 \
  --max-calls-per-run 3 \
  --max-plan-calls 3
```

## Scaled command

Run this only after the smoke has no invalid-answer or prompt-leak boundary.

```bash
OPENROUTER_ENV_FILE=/Users/lmagee/Dev/machinespirits/machinespirits-eval/.env \
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

## Claim gate

Promote to a main-paper model-invariance claim only if:

- the frozen-G1 rows pass for at least two held-out learner backends;
- the regenerated non-Codex planner row also preserves same-state >
  different-state on the same G2 endpoint;
- all rows have zero invalid answers and zero hidden-family prompt leaks;
- the scaled rows meet the G2 sign-test criterion where applicable;
- the report records any remaining model-specific boundary explicitly.

