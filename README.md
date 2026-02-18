# @machinespirits/eval

Evaluation framework for the Machine Spirits tutor system. Implements a 2x2x2 factorial design testing the effect of Hegelian recognition theory on AI tutoring quality, using LLM-powered ego-superego agent architectures for both tutor and learner.

This is the evaluation and analysis companion to [`@machinespirits/tutor-core`](https://github.com/liammagee/machinespirits-tutor-core).

## Overview

The system runs automated tutoring dialogues across configurable experimental cells, then scores them with LLM judges against a multi-dimensional rubric. It supports:

- **Factorial evaluation** — 70 tutor agent cells varying recognition theory, architecture, learner type, and mechanism design
- **Multi-turn dialogues** — Learner agents with their own ego-superego deliberation
- **Multi-judge validation** — Cross-judge reliability via Claude Opus, GPT-5.2, and others
- **Placebo/active controls** — Length-matched prompts without recognition theory
- **Memory isolation** — Disentangling recognition effects from conversational memory

## Prerequisites

- **Node.js** >= 18.0.0
- **@machinespirits/tutor-core** >= 0.3.1 (peer dependency)
- At least one AI provider API key (see below)

## Installation

```bash
npm install @machinespirits/eval
```

Or clone and install locally:

```bash
git clone https://github.com/liammagee/machinespirits-eval.git
cd machinespirits-eval
npm install
```

You will also need `@machinespirits/tutor-core` installed as a peer dependency:

```bash
npm install @machinespirits/tutor-core
```

## Configuration

Copy the example environment file and add your API keys:

```bash
cp .env.example .env
```

**Required**: At least `OPENROUTER_API_KEY` for ego/superego model generation.

**For judging**: `ANTHROPIC_API_KEY` (for Claude Opus judge) or use OpenRouter-based judges.

See `.env.example` for all available configuration options.

Optionally, seed the database with sample data to explore the CLI:

```bash
npm run seed
```

## Usage

### CLI (primary interface)

```bash
# Show available cells, scenarios, and providers
node scripts/eval-cli.js

# Run a factorial evaluation
node scripts/eval-cli.js run \
  --profiles cell_1_base_single_unified,cell_5_recog_single_unified \
  --runs 3

# Score responses with the default judge (Claude Opus)
node scripts/eval-cli.js evaluate <run-id>

# Re-score with a different judge
node scripts/eval-cli.js rejudge <run-id> --judge openrouter.gpt

# Generate a report
node scripts/eval-cli.js report <run-id>

# Export results as CSV
node scripts/eval-cli.js export <run-id> --format csv
```

### Dry-run mode (no API keys required)

Verify the full pipeline without API calls:

```bash
node scripts/eval-cli.js quick --dry-run
node scripts/eval-cli.js run --dry-run --runs 2
node scripts/eval-cli.js run --dry-run --runs 3 --scenario new_user_first_visit
```

Dry-run uses deterministic mock data that mirrors real score distributions (recognition cells ~85-92, base cells ~72-82). All downstream steps (DB storage, ANOVA, reporting) work normally on the mock data.

### Standalone server

```bash
npm start
```

Starts an Express server on port 8081 (configurable via `PORT` env var) with evaluation API endpoints.

### As an npm package

```javascript
import { evaluationRunner, evaluationStore, rubricEvaluator } from '@machinespirits/eval';
```

## Project Structure

```
config/                    YAML configuration (tutor agents, scenarios, rubrics, providers)
prompts/                   LLM prompt templates (ego, superego, recognition, placebo)
scripts/                   CLI tools and analysis scripts
services/                  Core evaluation engine, rubric evaluator, learner simulation
routes/                    Express API routes (optional server mode)
data/                      SQLite databases (evaluation results, writing pads)
content/                   Bundled course content (philosophy 479)
content-test-elementary/   Bundled test content (elementary 101)
notebooks/                 Reproducibility notebook (Jupyter)
docs/research/             Research paper and build scripts
tests/                     Test suites
```

### Key configuration files

- `config/tutor-agents.yaml` — All 70 experimental cells and their prompt mappings
- `config/suggestion-scenarios.yaml` — Learner scenarios (single-turn and multi-turn)
- `config/evaluation-rubric.yaml` — Scoring rubric (6 dimensions)
- `config/providers.yaml` — AI provider and model configuration

## Experimental Design

The core factorial design crosses three factors:

| Factor | Levels |
|--------|--------|
| A: Recognition theory | Base vs Recognition |
| B: Tutor architecture | Single-agent vs Ego+Superego |
| C: Learner architecture | Single-agent vs Multi-agent |

Additional cells test enhanced prompts (9-12), hardwired rules (13-14), placebo controls (15-18), memory isolation (19-20), dynamic prompt rewriting (21), dialectical superego modulation (22-39), self-reflective evolution (40-45), insight-action mechanisms (46-53), other-ego profiling (54-59), and dynamic learner mechanism testing (60-70).

## Reproducing Paper Findings

The full research paper is at `docs/research/paper-full.md`. A Jupyter notebook in `notebooks/` independently reproduces all 17 tables and key statistical findings.

The evaluation dataset (database + dialogue logs, ~19 MB) is available as a [GitHub Release artifact](https://github.com/liammagee/machinespirits-eval/releases/tag/v0.2.0). See `notebooks/README.md` for setup instructions.

To re-run evaluations from scratch (rather than reproducing from saved data), expect ~$65–90 USD in API costs and 48–72 hours wall-clock time. See the CLI help (`node scripts/eval-cli.js --help`) for details on running cells, judging, and exporting results.

## Scripts Reference

### Analysis

| Script | Description |
|--------|-------------|
| `analyze-eval-results.js` | Statistical analysis (ANOVA, effect sizes, marginal means) |
| `analyze-judge-reliability.js` | Inter-judge reliability (requires rejudged data) |
| `analyze-mechanism-traces.js <runId>` | Process trace analysis for mechanism comparison runs |
| `analyze-eval-costs.js` | Cost breakdown across runs |
| `analyze-interaction-evals.js` | Interaction evaluation results |
| `analyze-modulation-learning.js` | Modulation metrics and learning outcomes |
| `advanced-eval-analysis.js` | Extended multi-turn scenario analysis |
| `compare-transformation.js` | Transformation metrics (adaptation, growth indices) |

### Qualitative

| Script | Description |
|--------|-------------|
| `assess-transcripts.js <runId>` | Qualitative transcript assessment (`--blinded`, `--force`) |
| `browse-transcripts.js` | Interactive transcript browser (terminal UI) |
| `qualitative-analysis-ai.js` | AI-based thematic analysis of transcripts |
| `code-impasse-strategies.js` | Code impasse dialogues into Hegelian resolution strategies |
| `code-dialectical-modulation.js` | Code superego modulation patterns |

### Paper & Validation

| Script | Description |
|--------|-------------|
| `generate-paper-tables.js` | Generate tables and validate prose against DB |
| `validate-paper-manifest.js` | Validate paper claims against evaluation data |
| `render-sequence-diagram.js` | Render architecture sequence diagrams |
| `validate-content.js` | Validate tutorial content files |

### Utilities

| Script | Description |
|--------|-------------|
| `test-rate-limit.js [model]` | Probe OpenRouter rate limits (default: nemotron) |
| `test-latency.js` | Latency test across all configured models |
| `seed-db.js` | Initialize/seed the SQLite database |

All scripts are in `scripts/` and run with `node scripts/<name>`.

## Claude Code Skills

This project includes [Claude Code skills](https://docs.anthropic.com/en/docs/claude-code/skills) (`.claude/skills/`) that encode common evaluation workflows as slash commands. In any Claude Code session:

| Command | What it does |
|---------|-------------|
| `/analyze-run <runId>` | Pull scores from DB, compute means, effect sizes, flag issues |
| `/check-models [alias]` | Probe OpenRouter rate limits and availability |
| `/build-paper` | Build paper PDF, check citations and cross-references |
| `/run-eval <cells> --runs N` | Full generation + judging pipeline with pre-flight checks |
| `/query-db <question>` | Natural language query against the evaluation database |

Skills with a `description` field (`analyze-run`, `check-models`, `query-db`) can also be invoked automatically by Claude when relevant to the conversation. `/run-eval` requires explicit invocation since it consumes API credits.

## Running Tests

```bash
npm test
```

## Known Deferred Risks

This repository currently accepts a small set of known risks because it is run as an internal localhost-only evaluation system.

See `notes/known-risks-localhost-2026-02-13.md` for the tracked risk register, acceptance scope, and hardening triggers required before broader deployment.

## Citation

If you use this software in your research, please cite:

```bibtex
@misc{magee2026machinespirits,
  author = {Magee, Liam},
  title = {The Drama Machine in Education: Recognition Theory and Multi-Agent Tutoring},
  year = {2026},
  url = {https://github.com/liammagee/machinespirits-eval}
}
```

## License

[MIT](LICENSE)
