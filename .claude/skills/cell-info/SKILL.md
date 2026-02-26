---
name: cell-info
description: Look up a cell's architecture by reading tutor-agents.yaml — never guess, always check
argument-hint: "<cell name or number, e.g. cell_5 or 90>"
allowed-tools: Bash, Read, Grep
---

Look up the architecture of cell `$ARGUMENTS` by reading the YAML configuration.

**RULE: Never guess a cell's architecture. Always read the YAML.**

## Steps

1. **Find the cell** in the YAML config:
   ```bash
   grep -n "cell_$ARGUMENTS\|^  cell_.*$ARGUMENTS" config/tutor-agents.yaml | head -5
   ```
   If the argument is a full cell name (e.g. `cell_5_recog_single_unified`), grep for that directly.
   If it's just a number (e.g. `5`), grep for `cell_5`.

2. **Read the cell's YAML block** — from its header line through to the next cell header. Read generously (100+ lines) to capture all nested fields:
   ```
   Read config/tutor-agents.yaml from the cell's line number, ~120 lines
   ```

3. **Extract and report these architecture fields**:

   | Field | What it tells you |
   |-------|------------------|
   | `factors.multi_agent_tutor` | Whether tutor has ego+superego deliberation loop |
   | `superego:` block | `null` = no superego agent; configured = superego present |
   | `learner_architecture:` | `unified*` = scripted learner; `ego_superego*` = LLM-powered learner |
   | `factors.prompt_type:` | base, recognition, enhanced, placebo, dialectical_*, naive |
   | `conversation_mode:` | absent = single-prompt; `messages` = multi-turn message chain |
   | `dialogue.enabled:` | Whether ego-superego deliberation loop is active |
   | `recognition_mode:` | Whether Hegelian recognition theory is in prompts |
   | `ego.model` | Tutor ego model reference |
   | `superego.model` | Tutor superego model reference (if superego configured) |
   | `ego.max_tokens` | Token budget for ego generation |
   | `mechanisms:` | Special mechanism blocks (self_reflection, profiling, etc.) |

4. **Summarize in plain language**:
   - "Cell X is a [base/recognition] [single-agent/multi-agent] tutor with [unified/ego_superego] learner"
   - Whether it has a superego agent (check `superego:` is not null AND `multi_agent_tutor: true`)
   - What mechanisms are active
   - What models are configured
   - Which factor group it belongs to (1-8: factorial, 9-20: ablations, 22-33: divergent, 40-59: mechanisms unified, 60-79: mechanisms dynamic, 80-90: messages-mode)

## Key relationships
- `multi_agent_tutor: false` + `superego: null` = single-agent tutor (ego only)
- `multi_agent_tutor: true` + `superego: null` = tutor has self-reflection/profiling but no superego agent
- `multi_agent_tutor: true` + `superego:` configured = tutor has distinct superego agent
- `learner_architecture: unified*` = scripted learner (messages from scenario YAML)
- `learner_architecture: ego_superego*` = full LLM learner with internal deliberation

## Superego presence (quick reference)
Cells with configured superego: 3-4, 7-8, 11-12, 17-18, 22-33, 82-83, 86-89.
ALL other cells have `superego: null`.
