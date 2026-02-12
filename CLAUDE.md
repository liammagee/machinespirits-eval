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

# Run tests
npm test
```
