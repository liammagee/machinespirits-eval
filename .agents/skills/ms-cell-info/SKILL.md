---
name: ms-cell-info
description: Look up one evaluation cell's current architecture from config/tutor-agents.yaml. Use when the user names a cell or number; require one exact mapping-key match and report only fields present in that live profile.
---

Look up the architecture of the cell named or numbered by the user by reading
the YAML configuration.

**RULE: Never guess a cell's architecture. Always read the YAML.**

## Steps

1. **Find the cell** in the YAML config:
   ```bash
   rg -n '^  cell_<number>_[^:]+:$|^  <full-cell-name>:$' config/tutor-agents.yaml
   ```
   If the user supplied only a number, require exactly one matching mapping key.
   If zero or multiple profiles match, stop and resolve the ambiguity rather
   than selecting by prefix.

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
   - Its current family or purpose only when the YAML comments or linked design
     identify it; do not infer a family from the number

## Key relationships
- `multi_agent_tutor: false` + `superego: null` = single-agent tutor (ego only)
- `multi_agent_tutor: true` + `superego: null` = tutor has self-reflection/profiling but no superego agent
- `multi_agent_tutor: true` + `superego:` configured = tutor has distinct superego agent
- `learner_architecture: unified*` = scripted learner (messages from scenario YAML)
- `learner_architecture: ego_superego*` = full LLM learner with internal deliberation
