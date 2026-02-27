# Project Memory for Claude

## Core Architecture

### Bilateral Ego-Superego Architecture

Both tutor AND learner have dynamic LLM-powered ego-superego architectures:

**Tutor (services in @machinespirits/tutor-core):**
- Ego generates initial response
- Superego critiques for pedagogical soundness
- Ego revises based on feedback (final authority)

**Learner (services/learnerTutorInteractionEngine.js):**
- Ego generates initial reaction to tutor
- Superego critiques (is it too superficial? what's being missed?)
- Ego revision produces final external message

The learner is NOT scripted — it's a full LLM agent with its own deliberation. Multi-turn scenarios in `config/suggestion-scenarios.yaml` define initial prompts, but actual learner responses are LLM-generated via `generateLearnerResponse()`.

**Bilateral transformation measurement** tracks evolution of BOTH sides:
- `adaptationIndex`: How much tutor approach changes between turns
- `learnerGrowthIndex`: How much learner messages evolve (complexity, revision markers)
- `bilateralTransformationIndex`: Combined measure of mutual change

Related services:
- `services/turnComparisonAnalyzer.js` — Turn-over-turn evolution tracking
- `services/dialogueTraceAnalyzer.js` — Superego feedback incorporation analysis
- `services/learnerConfigLoader.js` — Learner personas and profiles

### Tutor-Learner Symmetry (Design Principle)

Always aim for absolute symmetry between tutor and learner trace labels, scoring pipelines, and data structures. When adding or modifying one side, mirror the change on the other.

**Trace agent/action labels** must be symmetric:
- Tutor: `tutor/context_input` → `ego/generate` → `superego/review` → `tutor/final_output`
- Learner: `learner/turn_action` → `learner_ego_initial/deliberation` → `learner_superego/deliberation` → `learner_ego_revision/deliberation` → `learner/final_output`

**Backward compat**: consumers must accept both old (`user`) and new (`tutor`/`learner`) agent labels, since existing dialogue log files on disk use the old format. Pattern: `(entry.agent === 'tutor' || entry.agent === 'user')`.

**Scoring pipeline** must be symmetric:
- Every tutor turn gets scored with the tutor rubric
- Every learner turn gets scored with the learner rubric
- Both aggregate to per-turn scores, first/last/overall/development metrics

Do NOT use asymmetric names. When in doubt, check the other side's labels and mirror them exactly.

## Configuration

### How to Read a Cell's Architecture

**RULE: Never guess a cell's architecture from its number or name. Always check `config/tutor-agents.yaml`.**

A cell's architecture is determined by these YAML fields:

| Field | What it controls |
|-------|-----------------|
| `factors.multi_agent_tutor` | Whether tutor has ego+superego (true) or ego-only (false) |
| `superego:` | `null` = no superego agent; configured block = superego present |
| `learner_architecture:` | `unified` = scripted learner; `ego_superego` = dynamic LLM learner |
| `factors.prompt_type:` | `base`, `recognition`, `enhanced`, `placebo`, `dialectical_*`, `naive` |
| `conversation_mode:` | absent = single-prompt; `messages` = multi-turn message chain |
| `dialogue.enabled:` | Whether ego-superego deliberation loop is active |
| `recognition_mode:` | Whether Hegelian recognition theory is in prompts |

**Key relationships:**
- `multi_agent_tutor: false` + `superego: null` = single-agent tutor (ego only, no deliberation)
- `multi_agent_tutor: true` + `superego: null` = tutor has self-reflection/profiling mechanisms but no separate superego agent
- `multi_agent_tutor: true` + `superego:` configured = tutor has distinct superego agent
- `learner_architecture: unified*` = learner messages come from scenario YAML (scripted)
- `learner_architecture: ego_superego*` = learner is a full LLM agent with internal deliberation

### Tutor Agent Cells (config/tutor-agents.yaml)

**Cells 1-8: 2×2×2 factorial** (base/recog × single/multi × unified/ego_superego)
- Odd cells: unified learner. Even cells: ego_superego learner.
- Cells 1-2: base, single. Cells 3-4: base, multi (superego configured). Cells 5-6: recog, single. Cells 7-8: recog, multi (superego configured).

**Cells 9-20: Prompt ablations** (all unified learner)
- 9-12: Enhanced prompts (single/multi × unified/psycho)
- 13-14: Hardwired rules (superego rules embedded in ego prompt)
- 15-18: Placebo control (length-matched, no recognition theory)
- 19-20: Memory isolation (recognition vs memory disentangling)

**Cell 21: Dynamic prompt rewriting** with Writing Pad

**Cells 22-33: Divergent superego variants** (superego configured, unified learner)
- 22-27: Standard ego + divergent superego (suspicious/adversary/advocate × base/recog)
- 28-33: Dialectical ego + divergent superego

**Cells 34-39: Full-feature dialectical** (superego null, unified learner, DEPRECATED)

**Cells 40-59: Mechanism variants** (superego null, unified learner)
- 40-45: Self-reflective evolution (suspicious/adversary/advocate × base/recog)
- 46-47: Quantitative disposition (base/recog)
- 48-49: Prompt erosion (base/recog)
- 50-51: Intersubjective recognition (base/recog)
- 52-53: Combined mechanisms (base/recog)
- 54-59: Other-ego profiling (tutor-only/bidirectional/full-suite/strategy)

**Cells 60-70, 72-79: Dynamic learner mechanism variants** (superego null, ego_superego learner)
- 60-63: Self-reflection/profiling × base/recog
- 64-65: Intersubjective/combined (recognition only)
- 66-68: Cognitive prosthesis variants
- 69-70: Base intersubjective/combined
- 72-77: A2 sweep (quantitative/erosion/tutor-profiling × base/recog)
- 78-79: Authentic learner variants

**Cell 71: Naive baseline** (no recognition, no superego, minimal prompt)

**Cells 80-90: Messages-mode variants** (conversation_mode: messages)
- 80-83: Base (single/multi × unified/psycho) — 82-83 have superego configured
- 84-90: Recognition — 86-89 have superego configured; 84, 85, 90 are single-agent (superego null)

**Superego presence summary**: Only cells with `multi_agent_tutor: true` AND an explicit superego block have an active superego agent. These are: 3-4, 7-8, 11-12, 17-18, 22-33, 82-83, 86-89. All other cells (including 34-79, 80-81, 84-85, 90) have `superego: null`.

### Adding New Cells

New eval-repo cells must be registered in the `EVAL_ONLY_PROFILES` array in `services/evaluationRunner.js` (line ~56-95). Without this, `resolveEvalProfile()` won't remap cell names to tutor-core profiles, and the run will silently fall back to the default profile.

Cell names must include "dialectical" if they use `prompt_type: dialectical_suspicious` (test enforced).

### Placebo Control Design

Placebo prompts (`prompts/tutor-ego-placebo.md`, `prompts/tutor-superego-placebo.md`):
- Match length/complexity of recognition prompts
- Contain pedagogical best practices
- Remove all Hegelian theory (mutual recognition, autonomous subject, etc.)
- Enable 3-way comparison: enhanced vs placebo vs recognition

## Evaluation Methodology

### Inter-Rater Reliability

Inter-judge reliability MUST compare the **same response** scored by different judges, not different responses from similar conditions.

**Correct approach**:
1. Generate paired data by rejudging same responses:
   ```bash
   node scripts/eval-cli.js rejudge <runId> --judge openrouter.gpt
   ```
2. Match on `suggestions` content (actual response), not just metadata
3. Then calculate correlation between judges

The script `scripts/analyze-judge-reliability.js` implements this correctly by hashing `suggestions` content.

### Database Schema (evaluation_results columns)

**There is NO `trace` column.** Do not reference `trace` in SQL queries.

Key columns: `id`, `run_id`, `scenario_id`, `scenario_name`, `provider`, `model`, `profile_name`, `hyperparameters` (JSON), `prompt_id`, `suggestions` (JSON array), `raw_response`, `latency_ms`, `input_tokens`, `output_tokens`, `cost`, `dialogue_rounds`, `api_calls`, `dialogue_id`, `score_relevance`, `score_specificity`, `score_pedagogical`, `score_personalization`, `score_actionability`, `score_tone`, `overall_score`, `passes_required`, `passes_forbidden`, `required_missing` (JSON), `forbidden_found` (JSON), `created_at`, `judge_model`, `evaluation_reasoning`, `success`, `error_message`, `scores_with_reasoning`, `scenario_type`, `base_score`, `recognition_score`, `ego_model`, `superego_model`, `factor_recognition`, `factor_multi_agent_tutor`, `factor_multi_agent_learner`, `learner_architecture`, `scoring_method`, `learner_scores`, `learner_overall_score`, `learner_judge_model`, `qualitative_assessment`, `qualitative_model`, `blinded_qualitative_assessment`, `blinded_qualitative_model`, `judge_latency_ms`, `learner_holistic_scores`, `learner_holistic_overall_score`, `learner_holistic_summary`, `learner_holistic_judge_model`, `tutor_holistic_scores` (JSON), `tutor_holistic_overall_score`, `tutor_holistic_summary`, `tutor_holistic_judge_model`, `tutor_last_turn_score`, `tutor_development_score`, `dialogue_quality_score`, `dialogue_quality_summary`, `dialogue_quality_judge_model`, `tutor_first_turn_score`, `dialogue_quality_internal_score`, `dialogue_quality_internal_summary`, `conversation_mode`, `tutor_scores` (JSON), `tutor_overall_score`, `tutor_deliberation_scores` (JSON), `tutor_deliberation_score`, `tutor_deliberation_summary`, `tutor_deliberation_judge_model`, `learner_deliberation_scores` (JSON), `learner_deliberation_score`, `learner_deliberation_summary`, `learner_deliberation_judge_model`, `tutor_rubric_version`, `learner_rubric_version`, `dialogue_rubric_version`

**evaluation_runs columns**: `id` (TEXT PK), `created_at`, `description`, `total_scenarios`, `total_configurations`, `total_tests`, `status`, `completed_at`, `metadata` (JSON), `git_commit`, `package_version`

### Important Notes

- CLI model format uses **dot notation**: `openrouter.gpt`, NOT `openrouter/gpt`
- CLI uses `--runs` NOT `--repeats` for runsPerConfig
- Database: `data/evaluations.db` (SQLite)
- DB tutor score column: `tutor_first_turn_score` (Turn 0 score; `overall_score` is deprecated alias)
- Always filter by `judge_model` when querying — runs can have rows from multiple judges
- `evaluate --force` only processes rows with NULL scores
- `rejudge` without `--judge` defaults to Sonnet 4.5, not Opus
- Rejudge creates new rows by default; `--overwrite` replaces
- **Legacy cell names**: Early runs used shorthand `cell_1`, later runs use canonical `cell_1_base_single_unified`. Both coexist in the DB. Analysis scripts should match on prefix or use `LIKE 'cell_1%'` when querying across runs.

### Test Directory Convention

- `tests/` — Integration and functional tests for the evaluation system (CLI, runners, stores, analyzers)
- `services/__tests__/` — Unit tests co-located with their service files (evalConfigLoader, learnerRubricEvaluator, learnerTutorInteractionEngine)
- Both directories are included in `npm test` via: `node --test --test-force-exit services/__tests__/*.test.js tests/*.test.js`

### Resuming Incomplete Runs

When a run has empty/failed attempts (`suggestions = '[]'`, NULL `overall_score`):
1. Clean out empty rows first:
   ```bash
   sqlite3 data/evaluations.db "DELETE FROM evaluation_results WHERE run_id = '<runId>' AND overall_score IS NULL AND suggestions = '[]'"
   ```
2. Resume generation (skip-rubric) and judge in parallel:
   ```bash
   node scripts/eval-cli.js resume <runId> --skip-rubric
   node scripts/eval-cli.js evaluate <runId> --force --follow
   ```
- `resume` detects missing attempts from the original run plan and re-runs only those
- `--skip-rubric` generates without judging (matching the typical two-phase workflow)
- `evaluate --force --follow` polls and judges each new row as it lands
- `resume` accepts: `--parallelism N`, `--verbose`, `--force`, `--skip-rubric`

## Scripts Reference

### Core CLI (`scripts/eval-cli.js`)

The primary interface for all evaluation workflows:

```bash
node scripts/eval-cli.js run --profiles <cells> --runs N   # Run evaluation
node scripts/eval-cli.js evaluate <runId> [--force]        # Unified: per-turn tutor + holistic tutor + learner + dialogue quality
node scripts/eval-cli.js evaluate <runId> --tutor-only     # Per-turn tutor scoring only (skip holistic tutor + learner + dialogue)
node scripts/eval-cli.js evaluate-learner <runId>          # Score learner quality (standalone, legacy)
node scripts/eval-cli.js evaluate-dialogue <runId>         # Dialogue quality (standalone, now accepts --scenario/--profile)
node scripts/eval-cli.js rejudge <runId> --judge <model>   # Re-judge (e.g. openrouter.gpt)
node scripts/eval-cli.js resume <runId> [--skip-rubric]    # Resume incomplete run
node scripts/eval-cli.js export <runId> --format csv       # Export results
```

### Statistical Analysis

| Script | Usage |
|--------|-------|
| `analyze-eval-results.js` | ANOVA, effect sizes, marginal means across conditions |
| `analyze-judge-reliability.js` | Inter-judge correlation (requires rejudged paired data) |
| `analyze-mechanism-traces.js <runId>` | Process measures (RevΔ, EgoSpec, AdaptΔ, RunVar) |
| `analyze-eval-costs.js` | Token usage and cost breakdown |
| `analyze-interaction-evals.js` | Bilateral interaction scoring |
| `analyze-modulation-learning.js` | Modulation metrics and learning outcomes |
| `advanced-eval-analysis.js` | Extended multi-turn scenario analysis |
| `compare-transformation.js` | Transformation metrics (adaptation, growth indices) |

### Qualitative Analysis

| Script | Usage |
|--------|-------|
| `assess-transcripts.js <runId>` | AI narrative assessment (`--blinded`, `--force`, `--model`) |
| `qualitative-analysis.js` | Rule-based thematic coding with chi-square tests |
| `qualitative-analysis-ai.js` | LLM-based theme discovery (`--mode classify\|discover`) |
| `code-impasse-strategies.js` | Code dialogues into 5 Hegelian resolution strategies |
| `code-dialectical-modulation.js` | Code superego modulation (structural + semantic) |
| `browse-transcripts.js` | Interactive transcript browser (web UI on localhost) |

### Paper & Validation

| Script | Usage |
|--------|-------|
| `generate-paper-tables.js` | Generate tables + validate prose N-counts against DB |
| `validate-paper-manifest.js` | Level 1 manifest validation (N-counts, stalled runs) |
| `render-sequence-diagram.js` | Render architecture sequence diagrams to HTML/SVG |
| `validate-content.js` | Validate tutorial content packages |

### Utilities

| Script | Usage |
|--------|-------|
| `test-rate-limit.js [model]` | Probe OpenRouter rate limits (default: nemotron) |
| `test-latency.js` | Latency test across all configured models |
| `seed-db.js` | Initialize database with sample data |

## Common Commands

```bash
# Run factorial evaluation
node scripts/eval-cli.js run --profiles cell_1_base_single_unified,cell_5_recog_single_unified --runs 3

# Judge with Claude Opus (default)
node scripts/eval-cli.js evaluate <runId>

# Rejudge with GPT-5.2
node scripts/eval-cli.js rejudge <runId> --judge openrouter.gpt

# Resume incomplete run (generation + judging in parallel)
node scripts/eval-cli.js resume <runId> --skip-rubric
node scripts/eval-cli.js evaluate <runId> --force --follow

# Analyze inter-judge reliability (requires rejudged data)
node scripts/analyze-judge-reliability.js

# Export results
node scripts/eval-cli.js export <runId> --format csv

# Build paper PDF
cd docs/research && ./build.sh full

# Run tests
npm test
```
