# @machinespirits/eval

Evaluation framework for the Machine Spirits tutor system. It tests how prompt orientation, ego/superego architecture, learner simulation, and explicit state-policy control change AI tutor behaviour.

The tutor engine formerly published as `@machinespirits/tutor-core` is now
in-housed under [`tutor-core/`](tutor-core/), so engine, evaluation, and prompt
changes are versioned and tested together.

## Overview

The system runs automated tutoring dialogues across configurable experimental cells, then scores them with LLM judges against a multi-dimensional rubric. It supports:

- **Mechanism evaluation** — 190+ registered tutor cells varying recognition theory, architecture, learner type, prompt family, id-director variants, and state-policy control
- **Multi-turn dialogues** — Learner agents with their own ego-superego deliberation
- **Multi-judge validation** — Cross-judge scoring with Sonnet, Gemini, GPT/OpenAI-family, and CLI-backed judges
- **Placebo/active controls** — Length-matched prompts without recognition theory
- **State-governance tests** — Adaptive trap suites, yoked contingency probes, and proof-debt guarded derivation worlds

## Prerequisites

- **Node.js** >= 20.0.0
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

## Configuration

Copy the example environment file and add your API keys:

```bash
cp .env.example .env
```

**Required**: At least `OPENROUTER_API_KEY` for ego/superego model generation.

**For judging**: use the configured default judge, `--judge <provider.alias>`, or `--judge-cli <claude|gemini|codex>` for local CLI-backed scoring.

See `.env.example` for all available configuration options.

Optionally, seed the database with sample data to explore the CLI:

```bash
npm run seed
```

## Usage

### Tutor-stub super app

Tutor-stub is the interactive tutoring workbench: play the learner, coach the
tutor privately, let an automated learner continue, switch scenarios and
profiles, use proof-DAG or curriculum modes, speak through the voice companion,
and inspect the resulting analysis, traces, transcript, replay, and learning
summary.

```bash
# No model call: browse capabilities and practical entry points
npm run tutor:stub -- --features

# Full interactive scaffold with optional AI learner drafts
npm run tutor:stub:scaffold:mixed

# Guided tour, or reflective tutoring over a live workplan module
npm run tutor:stub:demo
npm run tutor:stub:workplan -- --module <workplan-item-id>
```

See [the terminal guide](docs/tutor-stub-cli.md) for themes, voice, settings,
commands, saved scenarios, and compatibility details. Inside a session, type
`/` to filter commands, `/features` for the capability map, or `/help` for
command groups.

### CLI (primary interface)

```bash
# Show available cells, scenarios, and providers
node scripts/eval-cli.js

# Run a factorial evaluation
node scripts/eval-cli.js run \
  --profiles cell_1_base_single_unified,cell_5_recog_single_unified \
  --runs 3

# Score responses with the configured default judge
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
PLAN_2_0/                  Closed Plan 2.x designs, preregistrations, and closeout ledgers
workplan/                  Live project board; edit items, not generated board views
tests/                     Test suites
```

Planning note: `workplan/items/` is the live todo source of truth. `PLAN_2_0/`
is a closed evidence archive, and root-level `*-PLAN.md` files are planning and
evidence ledgers unless a matching workplan item makes the work live. Start with
`PLAN_2_0/README.md` for the Plan 2.x archive map.

### Ref and version governance

Repository releases, paper checkpoints, experiment freezes/results, and
archived branch snapshots use separate annotated-tag namespaces. See the
[tagging and version protocol](docs/tagging-and-version-protocol.md) and the
generated [ref/version status](docs/ref-status.md). Refresh the inventory with
`git fetch --all --tags --prune && npm run refs:render`; validate it with
`npm run refs:check`.

### Key configuration files

- `config/tutor-agents.yaml` — Experimental cells and their prompt / runner mappings
- `config/suggestion-scenarios.yaml` — Learner scenarios (single-turn and multi-turn)
- `config/evaluation-rubric.yaml` — Tutor rubric (v2.2, 8 dimensions); see also `config/rubrics/v{1.0,2.0,2.1,2.2}/` for versioned rubrics
- `config/providers.yaml` — AI provider and model configuration

## Experimental Design

The core factorial design crosses three factors:

| Factor | Levels |
|--------|--------|
| A: Recognition theory | Base vs Recognition |
| B: Tutor architecture | Single-agent vs Ego+Superego |
| C: Learner architecture | Single-agent vs Multi-agent |

Additional cells test enhanced prompts, hardwired rules, placebo controls, memory isolation, dynamic prompt rewriting, dialectical superego modulation, self-reflective evolution, insight-action mechanisms, other-ego profiling, dynamic learner mechanisms, messages-mode variants, pedagogical-orientation density controls, id-director charisma variants, adaptive trap runners, and Plan 2.x state-policy / proof-debt variants. See `config/tutor-agents.yaml` for the canonical mapping; new cells should be cross-referenced with `services/evaluationRunner.js::EVAL_ONLY_PROFILES` and the `resolveEvalProfile` dispatch.

## How to Build an AI Tutor

The current Paper 2.0 result is not "use a longer prompt" or "always add more agents." The build lesson is a layered architecture:

1. **Start with an intersubjective prompt orientation.** Recognition theory is one explicit vocabulary, but matched constructivist prompts grounded in Vygotsky/Piaget-style scaffolding reproduce the effect. The prompt must make the learner's contribution shape the next tutor move.
2. **Use ego/superego critique selectively.** A second critique-and-revision voice is valuable under baseline or weaker generation, but recognition-oriented prompts substitute for much of that error correction on stronger models.
3. **Do not count on within-dialogue slope magic.** Recognition improves tutor output from turn one; it does not reliably make quality climb over a 3-5 turn dialogue.
4. **If adaptivity matters, externalise state and policy.** The later state-policy results work by typed learner-state contracts, outcome closure, and explicit strategy-shift checks, not by asking the tutor to "be more adaptive."
5. **For proof-like tutoring, put pacing outside the model.** The promoted derivation arm uses hidden `proofDebt` plus a guard that controls premise release. Visible-transcript proxies only work when the task geometry makes visible uptake faithfully project hidden proof state.
6. **Evaluate the tutor, not just the prompt.** Use matched-specificity controls, multiple judges, per-turn traces, rubric-versioned storage, and human validation before claiming learning outcomes. Current paper claims concern tutor output quality with synthetic learners, not confirmed human learning.

## Reproducing Paper Findings

The canonical research paper is `docs/research/paper-full-2.0.md`; legacy Paper 1.0 remains at `docs/research/paper-full.md`. Public app-facing explainers live under `public/eval/`, especially `public/eval/geist-explained.html` and `public/eval/geist-in-the-machine.html`.

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
| `/ms-analyze-run <runId>` | Pull scores from DB, compute means, effect sizes, flag issues |
| `/ms-check-models [alias]` | Probe OpenRouter rate limits and availability |
| `/ms-build-paper` | Build paper PDF, check citations and cross-references |
| `/ms-run-eval <cells> --runs N` | Full generation + judging pipeline with pre-flight checks |
| `/ms-query-db <question>` | Natural language query against the evaluation database |

Skills with a `description` field (`ms-analyze-run`, `ms-check-models`, `ms-query-db`) can also be invoked automatically by Claude when relevant to the conversation. `/ms-run-eval` requires explicit invocation since it consumes API credits.

## Running Tests

```bash
npm test                   # root Node suites, then in-housed tutor-core Vitest suites
npm run test:root          # root Node suites only
npm run test:core          # in-housed tutor-core suites only
npm run test:root:handles  # root suites without forced exit, for handle-leak audits
npm run test:coverage:risk # hermetic risk-group coverage with ratcheted floors (Node 22.10+)
```

These commands use isolated temporary database, log, export, writing-pad,
and tutor-stub paths. The legacy root suite still uses Node's forced-exit mode
while its open-handle debt is audited; the in-housed core suite always tears
down naturally. Risk coverage also uses natural teardown, writes LCOV, JSON,
and Markdown under ignored `coverage/risk/`, and checks the versioned floors in
`config/coverage-risk-floors.json` for store, admin/auth, evaluator provenance,
browser labelling save-state, and tutor-core recognition/memory surfaces.

## Known Deferred Risks

This repository currently accepts a small set of known risks because it is run as an internal localhost-only evaluation system.

See `notes/known-risks-localhost-2026-02-13.md` for the tracked risk register, acceptance scope, and hardening triggers required before broader deployment.

## Citation

If you use this software in your research, please cite:

```bibtex
@misc{magee2026machinespirits,
  author = {Magee, Liam},
  title = {\textit{Geist} in the Machine: Recognition Theory and Multi-Agent Tutoring},
  year = {2026},
  url = {https://github.com/liammagee/machinespirits-eval}
}
```

## License

[MIT](LICENSE)
