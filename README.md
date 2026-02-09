# @machinespirits/eval

Evaluation framework for the Machine Spirits tutor system. Implements a 2x2x2 factorial design testing the effect of Hegelian recognition theory on AI tutoring quality, using LLM-powered ego-superego agent architectures for both tutor and learner.

This is the evaluation and analysis companion to [`@machinespirits/tutor-core`](https://github.com/liammagee/machinespirits-tutor-core).

## Overview

The system runs automated tutoring dialogues across configurable experimental cells, then scores them with LLM judges against a multi-dimensional rubric. It supports:

- **Factorial evaluation** — 21 tutor agent cells varying recognition theory, architecture (single-agent vs ego+superego), and learner type
- **Multi-turn dialogues** — Learner agents with their own ego-superego deliberation
- **Multi-judge validation** — Cross-judge reliability via Claude Opus, GPT-5.2, and others
- **Placebo/active controls** — Length-matched prompts without recognition theory
- **Memory isolation** — Disentangling recognition effects from conversational memory

## Prerequisites

- **Node.js** >= 18.0.0
- **@machinespirits/tutor-core** 0.3.1 (peer dependency)
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
content-test-elementary/   Bundled test content package
docs/                      Documentation and research paper
tests/                     Test suites
```

### Key configuration files

- `config/tutor-agents.yaml` — All 21 experimental cells and their prompt mappings
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

Additional cells test enhanced prompts (9-12), hardwired rules (13-14), placebo controls (15-18), memory isolation (19-20), and dynamic prompt rewriting (21).

## Research Paper

The full research paper is included at `docs/research/PAPER-FULL-2026-02-04.md`. For replication instructions, see `docs/REPLICATION-PLAN.md`.

## Running Tests

```bash
npm test
```

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
