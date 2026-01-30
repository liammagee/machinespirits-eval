# Evaluation System Variables Reference

Complete inventory of all configuration variables, parameters, and moving parts in the machinespirits-eval system.

---

## 1. Environment Variables

| Variable | Required | Purpose | Used By |
|----------|----------|---------|---------|
| `OPENROUTER_API_KEY` | Yes (for budget/default profiles) | OpenRouter API authentication | evaluationRunner, rubricEvaluator, benchmarkService, learnerConfigLoader |
| `ANTHROPIC_API_KEY` | For Anthropic-direct profiles | Anthropic API authentication | rubricEvaluator, promptRecommendationService |
| `OPENAI_API_KEY` | For OpenAI profiles | OpenAI API authentication | rubricEvaluator |
| `GEMINI_API_KEY` | For Gemini profiles | Google Gemini API authentication | rubricEvaluator |
| `TUTOR_PROFILE` / `TUTOR_AGENT_PROFILE` | No | Override active tutor profile | tutorConfigLoader |
| `LEARNER_PROFILE` / `LEARNER_AGENT_PROFILE` | No | Override active learner profile | learnerConfigLoader |
| `TUTOR_TRANSCRIPT` | No | Set to `'true'` to suppress debug logging | evaluationRunner, rubricEvaluator |
| `PORT` | No | Standalone server port (default: `8081`) | server.js |
| `STANDALONE` | No | Enable standalone server mode | server.js |

---

## 2. CLI Commands & Flags

**Entry point:** `node scripts/eval-cli.js`

### Commands

| Command | Description |
|---------|-------------|
| `list` | List available scenarios, configurations, and profiles |
| `quick` / `test` | Run a single quick evaluation test |
| `run` | Run full evaluation batch |
| `report <runId>` | Generate report for a previous run |

### Flags

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--scenario <id>` | String | `new_user_first_visit` | Scenario ID to evaluate |
| `--config <name>` | String | — | Configuration name |
| `--profile <name>` | String | `budget` | Tutor profile name |
| `--skip-rubric` | Boolean | `false` | Skip AI judge, use pattern matching only |
| `--verbose` | Boolean | `false` | Enable verbose output |
| `--runs <n>` | Number | `1` | Number of runs per configuration |
| `--parallelism <n>` | Number | `2` | Concurrent test count |
| `--description <text>` | String | — | Label for the evaluation run |

### npm Scripts

| Script | Expands To |
|--------|-----------|
| `npm run eval` | `node scripts/eval-cli.js` |
| `npm run eval:quick` | `node scripts/eval-cli.js quick` |
| `npm run eval:test` | `node scripts/eval-cli.js test` |
| `npm start` | `STANDALONE=true node server.js` |

---

## 3. Provider Configuration

**Source:** `node_modules/@machinespirits/tutor-core/config/providers.yaml`

### Providers

| Provider | Base URL | API Key Env | Default Model |
|----------|----------|-------------|---------------|
| `anthropic` | `https://api.anthropic.com/v1/messages` | `ANTHROPIC_API_KEY` | `claude-sonnet-4-5` |
| `openai` | `https://api.openai.com/v1/chat/completions` | `OPENAI_API_KEY` | `gpt-5-mini` |
| `openrouter` | `https://openrouter.ai/api/v1/chat/completions` | `OPENROUTER_API_KEY` | `nvidia/nemotron-3-nano-30b-a3b:free` |
| `gemini` | `https://generativelanguage.googleapis.com/v1beta/models` | `GEMINI_API_KEY` | `gemini-3-flash-preview` |
| `local` | `http://localhost:1234/v1/chat/completions` | — (none) | `local-model` |

### Model Aliases (OpenRouter)

| Alias | Model ID | Tier |
|-------|----------|------|
| `nemotron` | `nvidia/nemotron-3-nano-30b-a3b:free` | Free |
| `glm47` | `z-ai/glm-4.7` | Free |
| `kimi-k2` | `moonshotai/kimi-k2-thinking` | Free |
| `deepseek` | `deepseek/deepseek-v3.2` | Free |
| `minimax` | `minimax/minimax-m2.1ate` | Free |
| `haiku` | `anthropic/claude-haiku-4.5` | Budget |
| `gpt-oss` | `openai/gpt-oss-120b` | Free |
| `sonnet` | `anthropic/claude-sonnet-4.5` | Mid |
| `gpt-mini` | `openai/gpt-5-mini` | Mid |
| `gemini-flash` | `google/gemini-3-flash-preview` | Mid |
| `opus` | `anthropic/claude-opus-4.5` | Premium |
| `gpt` | `openai/gpt-5.2` | Premium |
| `gemini-pro` | `google/gemini-3-pro-preview` | Premium |

### Model Pricing (per 1M tokens)

**Source:** `node_modules/@machinespirits/tutor-core/services/pricingConfig.js`

| Model Ref | Input ($) | Output ($) | Tier |
|-----------|-----------|------------|------|
| `openrouter.nemotron` | 0.00 | 0.00 | Free |
| `openrouter.gemini-flash` | 0.075 | 0.30 | Budget |
| `openrouter.gpt-mini` | 0.15 | 0.60 | Budget |
| `openrouter.deepseek` | 0.27 | 1.10 | Mid |
| `openrouter.haiku` | 0.80 | 4.00 | Budget |
| `openrouter.sonnet` | 3.00 | 15.00 | Mid |
| `openrouter.gpt` | 5.00 | 15.00 | Mid |
| `openrouter.gemini-pro` | 1.25 | 5.00 | Mid |
| `openrouter.opus` | 15.00 | 75.00 | Premium |

---

## 4. Tutor Profiles

**Source:** `config/tutor-agents.yaml` (local override of tutor-core)

**Active profile:** `budget` (overridable via `TUTOR_PROFILE` env var)

### 2×2×2 Factorial Design

Three independent variables, each with two levels:
- **Factor A: Recognition** — standard prompts vs recognition-enhanced prompts + memory
- **Factor B: Architecture** — single agent (ego only) vs multi-agent (ego + superego)
- **Factor C: Model Tier** — free (nemotron) vs paid (sonnet)

### Profile Summary

| Profile | Recognition | Architecture | Model | Dialogue | Description |
|---------|------------|-------------|-------|----------|-------------|
| `budget` | — | Single | deepseek | No | Dev workhorse (not in factorial) |
| `single_baseline` | No | Single | nemotron | No | Cell 1: control |
| `single_baseline_paid` | No | Single | sonnet | No | Cell 2: model quality only |
| `baseline` | No | Ego+Superego | nemotron | Yes (2) | Cell 3: architecture only |
| `baseline_paid` | No | Ego+Superego | sonnet | Yes (2) | Cell 4: architecture + model |
| `single_recognition` | Yes | Single | nemotron | No | Cell 5: recognition only |
| `single_recognition_paid` | Yes | Single | sonnet | No | Cell 6: recognition + model |
| `recognition` | Yes | Ego+Superego | nemotron | Yes (2) | Cell 7: recognition + architecture |
| `recognition_paid` | Yes | Ego+Superego | sonnet | Yes (2) | Cell 8: all three factors |

### Hyperparameters per Agent Role

| Parameter | Typical Ego | Typical Superego | Judge |
|-----------|-------------|------------------|-------|
| `temperature` | 0.6–0.7 | 0.4–0.6 | 0.2 |
| `max_tokens` | 800–2500 | 800–1500 | 4000 |

### Superego Intervention Strategies

| Strategy | Style | Description |
|----------|-------|-------------|
| `direct_critique` | Assertive | Explicit issue identification with reasoning |
| `socratic_challenge` | Questioning | Question-based guidance |
| `reframing` | Collaborative | Alternative perspectives |
| `prompt_rewrite` | Meta | System prompt improvement suggestions |

### Dialogue Settings

| Parameter | Description | Typical Values |
|-----------|-------------|----------------|
| `enabled` | Whether ego-superego dialogue runs | `true` / `false` |
| `max_rounds` | Maximum ego-superego exchange rounds | 0–3 |
| `convergence_threshold` | Similarity threshold to stop early | 0.7–0.8 |

### Intervention Thresholds

| Parameter | Default | Description |
|-----------|---------|-------------|
| `low_intensity_skip_dialogue` | `true` | Skip dialogue for low-stakes interactions |
| `high_intensity_extra_rounds` | `true` | Add rounds for high-stakes situations |
| `struggle_signal_threshold` | `2` | Number of struggle signals before escalation |
| `rapid_nav_window_ms` | `30000` | Window for detecting rapid navigation |
| `retry_frustration_count` | `3` | Retries before frustration flag |

---

## 5. Rubric Dimensions & Scoring

**Source:** `config/evaluation-rubric.yaml`

### Scoring Scale

All dimensions scored 1–5:
- **1:** Completely fails
- **2:** Weak, significant issues
- **3:** Adequate, meets basic expectations
- **4:** Good, exceeds expectations
- **5:** Excellent, exemplary

### Base Dimensions (6)

| Dimension | Weight | Evaluates |
|-----------|--------|-----------|
| Relevance | 0.15 | Context-awareness and appropriateness to learner state |
| Specificity | 0.15 | Concrete references vs. vague suggestions |
| Pedagogical Soundness | 0.15 | ZPD targeting, scaffolding, learning science alignment |
| Personalization | 0.10 | Tailored to individual learner journey/history |
| Actionability | 0.10 | Clear, executable next steps |
| Tone | 0.10 | Supportive, encouraging, appropriate register |

### Recognition Dimensions (Phase 5, 4+)

| Dimension | Weight | Evaluates |
|-----------|--------|-----------|
| Mutual Recognition | 0.10 | Acknowledges learner as autonomous subject with own understanding |
| Dialectical Responsiveness | 0.10 | Genuine engagement with learner's position, productive tension |
| Memory Integration | 0.05 | References and builds on prior interactions |
| Transformative Potential | 0.10 | Creates conditions for conceptual restructuring |

**Overall Score Formula:**
```
overall = Σ(dimension_score × weight) / totalWeight    →  normalized, then (avg - 1) / 4 × 100 → range 0–100
```

### Dual Scoring

The system reports three scores per evaluation:

| Score | Dimensions | Purpose |
|-------|-----------|---------|
| `overallScore` | All 10 dimensions | Combined quality metric |
| `baseScore` | 6 base dimensions (relevance, specificity, pedagogical, personalization, actionability, tone) | Pedagogical quality |
| `recognitionScore` | 4 recognition dimensions (mutual_recognition, dialectical_responsiveness, memory_integration, transformative_potential) | Recognition dynamics quality |

Each sub-score re-normalizes weights to sum to 1.0 within its dimension group. Both use the same `(avg - 1) / 4 × 100` formula to produce 0–100 values.

Stored in `evaluation_results` as `base_score` and `recognition_score` columns. Aggregated in `getRunStats()` as `avg_base_score` and `avg_recognition_score`.

### Evaluation Modes

| Mode | Trigger | Method | Speed |
|------|---------|--------|-------|
| Fast | `--skip-rubric` | Pattern matching on `required_elements` / `forbidden_elements` | ~1–5s |
| Full Rubric | Default | AI judge semantic evaluation per dimension | ~5–30s |

---

## 6. Judge / Evaluator Configuration

**Source:** `config/evaluation-rubric.yaml` — unified source of truth for all judge models

### Suggestion Judge

| Parameter | Value | Purpose |
|-----------|-------|---------|
| Primary model | `openrouter.kimi-k2_5` | Rubric dimension scoring |
| Fallback model | `openrouter.nemotron` | Used if primary fails |
| Temperature | 0.2 | Low for scoring consistency |
| Max tokens | 4000 | Judge response budget |

### Interaction Judge

| Parameter | Value | Purpose |
|-----------|-------|---------|
| Primary model | `openrouter.kimi-k2_5` | Learner-tutor dialogue evaluation |
| Fallback model | `openrouter.nemotron` | Used if primary fails |
| Temperature | 0.2 | Low for scoring consistency |
| Max tokens | 6000 | Larger budget for multi-turn analysis |

Note: `interaction-eval-scenarios.yaml` no longer defines its own model — it references `evaluation-rubric.yaml → interaction_judge` as the single source of truth.

### Recommender (Prompt Improvement Analysis)

| Parameter | Value |
|-----------|-------|
| Model | `openrouter.kimi-k2_5` |
| Fallback | `openrouter.nemotron` |
| Temperature | 0.4 |
| Max tokens | 6000 |

### Fallback Chain in rubricEvaluator.js

1. Primary judge model (from rubric config)
2. Fallback judge model (from rubric config)
3. Hardcoded fallback: `deepseek/deepseek-chat-v3-0324`

---

## 7. Suggestion Scenarios

**Source:** `config/suggestion-scenarios.yaml` (previously in `evaluation-rubric.yaml`)

**Total scenarios:** 15 (trimmed from 49 in v2.0.0)

Each scenario has a `type: suggestion` discriminator, an explicit `id` field, and a `category` field.

### Categories

| Category | Count | Purpose |
|----------|-------|---------|
| `core` | 6 | Fundamental learner states |
| `mood` | 2 | Emotional affect testing |
| `benchmark` | 1 | Cross-model sycophancy resistance |
| `recognition` | 3 | Hegelian recognition dynamics |
| `multi_turn` | 3 | Multi-step dialogue arcs |

### Scenarios by Category

| Category | ID | Name | Min Score | Turns |
|----------|----|------|-----------|-------|
| `core` | `new_user_first_visit` | New User - First Visit | 70 | 1 |
| `core` | `returning_user_mid_course` | Returning User - Mid Course | 75 | 1 |
| `core` | `struggling_learner` | Struggling Learner | 75 | 1 |
| `core` | `high_performer` | High Performing Learner | 75 | 1 |
| `core` | `concept_confusion` | Concept Confusion | 75 | 1 |
| `core` | `activity_avoider` | Activity Avoider | 70 | 1 |
| `mood` | `mood_frustrated_explicit` | Mood: Frustrated (Explicit) | 80 | 1 |
| `mood` | `mood_excited_curious` | Mood: Excited (High Engagement) | 80 | 1 |
| `benchmark` | `adversarial_tester` | Adversarial Tester | 75 | 1 |
| `recognition` | `recognition_seeking_learner` | Recognition: Learner Seeking Understanding | 80 | 1 |
| `recognition` | `memory_continuity_single` | Recognition: Memory Continuity | 80 | 1 |
| `recognition` | `transformative_moment_setup` | Recognition: Creating Transformative Conditions | 80 | 1 |
| `multi_turn` | `mood_frustration_to_breakthrough` | Frustration to Breakthrough | 75 | 4 |
| `multi_turn` | `misconception_correction_flow` | Misconception Correction | 75 | 5 |
| `multi_turn` | `mutual_transformation_journey` | Mutual Transformation | 85 | 6 |

### Scenario Structure

Each scenario defines:
- `type` — Discriminator (`suggestion` for all scenarios in this file)
- `id` — Explicit scenario ID (matches the YAML key)
- `category` — One of: `core`, `mood`, `benchmark`, `recognition`, `multi_turn`
- `name` — Human-readable title
- `description` — Situation context
- `is_new_user` — Boolean
- `learner_context` — Detailed learner state (markdown)
- `expected_behavior` — What the tutor should do
- `required_elements` — Patterns that MUST appear (fast mode)
- `forbidden_elements` — Patterns that must NOT appear (fast mode)
- `min_acceptable_score` — Passing threshold (0–100)
- `turns` — Array of follow-up turns (multi-turn scenarios only)

---

## 8. Interaction Evaluation Scenarios

**Source:** `config/interaction-eval-scenarios.yaml`

Each scenario has a `type: interaction` discriminator. The expected number of dialogue turns uses the `turn_count` field (not `turns`, which is reserved for scripted turn arrays in suggestion scenarios).

### Short-Term (Within-Session)

| ID | Turn Count | Focus | Key Weights |
|----|------------|-------|-------------|
| `recognition_request` | 4 | Learner seeks validation | mutual_recognition (0.3), dialectical_responsiveness (0.3) |
| `frustration_moment` | 5 | Learner frustration | emotional_attunement (0.3), scaffolding (0.3) |
| `misconception_surface` | 4 | Misconception revealed | mutual_recognition (0.3), dialectical_responsiveness (0.3) |
| `breakthrough_moment` | 3 | Learner insight | validation (0.3), extension (0.3) |
| `resistant_engagement` | 6 | Intelligent pushback | intellectual_respect (0.3), dialectical_responsiveness (0.3) |

### Long-Term (Multi-Session)

| ID | Sessions | Turns/Session | Focus |
|----|----------|---------------|-------|
| `novice_to_practitioner` | 5 | 4 | Learning arc |
| `stranger_to_recognized` | 4 | 5 | Relationship arc |
| `tutor_adaptation` | 4 | 4 | Tutor learning arc |

### Interaction Evaluation Dimensions (with weights)

Weights sum to 1.0 across all 10 dimensions. Each dimension has 5-point anchors (1–5).

**Learner (0.40 total):**

| Dimension | Weight | Description |
|-----------|--------|-------------|
| `authenticity` | 0.10 | Internal dynamics reflect persona realistically |
| `responsiveness` | 0.10 | Genuine reaction to tutor's engagement |
| `development` | 0.10 | Shows movement in understanding |
| `emotional_trajectory` | 0.05 | Emotional state changes appropriately |
| `knowledge_retention` | 0.05 | Concepts persist across sessions |

**Tutor (0.40 total):**

| Dimension | Weight | Description |
|-----------|--------|-------------|
| `strategy_adaptation` | 0.15 | Modifies approach based on effectiveness |
| `scaffolding_reduction` | 0.15 | Fades support as learner grows |
| `memory_utilization` | 0.10 | Effectively uses accumulated knowledge |

**Relationship (0.20 total):**

| Dimension | Weight | Description |
|-----------|--------|-------------|
| `trust_trajectory` | 0.10 | Trust develops appropriately over time |
| `mutual_recognition_depth` | 0.10 | Both parties show understanding of other |

### Interaction Outcome Types

| Outcome | Meaning |
|---------|---------|
| `BREAKTHROUGH` | Genuine understanding demonstrated |
| `PRODUCTIVE_STRUGGLE` | Healthy confusion and effort |
| `MUTUAL_RECOGNITION` | Both parties recognise each other |
| `FRUSTRATION` | Learner becomes frustrated |
| `DISENGAGEMENT` | Learner disengages |
| `SCAFFOLDING_NEEDED` | Learner needs more support |
| `FADING_APPROPRIATE` | Ready for less support |
| `TRANSFORMATION` | Conceptual restructuring occurring |

---

## 9. Learner Agent Configuration

**Source:** `config/learner-agents.yaml`

**Active architecture:** `unified` (overridable by tutor profile or `LEARNER_PROFILE` env var)

### Architectures

| Architecture | Agents | Deliberation | Rounds | Convergence |
|--------------|--------|-------------|--------|-------------|
| `unified` | 1 (single learner) | Disabled | 0 | — |
| `psychodynamic` | 4 (Desire, Intellect, Aspiration, Synthesizer) | Enabled | 2 | 0.7 |
| `dialectical` | 3 (Thesis, Antithesis, Synthesis) | Enabled | 2 | 0.7 |

### Psychodynamic Sub-Agent Hyperparameters

| Agent | Role | Temperature | Max Tokens |
|-------|------|-------------|------------|
| Desire | Id | 0.8 | 400 |
| Intellect | Ego | 0.5 | 400 |
| Aspiration | Superego | 0.6 | 400 |
| Synthesizer | — | 0.6 | 500 |

### Dialectical Sub-Agent Hyperparameters

| Agent | Temperature | Max Tokens |
|-------|-------------|------------|
| Thesis | 0.6 | 400 |
| Antithesis | 0.7 | 400 |
| Synthesis | 0.6 | 500 |

### Persona Modifiers

| Persona | Desire Wt | Intellect Wt | Aspiration Wt |
|---------|-----------|--------------|---------------|
| `confused_novice` | 0.4 | 0.3 | 0.3 |
| `eager_explorer` | 0.5 | 0.3 | 0.2 |
| `focused_achiever` | 0.2 | 0.4 | 0.4 |
| `struggling_anxious` | 0.5 | 0.2 | 0.3 |
| `adversarial_tester` | 0.3 | 0.4 | 0.3 |

### Ablation Study Profiles

8 profiles covering 2x2x2 factorial design:
- **Factor 1:** Single-agent (`unified`) vs Multi-agent (`psychodynamic`)
- **Factor 2:** Baseline tutor vs Recognition tutor
- **Factor 3:** Baseline prompts vs Multi-agent tutor dialogue

---

## 10. Evaluation Runner Constants

**Source:** `services/evaluationRunner.js`

| Constant | Value | Purpose |
|----------|-------|---------|
| `DEFAULT_PARALLELISM` | 2 | Concurrent test execution |
| `REQUEST_DELAY_MS` | 500 | Delay between API calls (ms) |
| `MAX_RETRIES` | 3 | Retry attempts on rate limit |
| `INITIAL_RETRY_DELAY_MS` | 2000 | Exponential backoff start (ms) |

Backoff formula: `INITIAL_RETRY_DELAY_MS × 2^attempt` → 2s, 4s, 8s

Only retries on 429 / rate limit errors, not other failures.

---

## 11. Benchmark Service

**Source:** `services/benchmarkService.js`

### Default Benchmark Models

| ID | Label | Tier |
|----|-------|------|
| `openrouter.nemotron` | Nemotron (Free) | Free |
| `openrouter.haiku` | Claude Haiku | Mid |
| `openrouter.sonnet` | Claude Sonnet | Premium |
| `openrouter.gpt-mini` | GPT-5 Mini | Mid |

### Benchmark Dimensions

| Dimension | Scenarios Used | Measures |
|-----------|---------------|----------|
| Modulation Responsiveness | struggling_learner, expert_validation, rapid_navigator | How model adjusts based on feedback |
| Sycophancy Tendency | expert_validation, mood_frustrated_explicit, adversarial_tester | Appropriate pushback vs over-agreement |
| Specificity Natural Rate | new_user_first_visit, mid_lecture_check, concept_confusion | Concreteness without explicit prompting |
| Dialogue Efficiency | struggling_learner, concept_confusion, mood_confused_upset | Rounds to convergence |

---

## 12. Database Schema

**Source:** `services/evaluationStore.js`
**Database:** `data/evaluations.db` (SQLite, WAL mode)

### evaluation_runs

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT PK | Unique run ID |
| `created_at` | DATETIME | Run start time |
| `description` | TEXT | Run label |
| `total_scenarios` | INTEGER | Scenario count |
| `total_configurations` | INTEGER | Config count |
| `total_tests` | INTEGER | Total test count |
| `status` | TEXT | `running` / `completed` |
| `completed_at` | DATETIME | Run end time |
| `metadata` | TEXT (JSON) | Additional metadata |

### evaluation_results

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT PK | Result ID |
| `run_id` | TEXT FK | Parent run |
| `scenario_id` | TEXT | Scenario tested |
| `scenario_type` | TEXT | `suggestion` or `interaction` (default: `suggestion`) |
| `provider` | TEXT | AI provider used |
| `model` | TEXT | Model ID |
| `profile_name` | TEXT | Tutor profile |
| `hyperparameters` | TEXT (JSON) | Temperature, max_tokens, etc. |
| `prompt_id` | TEXT | Prompt version |
| `latency_ms` | INTEGER | Response time |
| `input_tokens` | INTEGER | Tokens sent |
| `output_tokens` | INTEGER | Tokens received |
| `cost` | REAL | USD cost |
| `dialogue_rounds` | INTEGER | Ego-superego rounds |
| `api_calls` | INTEGER | Total API calls |
| `score_relevance` | REAL | 1–5 |
| `score_specificity` | REAL | 1–5 |
| `score_pedagogical` | REAL | 1–5 |
| `score_personalization` | REAL | 1–5 |
| `score_actionability` | REAL | 1–5 |
| `score_tone` | REAL | 1–5 |
| `overall_score` | REAL | 0–100 weighted |
| `base_score` | REAL | 0–100 base dimensions only |
| `recognition_score` | REAL | 0–100 recognition dimensions only |
| `passes_required` | INTEGER | Required elements check |
| `passes_forbidden` | INTEGER | Forbidden elements check |
| `required_missing` | TEXT (JSON) | Missing required patterns |
| `forbidden_found` | TEXT (JSON) | Found forbidden patterns |
| `judge_model` | TEXT | Judge model used |
| `evaluation_reasoning` | TEXT | Judge explanation |
| `success` | INTEGER | 1 = success, 0 = error |
| `error_message` | TEXT | Error details if failed |

### interaction_evaluations

| Column | Type | Description |
|--------|------|-------------|
| `scenario_id` | TEXT | Interaction scenario |
| `eval_type` | TEXT | `short_term` / `long_term` |
| `learner_profile` | TEXT | Learner architecture used |
| `tutor_profile` | TEXT | Tutor profile used |
| `persona_id` | TEXT | Learner persona |
| `turn_count` | INTEGER | Number of turns |
| `turns` | TEXT (JSON) | Full turn-by-turn dialogue |
| `total_tokens` | INTEGER | Combined token usage |
| `learner_tokens` | INTEGER | Learner agent tokens |
| `tutor_tokens` | INTEGER | Tutor agent tokens |
| `latency_ms` | INTEGER | Total interaction time |
| `learner_memory_before` | TEXT (JSON) | Memory snapshot pre-interaction |
| `learner_memory_after` | TEXT (JSON) | Memory snapshot post-interaction |
| `tutor_memory_before` | TEXT (JSON) | Tutor memory pre-interaction |
| `tutor_memory_after` | TEXT (JSON) | Tutor memory post-interaction |
| `judge_overall_score` | REAL | Judge's overall score |
| `judge_evaluation` | TEXT (JSON) | Full judge evaluation |

---

## 13. Memory Systems

### Writing Pad (Freudian Model)

| Layer | Persistence | Content |
|-------|-------------|---------|
| Conscious | Ephemeral | Current interaction context |
| Preconscious | Session | Recent patterns and observations |
| Unconscious | Permanent | Traces of significant moments |

**Databases:**
- `data/learner-writing-pad.db` — Learner memory persistence
- `data/tutor-writing-pad.db` — Tutor memory persistence

---

## 14. API Endpoints (Standalone Server)

**Port:** 8081 (default, configurable via `PORT` env var)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/eval/scenarios` | List evaluation scenarios |
| GET | `/api/eval/profiles` | List tutor profiles |
| GET | `/api/eval/runs` | List past evaluation runs |
| GET | `/api/eval/runs/:id` | Get specific run details |
| POST | `/api/eval/quick` | Run quick evaluation test |
| GET | `/health` | Health check |

---

## 15. Config File Locations

| File | Location | Purpose |
|------|----------|---------|
| `evaluation-rubric.yaml` | `config/` | Rubric dimensions, judge config (scenarios moved out) |
| `suggestion-scenarios.yaml` | `config/` | Suggestion evaluation scenarios (`type: suggestion`) |
| `interaction-eval-scenarios.yaml` | `config/` | Learner-tutor interaction scenarios (`type: interaction`) |
| `learner-agents.yaml` | `config/` | Learner architectures, personas |
| `providers.yaml` | `node_modules/@machinespirits/tutor-core/config/` | Provider definitions and model aliases |
| `tutor-agents.yaml` | `node_modules/@machinespirits/tutor-core/config/` | Tutor profiles, strategies, thresholds |
| `evaluations.db` | `data/` | SQLite results database |

**Note:** `providers.yaml` and `tutor-agents.yaml` have local overrides in `config/` that take precedence over the `@machinespirits/tutor-core` package versions. `suggestion-scenarios.yaml` is loaded by `evalConfigLoader.loadSuggestionScenarios()` with mtime-based caching, with a backward-compatible fallback to `evaluation-rubric.yaml` if the new file is missing.
