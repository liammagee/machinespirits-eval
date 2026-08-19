---
name: ms-add-cell
description: Add a new cell to config/tutor-agents.yaml following the cell-discipline rules in CLAUDE.md, then validate derived registration, naming, dispatch, and smoke behavior. Use when the user wants to add a new factorial cell.
argument-hint: "<cell-name-suffix> <architecture-knobs>"
---

Add a new cell to the factorial in `config/tutor-agents.yaml` without falling into the silent-default-profile-fallback trap. Every step below maps to a rule documented in CLAUDE.md's "How to Read a Cell's Architecture" and "Adding New Cells" sections.

## Steps

### 1. Pick a free cell ID

The cell-ID-allocation discipline is: **always grep `config/tutor-agents.yaml` before assuming an ID is free**. Do not infer from the highest documented number in CLAUDE.md.

```bash
grep -nE '^\s*-?\s*name:\s*cell_[0-9]+' config/tutor-agents.yaml | sort -t_ -k2 -n | tail -10
```

Pick the next unused integer. If the user has proposed a specific ID, confirm it is free:

```bash
grep -nE "name:\s*cell_<N>_" config/tutor-agents.yaml || echo "cell_<N>_ is free"
```

### 2. Decide the cell's architecture

Cross-reference the architecture table from CLAUDE.md and the nearest current
cell before writing. Ask only if the requested architecture leaves a material
factor ambiguous:

| `multi_agent_tutor` | `superego:` | Implication |
|---|---|---|
| `false` | `null` | single-agent tutor (ego only) |
| `true` | `null` | self-reflection / profiling but no separate superego agent |
| `true` | configured block | distinct superego agent |
| `false` | configured block | **INVALID** — do not write |

Other knobs to nail down:
- `factors.prompt_type` — `base | recognition | enhanced | placebo | dialectical_suspicious | naive`
- `learner_architecture` — `unified*` (scripted) vs `ego_superego*` (LLM with internal deliberation)
- `conversation_mode` — omit for single-prompt, `messages` for multi-turn
- `dialogue.enabled` — controls ego-superego deliberation loop
- `recognition_mode` — Hegelian recognition theory in prompts
- `runner` — omit / `standard` for the default runner, `adaptive` for the LangGraph adaptive runner (cells 110+)
- `factors.id_director` — `true` for the charisma id-director family (cells 101-109)

### 3. Name the cell

Cell-name convention: `cell_<N>_<arch-summary>`. The arch summary should encode the key knobs (e.g. `cell_5_recog_single_unified`, `cell_82_base_multi_psycho_messages`).

**Test-enforced rule**: a cell using `prompt_type: dialectical_suspicious` MUST have `dialectical` in its name. Conversely, do not put `dialectical` in the name of a cell that does not use `prompt_type: dialectical_suspicious`.

### 4. Write the YAML entry

Find the right insertion point — keep related cells contiguous (e.g. cell-family blocks 1-8, 9-20, 22-33, 80-92, etc. from CLAUDE.md). Read a nearby cell of similar architecture as a template:

```bash
grep -nE "name:\s*cell_<NEAREST_NEIGHBOR>_" config/tutor-agents.yaml
```

Edit `config/tutor-agents.yaml` and add the new block. A user request to add the
cell authorizes this edit; do not pause for a second confirmation.

### 5. Validate derived registration

Canonical `cell_*` names are derived directly from `config/tutor-agents.yaml` by
`services/evalProfileRegistry.js`. Do not edit `EVAL_ONLY_PROFILES`; it is a
compatibility export assembled from the derived cells plus explicit legacy
aliases. Validate the registry and prompt dispatch instead:

```bash
node scripts/eval-cli.js validate-config
```

### 6. Reference a valid scenario

- If `runner: adaptive`: scenarios live in `config/adaptive-trap-scenarios.yaml` or `config/cross-suite-trap-scenarios.yaml`.
- Otherwise: scenarios live in `config/suggestion-scenarios.yaml`.

Verify the scenario IDs the cell references actually exist:

```bash
grep -nE "scenario:|scenarios:" config/tutor-agents.yaml | grep -A2 "cell_<N>_"
```

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
node scripts/eval-cli.js run --profiles cell_<N>_<name> --runs 1 --dry-run
```

NOTE: `--dry-run` on adaptive cells writes the prod DB (only `llmMode=mock` changes); for true zero-DB validation on adaptive cells use the smoke scripts above.

### 9. Audit before committing

Run the registered `cell-config-auditor` on the diff. It is a read-only,
cell-specific check required by CLAUDE.md; do not add a broader review loop:

```text
Agent({ subagent_type: "cell-config-auditor", prompt: "Audit the new cell_<N>_<name> entry in config/tutor-agents.yaml and its EVAL_ONLY_PROFILES registration" })
```

## Critical rules

- **Register canonical cells only in `config/tutor-agents.yaml`.** Never add a
  second manual list; `validate-config` must prove derived registration and
  prompt dispatch.
- **Never invent a cell ID without grepping** — the highest documented number in CLAUDE.md lags behind reality.
- **Never use `dialectical` in the name for a non-dialectical-suspicious cell** — the test will fail.
- **Never `--force` resume a run on a cell that ran under the wrong profile**; clean up first, then re-run.
- Once the user has asked to add the cell, ask again only for unresolved
  architecture or paid-run choices, not for each file edit.
