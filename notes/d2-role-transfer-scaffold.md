# D2 Role-Transfer Scaffold

Date: 2026-06-24
Branch: `codex/d2-d6-followups`
Status: implementation scaffold created; `.env` copied from the main worktree and loaded via dotenv; empirical run not launched yet.

## What Changed

D2 Path 2 now has a runnable sidecar scaffold:

- Config: `config/d2-role-transfer.yaml`
- Role-fit rubric: `config/evaluation-rubric-d2-role-transfer.yaml`
- Role-native prompts: `prompts/d2/*.md`
- Runner/analyzer: `scripts/run-d2-role-transfer.js`

This is deliberately not wired through the standard `evaluation_results` tutor
pipeline. The normal runner expects tutor course-navigation suggestions; true
D2 asks the model to act directly as a peer-support listener, customer-service
agent, or code reviewer. Forcing those outputs into the tutor v2.2 scorer would
answer the wrong question.

## Frozen Gate

Primary gate stays the surviving TODO threshold:

- Pass: intersubjective/recognition-family arm reaches `d >= 1.0` on at least
  two of three core applications.
- Fail or scope-bound: fewer than two applications clear that threshold.
- Therapy remains excluded from the core gate.
- Mock rows are harness validation only, not evidence.

## No-Cost Validation Run

Validated locally:

```bash
node --check scripts/run-d2-role-transfer.js
node scripts/run-d2-role-transfer.js validate
npx prettier --check scripts/run-d2-role-transfer.js
node scripts/run-d2-role-transfer.js mock --out exports/d2-role-transfer-mock.jsonl --runs 1
node scripts/run-d2-role-transfer.js analyze --in exports/d2-role-transfer-mock.jsonl --out exports/d2-role-transfer-mock-report.md
```

The mock artifacts are ignored generated files. They only prove that the
sidecar can validate, generate row-shaped output, and analyze scored rows.

## Real Run Command

The worktree now has a local `.env` copied from the main checkout and
`scripts/run-d2-role-transfer.js` loads it via dotenv before provider calls.
The empirical run was not launched in this step because it is a paid
generation-plus-three-judge sequence. Once the paid run is explicitly approved,
run:

```bash
node scripts/run-d2-role-transfer.js generate \
  --out exports/d2-role-transfer-v1-raw.jsonl \
  --runs 3 \
  --provider openrouter \
  --model anthropic/claude-haiku-4.5

node scripts/run-d2-role-transfer.js score \
  --in exports/d2-role-transfer-v1-raw.jsonl \
  --out exports/d2-role-transfer-v1-sonnet.jsonl \
  --judge-provider openrouter \
  --judge-model anthropic/claude-sonnet-4.6 \
  --judge-label sonnet

node scripts/run-d2-role-transfer.js score \
  --in exports/d2-role-transfer-v1-sonnet.jsonl \
  --out exports/d2-role-transfer-v1-sonnet-gpt.jsonl \
  --judge-provider openrouter \
  --judge-model openai/gpt-5.2 \
  --judge-label gpt

node scripts/run-d2-role-transfer.js score \
  --in exports/d2-role-transfer-v1-sonnet-gpt.jsonl \
  --out exports/d2-role-transfer-v1-scored.jsonl \
  --judge-provider openrouter \
  --judge-model google/gemini-3-pro-preview \
  --judge-label gemini

node scripts/run-d2-role-transfer.js analyze \
  --in exports/d2-role-transfer-v1-scored.jsonl \
  --out exports/d2-role-transfer-v1-report.md
```

Only the final real report should be folded into Paper 2.0 or a successor paper.
Raw JSONL can be preserved as an export if the run is accepted as evidence.
