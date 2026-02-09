# Contributing

Thanks for your interest in contributing to `@machinespirits/eval`.

## Getting started

```bash
git clone https://github.com/liammagee/machinespirits-eval.git
cd machinespirits-eval
npm install
npm install @machinespirits/tutor-core
```

Seed sample data and verify tests pass:

```bash
npm run seed
npm test
```

## Project layout

- `scripts/eval-cli.js` — main CLI entry point
- `services/` — core evaluation engine, rubric evaluator, learner simulation
- `config/` — YAML configuration for tutor agent cells, scenarios, rubrics, and providers
- `prompts/` — LLM prompt templates
- `tests/` — test suites (Node.js built-in test runner)

## Running evaluations

You need at least one AI provider API key. Copy `.env.example` to `.env` and fill in the relevant keys. Then:

```bash
node scripts/eval-cli.js list          # see available cells and scenarios
node scripts/eval-cli.js run --profiles cell_1_base_single_unified --runs 1
```

## Adding experimental cells

New cells are defined in `config/tutor-agents.yaml`. Each cell maps to a combination of prompt templates from `prompts/` and factor settings (recognition, architecture, learner type). Follow the naming convention `cell_N_<condition>_<architecture>_<learner>`.

## Adding scenarios

Scenarios live in `config/suggestion-scenarios.yaml`. Single-turn scenarios have a `learnerContext` block; multi-turn scenarios add a `turns` array with per-turn learner prompts.

## Code style

- ES modules (`import`/`export`), no CommonJS
- No build step; plain Node.js
- Prefer the Node.js built-in test runner (`node:test`) over external frameworks

## Tests

```bash
npm test
```

Tests use `node --test` with files in `services/__tests__/` and `tests/`. Add new test files following the `*.test.js` naming convention.

## Submitting changes

1. Fork the repository and create a feature branch
2. Make your changes with tests where applicable
3. Run `npm test` to verify nothing is broken
4. Open a pull request against `main`

## Reporting issues

Open an issue at https://github.com/liammagee/machinespirits-eval/issues with:
- What you expected to happen
- What actually happened
- Steps to reproduce (CLI command, scenario, etc.)

## License

By contributing you agree that your contributions will be licensed under the [MIT License](LICENSE).
