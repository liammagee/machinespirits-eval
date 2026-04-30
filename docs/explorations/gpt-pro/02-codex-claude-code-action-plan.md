# Concrete Codex and Claude Code action plan

Generated: 2026-04-30  
Purpose: Convert the adaptive-recognition and tutor-side psyche ideas into bounded implementation tasks for Codex and Claude Code.

## 1. Operating principle

Every task should answer one of four questions:

```text
1. Did the learner's turn change the tutor's state?
2. Did the changed state select a different pedagogical action?
3. Did the action show up in the tutor's response?
4. Did the learner or task outcome improve afterward?
```

Anything else risks becoming another large, expensive, low-diagnostic ablation extension.

## 2. Tool division of labor

### Use Codex for

- bounded code edits;
- schemas and validators;
- pure functions;
- unit tests;
- CLI scripts with narrow acceptance criteria;
- refactors that should not require broad theoretical judgment.

Codex tasks should be one PR each, with explicit files, tests, and non-goals.

### Use Claude Code for

- translating theory into scenario design;
- repo-aware integration planning;
- creating project slash commands;
- defining subagents;
- paper-delta analysis;
- eval design review before paid model calls;
- claim auditing and anti-overclaiming.

Claude Code tasks should use specialized subagents where possible: `adaptive-architect`, `eval-minimalist`, and `claim-superego`.

## 3. Implementation tracks

### Track A: Adaptive architecture skeleton

**Owner:** Codex  
**Goal:** add the new adaptive path without touching existing paper reproduction logic.

Prompt:

```text
You are working in machinespirits-eval.

Goal:
Implement a new adaptive tutoring experiment path that does not alter existing cells or paper reproduction logic.

Add a new module:
  services/adaptiveTutor/

It should contain:
  stateSchema.js
  stateUpdater.js
  policySelector.js
  adaptiveTutorRunner.js
  validators.js

Requirements:
1. Define a structured learner/tutor state object with:
   - concept_mastery
   - current_misconception
   - affective_state
   - agency_signal
   - relation_state
   - unresolved_contradiction
   - previous_tutor_hypothesis
   - updated_tutor_hypothesis
   - prediction_error
   - required_strategy_shift
   - chosen_pedagogical_action

2. Add a pure function:
   updateAdaptiveState(previousState, learnerTurn, tutorTurn, taskResult?)

3. Add a pure function:
   selectPedagogicalAction(stateDelta)

4. Add tests for:
   - resistance signal changes action to challenge_assumption or scope_test
   - affective shutdown changes action to repair_or_lower_load
   - unexpected learner sophistication changes action away from explanation
   - repeated failure changes action to diagnostic_microtask

Do not call external LLM APIs yet.
Do not modify existing evaluationRunner behavior.
Create unit tests only.
```

Acceptance:

```bash
npm test -- adaptiveTutor
```

### Track B: Policy action taxonomy

**Owner:** Codex  
**Goal:** make pedagogical action explicit and enumerable.

Prompt:

```text
Add a policy action taxonomy.

Create:
  config/adaptive-policy-actions.yaml

Actions:
  ask_diagnostic_question
  mirror_and_extend
  offer_counterexample
  give_minimal_hint
  give_worked_example
  challenge_assumption
  repair_misrecognition
  summarize_and_check
  renegotiate_goal
  assign_microtask
  lower_cognitive_load
  raise_challenge
  scope_test
  preserve_and_transform_metaphor

Each action must include:
  description
  trigger_conditions
  contraindications
  expected_next_learner_signal
  example_tutor_move

Add a validator that confirms any selected action is in the taxonomy.
```

Acceptance:

- tests fail if policy selector returns a free-form action outside the taxonomy;
- YAML loads cleanly;
- existing tests unaffected.

### Track C: Adaptive trap scenarios

**Owner:** Claude Code  
**Goal:** build high-signal scenarios designed to require strategy shifts.

Prompt:

```text
Create a new scenario file:

config/adaptive-trap-scenarios.yaml

Add 8 compact multi-turn scenarios. Each scenario must contain:
  id
  domain
  hidden_learner_state
  initial_surface_signal
  trigger_turn
  expected_state_update
  expected_strategy_shift
  failure_mode
  success_criteria

Scenario types:
1. false_confusion: learner seems confused but is actually testing a boundary condition
2. polite_false_mastery: learner agrees but later reveals misunderstanding
3. resistance_to_insight: learner begins adversarial, then offers a useful partial insight
4. answer_seeking_to_productive_struggle: learner asks for answer but needs microtask
5. metaphor_boundary_case: learner metaphor is partly wrong, partly useful
6. affective_shutdown: learner disengages after over-explanation
7. repair_after_misrecognition: tutor previously missed the learner's point
8. sophistication_upgrade: learner is more advanced than tutor assumed

Keep each scenario short enough for high-cost frontier models.
No more than 5 learner turns.
Make all success criteria machine-checkable where possible.
```

Acceptance:

- every scenario has an explicit trigger;
- every scenario has an expected action label from `adaptive-policy-actions.yaml`;
- every scenario includes a failure mode;
- no scenario requires more than 5 turns.

### Track D: Psyche-v2 tutor-side deliberation

**Owner:** Codex for implementation; Claude Code for theoretical review.  
**Goal:** turn ego/superego/id from theatrical roles into typed tutor-side pressure on policy selection.

Prompt:

```text
Implement Psyche-v2 tutor-side deliberation.

Do not modify existing paper reproduction cells.

Create services/adaptiveTutor/psyche with:
- schemas.js
- realityAgent.js
- idAgent.js
- superegoAgent.js
- otherEgoAgent.js
- egoMediator.js
- responseGenerator.js
- workingThroughMemory.js
- runPsycheDeliberation.js

The system must produce a structured deliberation trace with:
- state_delta
- id_feedback
- superego_feedback
- other_ego_feedback
- ego_decision
- final_response
- post_turn_memory

Rules:
1. Id proposes candidate pedagogical energies and moves; it does not write the final response.
2. Superego critiques policy and norms before prose; it must cite evidence from learner state.
3. Other-ego predicts learner reception.
4. Ego mediator chooses one action from config/adaptive-policy-actions.yaml.
5. Ego may accept, partially accept, or reject superego feedback, but must justify.
6. Final response must be generated only after ego_decision.
7. Internal deliberation must never leak into the learner-facing response.

Add tests:
- id returns at least two distinct candidate moves
- superego feedback fails validation if it lacks evidence
- ego decision must use a valid policy action
- ego decision must cite state_delta
- final response must not contain internal labels like "Id", "Superego", "policy action", or JSON
- deliberation trace validates against schema
```

Acceptance:

```bash
npm test -- adaptiveTutor
```

### Track E: Dry-run runner

**Owner:** Codex  
**Goal:** validate the architecture without paid model calls.

Prompt:

```text
Add a dry-run adaptive runner.

Create:
  scripts/run-adaptive-dry.js

The script should:
- load config/adaptive-trap-scenarios.yaml
- run deterministic mocked learner turns
- call updateAdaptiveState
- call selectPedagogicalAction
- optionally call runPsycheDeliberation with mock agent outputs
- write transcript-like JSON artifacts under exports/adaptive-dry/

No external LLM calls.
```

Acceptance:

```bash
node scripts/run-adaptive-dry.js --limit 2
npm test -- adaptiveTutor
```

### Track F: Frontier-model runner

**Owner:** Codex after dry-run passes.  
**Goal:** add optional model-backed execution with hard cost and scope controls.

Prompt:

```text
Add optional model-backed execution for the adaptive runner.

Constraints:
- supports small scenario set only
- requires explicit --max-dialogues and --max-cost
- no default expensive run
- logs full state_deltas and selected policy actions
- supports configured provider aliases for GPT 5.5 and Claude 4.7-class models when available
- exits before any model call if estimated run exceeds max-cost
```

Acceptance:

- no paid calls unless user passes explicit flags;
- dry-run still works;
- output JSON includes full deliberation traces.

### Track G: Adaptive analysis script

**Owner:** Claude Code or Codex  
**Goal:** score adaptive behavior directly.

Prompt:

```text
Implement adaptive eval metrics.

Create:
  scripts/analyze-adaptive-traps.js

For each dialogue, compute:

1. trigger_detection
   Did the tutor identify the learner signal at the trigger turn?

2. state_update_accuracy
   Does updated_hypothesis match expected_state_update?

3. strategy_shift_correctness
   Does chosen_pedagogical_action match expected_strategy_shift?

4. counterfactual_divergence
   Given the same pre-trigger setup but different trigger signal, does the policy choose a different action?

5. uptake_score
   Does the final tutor response substantively use the learner's contribution?

6. repair_success
   If scenario required repair, did the tutor explicitly name the mismatch?

7. delayed_task_success
   If scenario includes a microtask, did the learner complete it or improve?

Output:
  exports/adaptive-trap-results.md
  exports/adaptive-trap-results.csv
```

Acceptance:

- table by condition;
- primary endpoint is `strategy_shift_correctness`;
- generic tutor quality is secondary or absent.

### Track H: Psyche deliberation analysis

**Owner:** Codex  
**Goal:** measure whether internal deliberation actually changed output.

Prompt:

```text
Add scripts/analyze-psyche-deliberation.js.

For each run, compute:
- strategy_shift_correctness
- state_update_accuracy
- deliberation_to_output_coupling
- id_candidate_diversity
- superego_grounding_rate
- ego_rejection_rate_of_weak_critique
- other_ego_prediction_accuracy
- internal_leakage_rate

Output:
- exports/psyche-v2-results.md
- exports/psyche-v2-results.csv
```

Acceptance:

- reports coupling rubric 0-4;
- reports ego rejection rate;
- flags internal leakage in final responses.

### Track I: Human inspection packet

**Owner:** Codex  
**Goal:** force human review before paper claims.

Prompt:

```text
Create a transcript sampler:

scripts/export-adaptive-human-packet.js

Inputs:
  --run-id
  --output exports/adaptive-human-packet.md
  --max-per-condition 4

For each sampled dialogue, include:
  scenario id
  hidden learner state
  expected trigger
  expected strategy shift
  previous adaptive state
  state delta
  selected policy action
  tutor final response
  judge scores
  blank human coding fields:
    - did_tutor_update_model_of_learner? yes/no/unclear
    - did_strategy_shift? yes/no/unclear
    - was_shift_pedagogically_appropriate? yes/no/unclear
    - notes
```

Acceptance:

- produces Markdown packet;
- samples across conditions;
- contains enough hidden-state context for human coding.

### Track J: Paper delta report

**Owner:** Claude Code  
**Goal:** update claims cautiously.

Prompt:

```text
Create scripts/generate-adaptive-paper-delta.js.

Purpose:
Compare adaptive results against Paper 2.0 mechanism claims.

Output:
- exports/adaptive-paper-delta.md

Include:
1. What changed relative to Paper 2.0
2. What claims are strengthened
3. What claims are weakened
4. What should move to supplement
5. Proposed revised abstract paragraph
6. Proposed limitations paragraph
7. Claim-status table
```

Acceptance:

- separates supported / suggestive / exploratory / null / contradicted;
- explicitly distinguishes synthetic learner output quality from human learning outcomes.

## 4. Small eval designs

### A13: Adaptive Recognition State-Machine Probe

Research question:

```text
Does explicit adaptive state + policy selection produce meaningful strategy shifts in tutor behavior under frontier models, beyond recognition prompt calibration and ego/superego error correction?
```

Conditions:

```text
C1: recognition prompt only
C2: recognition + current ego/superego
C3: adaptive state + policy selector + recognition response generator
C4: adaptive state + policy selector + recognition response generator + validator/superego
```

Models:

```text
Generator set:
- GPT 5.5 where configured
- Claude 4.7-class model where configured

Judge set:
- GPT 5.5 / GPT 5.5 Pro where configured
- Claude 4.7-class judge where configured

Optional:
- one cheaper judge for drift/sanity only
```

Scale:

```text
4 conditions x 8 scenarios x 2 runs = 64 dialogues per generator model
128 dialogues for two generator models
3-5 turns each
```

Primary endpoint:

```text
strategy_shift_correctness
```

Success threshold:

```text
C3 or C4 improves strategy_shift_correctness by >=25 percentage points over C1 and >=15 points over C2.
C4 does not reduce uptake_score or content_accuracy relative to C3.
At least 70% of sampled human-inspection cases are genuine strategy shift, not rhetorical reframing.
```

### A14: Psyche-v2 Deliberation Probe

Research question:

```text
Does tutor-side psyche deliberation produce better trigger-conditioned strategy shifts than output-review ego/superego alone?
```

Conditions:

```text
C1: recognition-only
C2: current ego/superego output review
C3: strategy-level superego + ego mediator
C4: id + strategy-level superego + other-ego + ego mediator
```

Primary endpoint:

```text
strategy_shift_correctness
```

Secondary endpoints:

```text
state_update_accuracy
deliberation_to_output_coupling
id_candidate_diversity
superego_constraint_grounding
other_ego_prediction_accuracy
ego_rejection_rate_of_weak_critique
repair_success
internal_leakage_rate
```

Success threshold:

```text
C4 improves strategy_shift_correctness over C2 by >=15 percentage points.
C4 deliberation_to_output_coupling mean >=3.0 on 0-4 rubric.
C4 internal leakage rate <=5%.
C4 content accuracy is not worse than C2.
```

## 5. Claude Code slash commands

Create under `.claude/commands/`.

### `/adaptive-plan`

```markdown
---
description: Plan the next adaptive-tutor implementation step
allowed-tools: Bash(git status:*), Bash(git diff:*), Bash(find:*), Bash(grep:*)
---

Read the current adaptive tutor files, current git diff, and relevant tests.

Produce:
1. Current implementation state
2. Next smallest safe task
3. Files to touch
4. Tests to add
5. Risks
6. Exact acceptance command

Do not edit files.
```

### `/adaptive-implement`

```markdown
---
description: Implement one bounded adaptive-tutor task with tests
allowed-tools: Bash(npm test:*), Bash(git status:*), Bash(git diff:*)
---

Implement only this task:

$ARGUMENTS

Rules:
- Touch the minimum number of files.
- Add or update tests first where feasible.
- Do not alter existing paper reproduction logic.
- Do not run expensive LLM calls.
- After implementation, run the narrowest relevant test command.
- Report changed files and remaining risks.
```

### `/adaptive-eval-review`

```markdown
---
description: Review adaptive eval design before running expensive models
allowed-tools: Bash(git status:*), Bash(grep:*), Bash(node scripts/*:*), Bash(npm test:*)
---

Review the proposed adaptive evaluation before any paid model calls.

Check:
1. Is the primary endpoint strategy_shift_correctness rather than generic quality?
2. Are scenarios small and trigger-based?
3. Are expected strategy shifts predeclared?
4. Are models and judges specified?
5. Is there a cost ceiling?
6. Is there a human-inspection packet?
7. Are there any leakage risks?

Return:
- GO / NO-GO
- required fixes before run
- exact command sequence
```

### `/adaptive-paper-delta`

```markdown
---
description: Convert adaptive eval results into paper revision notes
allowed-tools: Bash(git status:*), Bash(ls:*), Bash(cat exports/*:*), Bash(grep:*)
---

Read the latest adaptive results export.

Produce:
1. What changed relative to Paper 2.0
2. What claims are strengthened
3. What claims are weakened
4. What should move to supplement
5. Proposed revised abstract paragraph
6. Proposed limitations paragraph
7. Claim-status table
```

## 6. Claude Code subagents

### `adaptive-architect`

```yaml
name: adaptive-architect
description: Designs adaptive tutor state machines and pedagogical policy logic.
tools: Read, Grep, Glob
system_prompt: |
  You design explicit adaptive control architectures for LLM tutoring.
  Prefer typed state, transition rules, and small testable policies over prompt-only behavior.
  Never propose large factorial expansions unless no smaller diagnostic test will answer the question.
```

### `eval-minimalist`

```yaml
name: eval-minimalist
description: Designs small, high-signal evals with predeclared endpoints.
tools: Read, Grep, Glob, Bash
system_prompt: |
  You are skeptical of large ablation-extension studies.
  Your job is to reduce evals to the smallest design that can falsify the claim.
  Primary endpoints must be specific, inspectable, and predeclared.
  Prefer N=32 with excellent triggers over N=900 with vague outcomes.
```

### `claim-superego`

```yaml
name: claim-superego
description: Audits research claims against evidence and flags overclaiming.
tools: Read, Grep, Glob, Bash
system_prompt: |
  You audit claims for overreach.
  Mark every claim as supported, suggestive, exploratory, null, or contradicted.
  Distinguish synthetic learner results from human learning outcomes.
  Flag any claim that treats LLM judge scores as real learning evidence.
```

## 7. Suggested hook

Purpose: prevent adaptive work from accidentally mutating legacy paper reproduction files.

`.claude/settings.json` sketch:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit|MultiEdit",
        "hooks": [
          {
            "type": "command",
            "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/adaptive-guard.sh"
          }
        ]
      }
    ]
  }
}
```

`.claude/hooks/adaptive-guard.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

if git diff --name-only | grep -E 'docs/research/paper-full\.md|docs/research/paper-full-2\.0\.md|config/paper-manifest\.json' >/dev/null; then
  echo "Adaptive work should not mutate legacy paper or manifest files unless explicitly requested." >&2
  exit 2
fi

if git diff --name-only | grep -E 'services/adaptiveTutor|config/adaptive|scripts/analyze-adaptive' >/dev/null; then
  echo "Adaptive files changed. Run relevant adaptive tests before stopping." >&2
fi
```

## 8. GitHub issue list

### Issue 1: Add adaptive tutor state schema

```text
Implement explicit adaptive tutor state schema and pure state update function.

Deliverables:
- services/adaptiveTutor/stateSchema.js
- services/adaptiveTutor/stateUpdater.js
- tests/adaptiveTutor/stateUpdater.test.js

Non-goals:
- no LLM calls
- no existing evaluationRunner changes
```

### Issue 2: Add policy action taxonomy

```text
Create config/adaptive-policy-actions.yaml and validator.

Primary goal:
The system must select from explicit pedagogical actions rather than burying strategy in prose.

Deliverables:
- config/adaptive-policy-actions.yaml
- services/adaptiveTutor/policySelector.js
- tests/adaptiveTutor/policySelector.test.js
```

### Issue 3: Add adaptive trap scenario set

```text
Create 8 compact trigger-based scenarios that require strategy shift.

Deliverables:
- config/adaptive-trap-scenarios.yaml
- validation script confirming each scenario has hidden state, trigger, expected update, expected action, success criteria
```

### Issue 4: Add dry-run adaptive runner

```text
Build a no-API runner that loads scenarios, applies deterministic mocked learner turns, updates state, selects policy action, and writes a transcript-like JSON artifact.

Deliverables:
- services/adaptiveTutor/adaptiveTutorRunner.js
- scripts/run-adaptive-dry.js
- tests for output schema
```

### Issue 5: Add Psyche-v2 deliberation service

```text
Implement tutor-side reality/id/superego/other-ego/ego-mediator architecture with structured traces.

Deliverables:
- services/adaptiveTutor/psyche/*
- tests for trace schema, non-leakage, valid action selection, grounded superego feedback, id candidate diversity
```

### Issue 6: Add frontier-model runner

```text
Add optional model-backed execution for the adaptive runner.

Constraints:
- explicit --max-cost and --max-dialogues required
- supports configured GPT 5.5 / Claude 4.7 aliases
- no paid calls by default
- logs full state deltas and deliberation traces
```

### Issue 7: Add adaptive analysis script

```text
Implement scripts/analyze-adaptive-traps.js.

Primary endpoints:
- trigger_detection
- state_update_accuracy
- strategy_shift_correctness
- counterfactual_divergence
- uptake_score
- repair_success
- delayed_task_success
```

### Issue 8: Add psyche deliberation analysis

```text
Implement scripts/analyze-psyche-deliberation.js.

Primary endpoints:
- deliberation_to_output_coupling
- id_candidate_diversity
- superego_grounding_rate
- ego_rejection_rate_of_weak_critique
- internal_leakage_rate
```

### Issue 9: Add human inspection packet

```text
Create scripts/export-adaptive-human-packet.js.

Purpose:
Small blinded review packet before paper claims.
```

### Issue 10: Add paper delta report

```text
Create scripts/generate-adaptive-paper-delta.js.

Purpose:
Compare A13/A14 results against Paper 2.0 mechanism claims.
```

## 9. Red lines

Do not:

- launch another large-factorial extension before A13/A14;
- use holistic tutor quality as the primary endpoint;
- treat synthetic learner behavior as human learning evidence;
- let internal deliberation leak to the learner-facing response;
- give the id control over the final response in the first implementation;
- allow the superego to become an unchallengeable command channel;
- claim adaptation unless state update, policy change, and output coupling are all visible.


## Related planning resources

- [03-resource-list.md](03-resource-list.md) — curated resources for adaptive recognition, Psyche-v2, agent orchestration, tutoring evals, and Codex/Claude Code workflows.
