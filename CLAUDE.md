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

## Configuration

### Tutor Agent Cells (config/tutor-agents.yaml)

- Cells 1-4: Base (no recognition theory)
- Cells 5-8: Recognition theory enabled
- Cells 9-12: Enhanced prompts (longer, more pedagogical detail)
- Cells 13-14: Hardwired rules (superego rules embedded in ego prompt)
- Cells 15-18: Placebo control (length-matched, no recognition theory)
- Cells 19-20: Memory isolation (recognition vs memory disentangling)
- Cell 21: Dynamic prompt rewriting with Writing Pad
- Cells 22-27: Standard ego + divergent superego (suspicious/adversary/advocate × base/recog)
- Cells 28-33: Dialectical ego + divergent superego
- Cells 34-39: Full-feature dialectical (cross-turn memory, prompt rewriting, learner signals)
- Cells 40-45: Self-reflective evolution (suspicious/adversary/advocate × base/recog)
- Cells 46-47: Quantitative disposition (base/recog)
- Cells 48-49: Prompt erosion (base/recog)
- Cells 50-51: Intersubjective recognition (base/recog)
- Cells 52-53: Combined mechanisms (base/recog)
- Cells 54-59: Other-ego profiling (tutor-only/bidirectional/full-suite/strategy)
- Cells 60-63: Dynamic learner (ego_superego) × self-reflection/profiling × base/recog
- Cells 64-65: Dynamic learner × intersubjective/combined (recognition only)

**Learner architecture**: Cells 1-59 use `learner_architecture: unified` (scripted — learner messages from scenario YAML). Cells 60-65 use `learner_architecture: ego_superego` (dynamic — LLM-generated learner with internal ego-superego deliberation). Mechanism effects only differentiate with dynamic learners.

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

### Important Notes

- CLI model format uses **dot notation**: `openrouter.gpt`, NOT `openrouter/gpt`
- CLI uses `--runs` NOT `--repeats` for runsPerConfig
- Database: `data/evaluations.db` (SQLite)
- DB score column: `overall_score` (NOT `base_score`)
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
node scripts/eval-cli.js evaluate <runId> [--force]        # Judge with Opus
node scripts/eval-cli.js evaluate-learner <runId>          # Score learner quality
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
