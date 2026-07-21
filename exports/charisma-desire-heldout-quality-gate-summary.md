# Charisma/Desire Held-Out Quality Gate

Generated: 2026-07-21T22:39:31.062Z

Status: PASS

Gate decision: `FAIL_HELDOUT_QUALITY`

Advance: Do not advance; inspect failed arms before opening any promotion or human/hybrid gate.

## Question

Does the local charisma/desire selector retain artifact-level quality on held-out
derivation traces across model-role swaps, while scripted controls remain
negative and GLM/OpenRouter runtime behavior stays guarded?

This gate can support only a bounded claim: held-out artifact-level signal.
It authorizes no runtime policy promotion, no deployment claim, and no human-learning claim.

## Held-Out Artifact Pool

| Scenario | Signal | Artifact | Name |
| --- | --- | --- | --- |
| charisma_desire_heldout_ai_syllabus_boredom | boredom | 479-lecture-8 | Charisma Desire Held-Out: AI Syllabus Boredom |
| charisma_desire_heldout_alignment_frustration | frustration | 479-lecture-6 | Charisma Desire Held-Out: Alignment Frustration |
| charisma_desire_heldout_community_irrelevance | irrelevance | 479-lecture-5 | Charisma Desire Held-Out: Community Irrelevance |
| charisma_desire_heldout_attention_question_flood | question_flood | 479-lecture-4 | Charisma Desire Held-Out: Attention Question Flood |
| charisma_desire_heldout_synthesis_rote_parroting | rote_parroting | 479-lecture-1 | Charisma Desire Held-Out: Synthesis Rote Parroting |

## Planned Arms

| Arm | Contrast | Profile | Tutor/id stack | Learner stack | Repeats | Rows | Quality criterion | Purpose |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| heldout_baseline_codex_tutor_codex_learner | heldout_reference | cell_193_id_director_charisma_resistance_boredom_stake_breakthrough_dynamic_verified | Codex tutor + Claude Sonnet 5 id | Codex dynamic learner | 2 | 10 | >= 50% positive | Check whether the Codex-stack local signal survives held-out artifacts. |
| heldout_tutor_fixed_glm_learner | heldout_hold_tutor_fixed_vary_learner | cell_193_id_director_charisma_resistance_boredom_stake_breakthrough_dynamic_verified | Codex tutor + Claude Sonnet 5 id | GLM dynamic learner | 2 | 10 | >= 40% positive | Check whether the held-out signal survives when only the dynamic learner stack changes. |
| heldout_learner_fixed_glm_tutor | heldout_hold_learner_fixed_vary_tutor_id | cell_193_id_director_charisma_resistance_boredom_stake_breakthrough_dynamic_verified | GLM tutor + GLM id | Codex dynamic learner | 2 | 10 | >= 40% positive | Check whether the held-out signal survives when only the tutor/id stack changes. |
| heldout_full_glm_reference | heldout_full_glm_reference | cell_193_id_director_charisma_resistance_boredom_stake_breakthrough_dynamic_verified | GLM tutor + GLM id | GLM dynamic learner | 2 | 10 | >= 30% positive | Check whether full GLM remains above the minimum artifact-level quality floor. |
| heldout_scripted_control_codex_tutor | heldout_fixed_resistant_turns_codex_tutor | cell_195_id_director_charisma_resistance_boredom_stake_scripted_control_verified | Codex tutor + Claude Sonnet 5 id | scripted unified turns | 1 | 5 | <= 0 positive scripted rows | Keep fixed scripted turns as a tutor-register control, not learner-outcome evidence. |
| heldout_scripted_control_glm_tutor | heldout_fixed_resistant_turns_glm_tutor | cell_195_id_director_charisma_resistance_boredom_stake_scripted_control_verified | GLM tutor + GLM id | scripted unified turns | 1 | 5 | <= 0 positive scripted rows | Verify GLM tutor/id register shape on fixed turns without counting scripted uptake. |

Planned rows: 50 generation-only rows.

Runtime guard for GLM/OpenRouter arms: `OPENROUTER_API_TIMEOUT_MS=480000`, `OPENROUTER_REASONING_MAX_TOKENS=0`, `OPENROUTER_REASONING_EXCLUDE=true`, and `EVAL_CAPTURE_API_PAYLOADS=false`.

## Run Completion

| Arm | Run IDs | Successful rows | Failed rows | Required pass | Forbidden pass | Status | Scenario counts |
| --- | --- | --- | --- | --- | --- | --- | --- |
| heldout_baseline_codex_tutor_codex_learner | eval-2026-07-01-caab0c08 | 10/10 | 0 | 10/10 | 10/10 | complete | ai_syllabus_boredom:2/2; alignment_frustration:2/2; community_irrelevance:2/2; attention_question_flood:2/2; synthesis_rote_parroting:2/2 |
| heldout_tutor_fixed_glm_learner | eval-2026-07-01-0fd5defa | 10/10 | 0 | 9/10 | 10/10 | complete | ai_syllabus_boredom:2/2; alignment_frustration:2/2; community_irrelevance:2/2; attention_question_flood:2/2; synthesis_rote_parroting:2/2 |
| heldout_learner_fixed_glm_tutor | eval-2026-07-01-6af87b98 | 10/10 | 0 | 9/10 | 8/10 | complete | ai_syllabus_boredom:2/2; alignment_frustration:2/2; community_irrelevance:2/2; attention_question_flood:2/2; synthesis_rote_parroting:2/2 |
| heldout_full_glm_reference | eval-2026-07-01-22e62eb4 | 10/10 | 0 | 9/10 | 10/10 | complete | ai_syllabus_boredom:2/2; alignment_frustration:2/2; community_irrelevance:2/2; attention_question_flood:2/2; synthesis_rote_parroting:2/2 |
| heldout_scripted_control_codex_tutor | eval-2026-07-01-e42ecc3b | 5/5 | 0 | 5/5 | 5/5 | complete | ai_syllabus_boredom:1/1; alignment_frustration:1/1; community_irrelevance:1/1; attention_question_flood:1/1; synthesis_rote_parroting:1/1 |
| heldout_scripted_control_glm_tutor | eval-2026-07-01-fcb7a871 | 5/5 | 0 | 5/5 | 5/5 | complete | ai_syllabus_boredom:1/1; alignment_frustration:1/1; community_irrelevance:1/1; attention_question_flood:1/1; synthesis_rote_parroting:1/1 |

## Quality Summary

| Arm | Rows | Positive | Candidates | Route hits | Target matches | Residual flood | Reopened | Mean score |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| heldout_baseline_codex_tutor_codex_learner | 10 | 5/10 | 4/10 | 7/10 | 10/10 | 0/10 | 0/10 | 76.0 |
| heldout_tutor_fixed_glm_learner | 10 | 2/10 | 2/10 | 9/10 | 4/10 | 0/10 | 0/10 | 70.5 |
| heldout_learner_fixed_glm_tutor | 10 | 5/10 | 5/10 | 8/10 | 10/10 | 0/10 | 0/10 | 76.0 |
| heldout_full_glm_reference | 10 | 6/10 | 5/10 | 9/10 | 7/10 | 0/10 | 0/10 | 79.0 |
| heldout_scripted_control_codex_tutor | 5 | 0/5 | 0/5 | 5/5 | 4/5 | 0/5 | 0/5 | 75.0 |
| heldout_scripted_control_glm_tutor | 5 | 0/5 | 0/5 | 5/5 | 4/5 | 0/5 | 0/5 | 75.0 |

## Decision Rules

- Runtime: all six arms must complete 50 successful generation rows with zero failed rows.
- Dynamic quality: each dynamic role-swap arm must meet its positive-local-outcome floor, with route-hit rate and target-match rate at or above 80%.
- Scripted controls: both scripted arms must stay at zero positive local outcomes because scripted uptake is not learner evidence.
- Claim boundary: a pass advances only to bounded paper/spec fold-in, not runtime promotion.

## Decision Reasons

- heldout_baseline_codex_tutor_codex_learner route-hit rate 70% below 80%
- heldout_tutor_fixed_glm_learner positive outcome rate 20% below 40%
- heldout_tutor_fixed_glm_learner target-match rate 40% below 80%
- heldout_full_glm_reference target-match rate 70% below 80%

## Planned Commands

### heldout_baseline_codex_tutor_codex_learner

```bash
OPENROUTER_API_TIMEOUT_MS=480000 \
EVAL_CAPTURE_API_PAYLOADS=false \
ID_DIRECTOR_CLAUDE_CLI_TIMEOUT_MS=600000 \
ID_DIRECTOR_CODEX_CLI_TIMEOUT_MS=600000 \
EVAL_SCENARIOS_FILE=config/charisma-recognition-desire-scenarios.yaml \
  node scripts/eval-cli.js run \
  --profiles cell_193_id_director_charisma_resistance_boredom_stake_breakthrough_dynamic_verified \
  --scenario charisma_desire_heldout_ai_syllabus_boredom,charisma_desire_heldout_alignment_frustration,charisma_desire_heldout_community_irrelevance,charisma_desire_heldout_attention_question_flood,charisma_desire_heldout_synthesis_rote_parroting \
  --runs 2 \
  --parallelism 1 \
  --ego-model codex.gpt-5.5 \
  --superego-model openrouter.sonnet-5 \
  --learner-model codex.gpt-5.5 \
  --skip-rubric \
  --description "Charisma desire heldout quality gate: heldout_baseline_codex_tutor_codex_learner"
```

### heldout_tutor_fixed_glm_learner

```bash
OPENROUTER_REASONING_MAX_TOKENS=0 \
OPENROUTER_REASONING_EXCLUDE=true \
OPENROUTER_API_TIMEOUT_MS=480000 \
EVAL_CAPTURE_API_PAYLOADS=false \
ID_DIRECTOR_CLAUDE_CLI_TIMEOUT_MS=600000 \
ID_DIRECTOR_CODEX_CLI_TIMEOUT_MS=600000 \
EVAL_SCENARIOS_FILE=config/charisma-recognition-desire-scenarios.yaml \
  node scripts/eval-cli.js run \
  --profiles cell_193_id_director_charisma_resistance_boredom_stake_breakthrough_dynamic_verified \
  --scenario charisma_desire_heldout_ai_syllabus_boredom,charisma_desire_heldout_alignment_frustration,charisma_desire_heldout_community_irrelevance,charisma_desire_heldout_attention_question_flood,charisma_desire_heldout_synthesis_rote_parroting \
  --runs 2 \
  --parallelism 1 \
  --ego-model codex.gpt-5.5 \
  --superego-model openrouter.sonnet-5 \
  --learner-model openrouter.glm5_2 \
  --skip-rubric \
  --description "Charisma desire heldout quality gate: heldout_tutor_fixed_glm_learner"
```

### heldout_learner_fixed_glm_tutor

```bash
OPENROUTER_REASONING_MAX_TOKENS=0 \
OPENROUTER_REASONING_EXCLUDE=true \
OPENROUTER_API_TIMEOUT_MS=480000 \
EVAL_CAPTURE_API_PAYLOADS=false \
ID_DIRECTOR_CLAUDE_CLI_TIMEOUT_MS=600000 \
ID_DIRECTOR_CODEX_CLI_TIMEOUT_MS=600000 \
EVAL_SCENARIOS_FILE=config/charisma-recognition-desire-scenarios.yaml \
  node scripts/eval-cli.js run \
  --profiles cell_193_id_director_charisma_resistance_boredom_stake_breakthrough_dynamic_verified \
  --scenario charisma_desire_heldout_ai_syllabus_boredom,charisma_desire_heldout_alignment_frustration,charisma_desire_heldout_community_irrelevance,charisma_desire_heldout_attention_question_flood,charisma_desire_heldout_synthesis_rote_parroting \
  --runs 2 \
  --parallelism 1 \
  --ego-model openrouter.glm5_2 \
  --superego-model openrouter.glm5_2 \
  --learner-model codex.gpt-5.5 \
  --skip-rubric \
  --description "Charisma desire heldout quality gate: heldout_learner_fixed_glm_tutor"
```

### heldout_full_glm_reference

```bash
OPENROUTER_REASONING_MAX_TOKENS=0 \
OPENROUTER_REASONING_EXCLUDE=true \
OPENROUTER_API_TIMEOUT_MS=480000 \
EVAL_CAPTURE_API_PAYLOADS=false \
ID_DIRECTOR_CLAUDE_CLI_TIMEOUT_MS=600000 \
ID_DIRECTOR_CODEX_CLI_TIMEOUT_MS=600000 \
EVAL_SCENARIOS_FILE=config/charisma-recognition-desire-scenarios.yaml \
  node scripts/eval-cli.js run \
  --profiles cell_193_id_director_charisma_resistance_boredom_stake_breakthrough_dynamic_verified \
  --scenario charisma_desire_heldout_ai_syllabus_boredom,charisma_desire_heldout_alignment_frustration,charisma_desire_heldout_community_irrelevance,charisma_desire_heldout_attention_question_flood,charisma_desire_heldout_synthesis_rote_parroting \
  --runs 2 \
  --parallelism 1 \
  --ego-model openrouter.glm5_2 \
  --superego-model openrouter.glm5_2 \
  --learner-model openrouter.glm5_2 \
  --skip-rubric \
  --description "Charisma desire heldout quality gate: heldout_full_glm_reference"
```

### heldout_scripted_control_codex_tutor

```bash
OPENROUTER_API_TIMEOUT_MS=480000 \
EVAL_CAPTURE_API_PAYLOADS=false \
ID_DIRECTOR_CLAUDE_CLI_TIMEOUT_MS=600000 \
ID_DIRECTOR_CODEX_CLI_TIMEOUT_MS=600000 \
EVAL_SCENARIOS_FILE=config/charisma-recognition-desire-scenarios.yaml \
  node scripts/eval-cli.js run \
  --profiles cell_195_id_director_charisma_resistance_boredom_stake_scripted_control_verified \
  --scenario charisma_desire_heldout_ai_syllabus_boredom,charisma_desire_heldout_alignment_frustration,charisma_desire_heldout_community_irrelevance,charisma_desire_heldout_attention_question_flood,charisma_desire_heldout_synthesis_rote_parroting \
  --runs 1 \
  --parallelism 1 \
  --ego-model codex.gpt-5.5 \
  --superego-model openrouter.sonnet-5 \
  --skip-rubric \
  --description "Charisma desire heldout quality gate: heldout_scripted_control_codex_tutor"
```

### heldout_scripted_control_glm_tutor

```bash
OPENROUTER_REASONING_MAX_TOKENS=0 \
OPENROUTER_REASONING_EXCLUDE=true \
OPENROUTER_API_TIMEOUT_MS=480000 \
EVAL_CAPTURE_API_PAYLOADS=false \
ID_DIRECTOR_CLAUDE_CLI_TIMEOUT_MS=600000 \
ID_DIRECTOR_CODEX_CLI_TIMEOUT_MS=600000 \
EVAL_SCENARIOS_FILE=config/charisma-recognition-desire-scenarios.yaml \
  node scripts/eval-cli.js run \
  --profiles cell_195_id_director_charisma_resistance_boredom_stake_scripted_control_verified \
  --scenario charisma_desire_heldout_ai_syllabus_boredom,charisma_desire_heldout_alignment_frustration,charisma_desire_heldout_community_irrelevance,charisma_desire_heldout_attention_question_flood,charisma_desire_heldout_synthesis_rote_parroting \
  --runs 1 \
  --parallelism 1 \
  --ego-model openrouter.glm5_2 \
  --superego-model openrouter.glm5_2 \
  --skip-rubric \
  --description "Charisma desire heldout quality gate: heldout_scripted_control_glm_tutor"
```

## After Runs

```bash
EVAL_DB_PATH=/path/to/evaluations.db \
EVAL_LOGS_DIR=/path/to/logs \
node scripts/report-charisma-desire-breakthrough-matrix.js \
  --scenario-set heldout \
  --runs <comma-separated-heldout-run-ids>

EVAL_DB_PATH=/path/to/evaluations.db \
EVAL_LOGS_DIR=/path/to/logs \
node scripts/report-charisma-desire-heldout-quality-gate.js \
  --runs <comma-separated-heldout-run-ids>
```

## Validation

- No validation errors.
