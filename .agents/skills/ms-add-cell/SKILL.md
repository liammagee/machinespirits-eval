---
name: ms-add-cell
description: Add a new cell to config/tutor-agents.yaml following the cell-discipline rules in AGENTS.md, then validate derived registration, naming, dispatch, and smoke behavior. Use when the user wants to add a new factorial cell.
---

Add a new cell to the factorial in `config/tutor-agents.yaml` without falling into the silent-default-profile-fallback trap. Every step below maps to a rule documented in AGENTS.md's "How to Read a Cell's Architecture" and "Adding New Cells" sections.

## Steps

### 1. Pick a free cell ID

The cell-ID-allocation discipline is: **always grep `config/tutor-agents.yaml` before assuming an ID is free**. Do not infer from the highest documented number in AGENTS.md.

```bash
rg -n '^  cell_[0-9]+_[^:]+:$' config/tutor-agents.yaml
```

Pick the next unused integer. If the user has proposed a specific ID, confirm it is free:

```bash
rg -n '^  cell_<N>_[^:]+:$' config/tutor-agents.yaml
```

No match means the numeric ID is free. One or more matches means it is occupied;
do not interpret a failed command through a shell `|| echo` shortcut.

### 2. Decide the cell's architecture

Cross-reference the architecture table from AGENTS.md and the nearest current
cell before writing. Ask only if the requested architecture leaves a material
factor ambiguous:

| `multi_agent_tutor` | `superego:` | Implication |
|---|---|---|
| `false` | `null` | single-agent tutor (ego only) |
| `true` | `null` | self-reflection / profiling but no separate superego agent |
| `true` | configured block | distinct superego agent |
| `false` | configured block | **INVALID** — do not write |

Other knobs to nail down by reading the current schema and the nearest cell:
- `factors.prompt_type` — use a value already supported by current dispatch,
  or add and test that dispatch as part of the requested cell change
- `learner_architecture` — `unified*` (scripted) vs `ego_superego*` (LLM with internal deliberation)
- `conversation_mode` — omit for single-prompt, `messages` for multi-turn
- `dialogue.enabled` — controls ego-superego deliberation loop
- `recognition_mode` — Hegelian recognition theory in prompts
- `runner` — omit / `standard` for the default runner, `adaptive` for the
  LangGraph adaptive runner
- `factors.id_director` — read the neighboring current family rather than
  relying on a historical numeric range

### 3. Name the cell

Cell-name convention: `cell_<N>_<arch-summary>`. The arch summary should encode the key knobs (e.g. `cell_5_recog_single_unified`, `cell_82_base_multi_psycho_messages`).

**Test-enforced rule**: a cell using `prompt_type: dialectical_suspicious` MUST have `dialectical` in its name. Conversely, do not put `dialectical` in the name of a cell that does not use `prompt_type: dialectical_suspicious`.

### 4. Write the YAML entry

Find the current related family directly in the YAML and read a nearby cell of
similar architecture as a template. Do not rely on historical numeric ranges
in prose:

```bash
rg -n '^  cell_<NEAREST_NEIGHBOR>_[^:]+:$' config/tutor-agents.yaml
```

Edit `config/tutor-agents.yaml` and add the new block. A user request to add the
cell authorizes this edit; do not pause for a second confirmation.

### 5. Validate derived registration

Canonical `cell_*` names are derived directly from `config/tutor-agents.yaml` by
`services/evalProfileRegistry.js`. Do not edit `EVAL_ONLY_PROFILES`; it is a
compatibility export assembled from the derived cells plus explicit legacy
aliases. Validate the registry and prompt dispatch instead:

```bash
cell_config_dir="$(mktemp -d -t machinespirits-cell-config.XXXXXX)"
EVAL_DB_PATH="$cell_config_dir/evaluations.db" \
EVAL_LOGS_DIR="$cell_config_dir/logs" \
  node scripts/eval-cli.js validate-config
```

The CLI initializes its evaluation store before validation, so hermetic paths
prevent a config check from migrating or depending on the production DB.

### 6. Reference a valid scenario source

- If `runner: adaptive`: scenarios live in `config/adaptive-trap-scenarios.yaml` or `config/cross-suite-trap-scenarios.yaml`.
- Otherwise: scenarios live in `config/suggestion-scenarios.yaml`.

Read the new cell's exact block, resolve any `scenario_source` or runner-specific
reference it contains, and validate that source with the existing config and
focused runner checks. Do not search the whole YAML for an unrelated
`scenario:` string.

### 7. Run the focused tests

```bash
node --test tests/evaluationRunner.test.js tests/regression-bug-007.test.js tests/factorial-design.test.js
```

### 8. Smoke the new cell with no paid API calls

Use the hermetic test harness and / or the smoke script for the runner type:

For adaptive cells:
```bash
ADAPTIVE_TUTOR_LLM=mock node scripts/run-adaptive-cell-smoke.js
```

For standard cells, run a tiny eval with `--dry-run`:
```bash
cell_smoke_dir="$(mktemp -d -t machinespirits-cell-smoke.XXXXXX)"
EVAL_DB_PATH="$cell_smoke_dir/evaluations.db" \
EVAL_LOGS_DIR="$cell_smoke_dir/logs" \
  node scripts/eval-cli.js run --profiles cell_<N>_<name> --runs 1 --dry-run
```

The hermetic paths are required because `--dry-run` changes model execution to
mock data but still writes run/results state. For adaptive cells, prefer the
dedicated mock smoke scripts above.

### 9. Audit before committing

If the `cell-config-auditor` role is available, ask it to audit the new entry
and derived registration. Otherwise perform the same checks directly and say
that the specialized reviewer was unavailable. Do not paste provider-specific
agent invocation syntax into the workflow.

## Critical rules

- **Register canonical cells only in `config/tutor-agents.yaml`.** Never add a
  second manual list; `validate-config` must prove derived registration and
  prompt dispatch.
- **Never invent a cell ID without grepping** — the highest documented number in AGENTS.md lags behind reality.
- **Never use `dialectical` in the name for a non-dialectical-suspicious cell** — the test will fail.
- **Never `--force` resume a run on a cell that ran under the wrong profile**; clean up first, then re-run.
- Once the user has asked to add the cell, ask again only for unresolved
  architecture or paid-run choices, not for each file edit.
