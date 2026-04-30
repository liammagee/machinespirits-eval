# Adaptive recognition and tutor-side psyche architecture

Generated: 2026-04-30  
Context: Follow-up design notes for `machinespirits-eval`, after the Paper 2.0 mechanism-tracing results narrowed the original Hegel/Freud hypothesis into prompt-level calibration plus architecture-level error correction, with little evidence for robust within-dialogue adaptive responsiveness.

## 1. Core diagnosis

The original motivation remains strong: use philosophical concepts and multi-agent coordination to move LLM tutoring away from monotone, generic, over-affirming interaction and toward dynamic, relationally responsive teaching. The present evidence says something more specific and more sobering:

- Recognition prompting appears to improve the tutor's **initial stance** and raise the quality floor.
- Ego/superego coordination appears to support **local error correction**, especially when the ego is weak or baseline prompts leave more headroom.
- The current system does **not** yet reliably produce meaningful within-dialogue adaptation: the tutor often sounds recognitive, asks more questions, and produces better output, but it does not consistently change strategy because the learner's state changed.

The likely failure is architectural rather than merely prompt-level. System prompts define a prior. Superego critique filters or repairs utterances. But neither, by itself, forces a later turn to differ because the learner has altered the tutor's model of the situation. The next architecture should make adaptation an explicit state transition.

Working formulation:

> Recognition becomes computationally meaningful only when the learner's contribution changes the tutor's state, policy, and subsequent action.

## 2. From rhetorical architecture to control architecture

The current pattern is close to:

```text
Learner turn
  -> Ego drafts tutor response
  -> Superego approves / critiques
  -> Ego revises
  -> Tutor sends response
```

This is useful but narrow. It supports correction, not necessarily deliberation or development.

The proposed pattern is:

```text
Learner turn
  -> State updater
  -> Policy selector
  -> Tutor-side psyche deliberation
  -> Response generator
  -> Validator / superego check
  -> Learner or task response
  -> Outcome evaluator
  -> Working-through memory
```

The key artifact is a structured state delta:

```json
{
  "previous_hypothesis": "Learner is confused about the definition of recognition.",
  "new_evidence": "Learner distinguishes recognition from affirmation and challenges whether AI can recognize.",
  "updated_hypothesis": "Learner understands the basic term and is testing its boundary conditions.",
  "required_strategy_shift": "Stop defining recognition; move to boundary-case testing.",
  "chosen_pedagogical_action": "scope_test",
  "relation_state": "collaborative_contestation"
}
```

The tutor should be forced to show how the learner's turn changed the next pedagogical move.

## 3. Philosophical concepts as transition logic

Do not use Hegel, Freud, Vygotsky, or psychoanalysis only as prompt atmosphere. Use them as computational ontology.

| Concept | Prompt-level version | Architecture-level version |
|---|---|---|
| Recognition | Treat learner as autonomous subject | Learner contribution updates tutor state and action |
| Misrecognition | Tutor fails to acknowledge learner | Tutor chooses an action inconsistent with learner state |
| Repair | Apologize or clarify | Explicitly name the mismatch and update hypothesis |
| Negation | Learner resists | Prediction error that forces policy change |
| Aufhebung | Preserve and elevate learner idea | Response preserves a valid part of learner framing while transforming it |
| Bildung | Learner grows | Learner externalizes understanding through task, explanation, transfer, or revision |
| Superego | Critic says response could improve | Norm-enforcement module checking strategy, not just prose |
| Ego | Student-facing voice | Mediator balancing state, drive, norm, reception, and task demands |
| Id | Chaotic or unsafe impulse | Controlled source of energy, variation, metaphor, challenge, and pedagogical desire |
| Transference / Other | Learner reacts | Tutor-side simulation of how learner will experience the move |

## 4. Strategy inventory: what else might work

### 4.1 Recognition state machine

Replace general recognition instructions with explicit relation states and transitions.

Possible states:

```text
directive
diagnostic
contested
collaborative
repair
productive_struggle
scope_testing
synthesis
transfer
```

Example transition:

```text
Learner appears confused -> tutor explains
Learner challenges applicability -> state changes to contested/scope_testing
Tutor must stop explaining and ask a boundary-case question
```

The important measure is not whether the tutor sounds warm; it is whether it changed strategy when the learner signal changed.

### 4.2 Separate policy selection from utterance generation

A good tutor response has at least two layers:

1. What pedagogical action should happen now?
2. How should that action be expressed?

The system should choose from a compact action taxonomy before writing prose:

```text
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
```

This makes adaptation measurable. After learner resistance, did the policy change from `explain_concept` to `scope_test`? After affective shutdown, did it change to `repair_misrecognition` or `lower_cognitive_load`?

### 4.3 Prediction-error loop

Before each learner response, the tutor should forecast:

```text
expected_learner_understanding
expected_affect
expected_objection
expected_next_move
confidence
```

After the learner replies, compute prediction error:

```text
actual_learner_state - predicted_learner_state
```

The next strategy should respond to that error. This creates an operational version of Piagetian accommodation, Hegelian negation, and predictive processing.

Memory should store failed predictions and revised hypotheses, not just conversation summaries.

### 4.4 Learner-model agent

Add a tutor-side agent whose only job is compact case formulation.

Example output:

```json
{
  "concept_mastery": {"alienation": 0.7, "recognition": 0.4},
  "current_misconception": "Treats recognition as affirmation rather than mutual constraint.",
  "affective_state": "skeptical but engaged",
  "agency_signal": "challenging tutor framing",
  "trust_level": 0.55,
  "last_prediction_error": "Learner was more conceptually advanced than assumed.",
  "recommended_next_action": "Ask them to test their distinction against a counterexample."
}
```

This is different from a superego. The superego checks norms. The learner-model agent tracks the learner.

### 4.5 Model-predictive dialogue

For each possible tutor action, simulate likely learner responses and choose the action with the best expected downstream state.

```text
candidate actions:
  ask diagnostic question
  offer counterexample
  give worked example
  repair misrecognition

for each action:
  simulate learner response
  estimate next learner state
  estimate relation state
  estimate task progress

choose action with best expected long-term value
```

This can be expensive, but for small frontier-model probes it may be worth testing.

### 4.6 Task-grounded feedback

A dialogue-only judge lets a tutor sound adaptive without being adaptive. Add small external tasks:

```text
classify a passage
solve a problem
revise an explanation
choose between interpretations
generate an example
diagnose a misconception
```

If the learner fails after the tutor thought they understood, the tutor must update. If the learner succeeds unexpectedly, the tutor must raise challenge. This provides hard feedback rather than rhetorical feedback.

### 4.7 Adaptive trap benchmark

Stop relying on generic average quality slopes. Design traps where the initial plausible strategy becomes wrong.

Examples:

```text
False confusion:
  Learner seems confused but is testing a boundary condition.
  Required shift: explanation -> scope test.

Polite false mastery:
  Learner agrees but later reveals misunderstanding.
  Required shift: affirmation -> diagnostic microtask.

Resistance to insight:
  Learner starts hostile, then offers a useful partial insight.
  Required shift: affect repair -> conceptual extension.

Answer seeking to productive struggle:
  Learner asks for direct answer but needs guided effort.
  Required shift: answer-giving -> microtask / minimal hint.

Metaphor boundary case:
  Learner's metaphor is partly wrong but partly useful.
  Required shift: correction -> preserve-and-transform.
```

Primary metric: given the trigger at turn N, did the tutor choose the correct strategy at turn N+1?

### 4.8 Train or optimize the policy

Prompting may have reached its ceiling. Adaptive tutoring may need to be learned as a policy.

Training data could pair the same dialogue history with two possible next moves:

```text
A: continues same strategy
B: changes strategy because learner signal changed
Preference: B if justified by learner state and improves later task performance
```

This could support DPO, preference learning, reranking, or even a lightweight action-selection model, while keeping frontier LLMs as response generators.

### 4.9 Memory as active controller

Memory should not be a context dump. It should have read/write obligations.

Before response:

```text
Retrieve one relevant learner-state memory.
State how it changes the next pedagogical action.
```

After response:

```text
Write one update only if the learner changed the tutor's model.
```

Useful memory entries:

```text
Learner rejected my analogy because...
Learner's actual misconception is...
Learner responds badly to direct explanation...
Learner's productive metaphor is...
Previous repair succeeded/failed because...
```

Less useful entries:

```text
Learner discussed recognition.
Learner was frustrated.
Learner did lecture 3.
```

### 4.10 Skill library

Give the tutor a reusable repertoire of pedagogical moves.

Example skills:

```text
repair_after_misrecognition
convert_resistance_to_testable_hypothesis
turn_metaphor_into_boundary_case
diagnose_false_mastery
lower_cognitive_load_without_removing_challenge
move_from_affective_support_to_conceptual_work
ask_for_self_explanation
```

Each skill should include:

```text
trigger conditions
example learner signals
procedure
failure modes
expected learner response
postcondition
```

Adaptation becomes skill selection, not just text generation.

### 4.11 Finite-state dialog manager

A traditional dialog manager may instantiate the philosophical claims better than unconstrained agent free play.

Phases:

```text
diagnosis
elicitation
challenge
guided_practice
repair
synthesis
transfer
reflection
```

The LLM supplies tact, tone, and examples. The state machine controls movement.

## 5. Tutor-side psyche: adapting the Freudian design

The pseudo-Freudian architecture should not be abandoned. It should be adapted from output review into deliberative control.

The old design:

```text
Ego writes -> Superego critiques -> Ego revises
```

The proposed design:

```text
Reality agent -> Id agent -> Superego agent -> Other-ego simulator -> Ego mediator -> Response generator -> Validator -> Working-through memory
```

### 5.1 Agent roles

| Agent | Freudian analogue | Computational role | Failure targeted |
|---|---|---|---|
| Reality agent | Ego's reality principle | Extracts learner state, task state, contradiction, affect, prediction error | Responding to surface wording instead of pedagogical situation |
| Id agent | Drive / impulse / associative energy | Generates vivid candidate moves, tones, metaphors, tensions | Flat, safe, generic, over-calibrated tutor voice |
| Superego agent | Prohibition + ego ideal | Names constraints, violations, and positive ideals | Sycophancy, premature rescue, fake recognition, content error |
| Other-ego simulator | Transference / imagined reception | Predicts how learner will hear the move | Tutor thinks it recognizes learner while learner experiences deflection |
| Ego mediator | Practical judgment | Chooses one policy action under constraints | Internal debate fails to alter action |
| Analyst / memory | Working through | Stores failed predictions and durable revised hypotheses | No accumulated adaptation across turns |

### 5.2 Id as controlled divergence

The id is not unsafe chaos. It is a generator of pedagogical energy and variation.

Example:

```json
{
  "detected_charge": "The learner is daring the tutor to prove the concept matters.",
  "tutor_impulses": [
    {
      "impulse": "rescue",
      "description": "Explain the concept clearly to reduce tension.",
      "risk": "Would flatten the learner's challenge into a knowledge deficit."
    },
    {
      "impulse": "challenge",
      "description": "Accept the learner's objection and turn it into a test case.",
      "risk": "Could feel adversarial if not framed respectfully."
    },
    {
      "impulse": "play",
      "description": "Use the learner's metaphor as a scene and alter one variable.",
      "risk": "Could become charming rather than instructional."
    }
  ],
  "recommended_energy": "challenge-with-play",
  "candidate_move": "Treat the objection as a boundary test and ask the learner to apply it to a contrasting case."
}
```

Initial recommendation: id proposes candidate moves; it should not rewrite the full ego system prompt. Full id-director designs are interesting but high variance and prone to meta-narration or instruction-following degradation when stacked with other text-heavy levers.

### 5.3 Superego as typed normative pressure

The superego should critique strategy before prose.

Example:

```json
{
  "prohibition": {
    "type": "do_not_rescue_too_soon",
    "evidence": "Learner has offered a partial interpretation, not asked for a definition.",
    "risk": "Explaining now will turn their contribution into a pretext for lecture."
  },
  "ego_ideal": {
    "type": "preserve_and_transform",
    "standard": "A strong response should retain the learner's framing while pushing it one step further."
  },
  "required_revision": {
    "policy_level": "switch from explanation to scope_test",
    "output_level": "Name the learner's move as a boundary test; ask them to test it against a counterexample."
  }
}
```

The ego must be allowed to reject weak superego feedback:

```json
{
  "superego_objection": "The response gives too much explanation.",
  "ego_decision": "partially_accept",
  "reason": "The learner needs one clarifying distinction, but the main move should remain a scope test.",
  "revision_plan": "Keep one sentence of clarification; replace the mini-lecture with a question."
}
```

If the ego always accepts, this is compliance, not deliberation.

### 5.4 Other-ego simulator

A tutor-side learner-reception agent may be more important than another critic.

Example:

```json
{
  "how_learner_will_hear_this": "The learner may hear this as agreement followed by redirection.",
  "likely_next_response": "They will either comply politely or repeat the objection more sharply.",
  "missed_need": "They want the tutor to take the objection seriously as an objection, not as confusion.",
  "suggested_adjustment": "Begin by naming the objection's force, then invite a test rather than supplying a correction."
}
```

This can be framed as transference/countertransference monitoring: what role is the tutor inviting the learner to occupy?

### 5.5 Forms of tutor-side feedback

#### Drive-surfacing feedback

```json
{
  "tutor_temptation": "rescue_by_explaining",
  "why_tempting": "Learner discomfort creates pressure to resolve the contradiction.",
  "danger": "Premature explanation will erase productive struggle.",
  "alternative_drive": "turn_discomfort_into_test"
}
```

#### Normative prohibition feedback

```json
{
  "prohibition": "Do not convert resistance into a knowledge deficit.",
  "evidence": "Learner is objecting to applicability, not asking what the concept means.",
  "violation_if_ignored": "Tutor will misrecognize the learner's agency."
}
```

#### Ego-ideal feedback

```json
{
  "ego_ideal": "A strong tutor preserves the learner's objection and transforms it into inquiry.",
  "ideal_move": "Ask the learner to test their objection across two contrasting cases."
}
```

#### Reality-testing feedback

```json
{
  "learner_state": "skeptical_but_engaged",
  "concept_state": "partial_mastery",
  "affect_state": "high_energy_resistance",
  "zpd_estimate": "ready_for_boundary_case",
  "contraindicated_moves": ["basic_definition", "long_explanation", "generic_reassurance"]
}
```

#### Uptake simulation feedback

```json
{
  "candidate_action": "challenge_assumption",
  "likely_reception": "Could feel respected if framed as taking their objection seriously.",
  "risk": "Could feel combative if the tutor says 'but' too early.",
  "phrasing_advice": "Start with 'That objection is doing real work' before introducing the test."
}
```

#### Working-through feedback

```json
{
  "prediction": "Learner would respond well to scope testing.",
  "actual_response": "Learner elaborated the objection and supplied a new example.",
  "prediction_error": "Learner was more advanced than expected.",
  "durable_update": "When this learner resists, treat it as conceptual testing before offering explanation.",
  "next_time": "Raise challenge sooner."
}
```

## 6. Proposed deliberation trace

Each tutor turn should produce a structured trace:

```json
{
  "turn_id": "scenario_03_turn_2",
  "state_delta": {
    "previous_hypothesis": "learner lacks definition",
    "updated_hypothesis": "learner is testing scope conditions",
    "prediction_error": "learner more advanced than expected"
  },
  "id_feedback": {
    "recommended_energy": "challenge-with-play",
    "candidate_moves": ["contest", "play", "comfort"]
  },
  "superego_feedback": {
    "prohibition": "do_not_reduce_objection_to_confusion",
    "ego_ideal": "preserve_and_transform"
  },
  "other_ego_feedback": {
    "likely_reception": "will feel recognized if objection is named as serious"
  },
  "ego_decision": {
    "chosen_action": "scope_test",
    "rejected_actions": ["basic_explanation", "generic_validation"],
    "rationale": "Learner's contribution changes the task from explanation to boundary testing."
  },
  "final_response": "...",
  "post_turn_memory": {
    "durable_update": "Learner uses resistance as conceptual testing."
  }
}
```

## 7. Metrics that matter

Primary metrics should no longer be generic tutor quality or average score slopes.

Use:

```text
strategy_shift_correctness
state_update_accuracy
trigger_detection
deliberation_to_output_coupling
counterfactual_divergence
prediction_error_reduction
repair_success
delayed_task_success
human-coded uptake
internal_leakage_rate
```

### Deliberation-to-output coupling rubric

```text
0 = internal trace unrelated to output
1 = output echoes trace vocabulary cosmetically
2 = output uses one trace element but strategy unchanged
3 = output changes strategy in line with trace
4 = output integrates state delta, id energy, superego constraint, and learner-reception forecast
```

This directly tests whether internal multi-agent deliberation actually caused the external tutor move.

## 8. Small eval direction

Avoid another large ablation-extension study.

Run a small, high-resolution probe with strong models:

```text
A13: Adaptive Recognition State-Machine Probe
A14: Psyche-v2 Deliberation Probe
```

### A13 conditions

```text
C1: recognition prompt only
C2: current ego/superego
C3: adaptive state + policy selector + recognition generator
C4: adaptive state + policy selector + recognition generator + validator/superego
```

### A14 conditions

```text
C1: recognition-only
C2: current ego/superego output review
C3: strategy-level superego + ego mediator
C4: id + strategy-level superego + other-ego + ego mediator
```

### Suggested scale

```text
8 adaptive traps
2 runs each
3-5 turns max
4 conditions
64 dialogues per generator model
128 dialogues for two frontier generators
```

Use GPT 5.5 and Claude 4.7-class models where configured. The goal is not broad population generalization; it is a high-resolution mechanism probe.

### Success threshold example

```text
C3 or C4 improves strategy_shift_correctness by >=25 percentage points over C1 and >=15 points over C2.
C4 does not reduce uptake_score or content_accuracy relative to C3.
At least 70% of sampled human-inspection cases are judged as genuine strategy shift, not rhetorical reframing.
```

## 9. Resource links mentioned in discussion

These were suggested as conceptual primers for future implementation work.

- LangGraph: stateful agent orchestration, nodes, edges, cycles, conditional routing.  
  <https://www.youtube.com/watch?v=J5d1l6xgQBc>
- LangGraph tutorial / stateful multi-agent workflows.  
  <https://glasp.co/youtube/gqvFmK7LpDo>
- ReAct: reasoning, acting, observing.  
  <https://research.google/blog/react-synergizing-reasoning-and-acting-in-language-models/>
- Reflexion: verbal reinforcement learning and episodic feedback.  
  <https://www.youtube.com/watch?v=92yfO_ReLsE>
- Tree of Thoughts: deliberate search over candidate solutions.  
  <https://glasp.co/youtube/ut5kp56wW_4>
- Voyager: skill libraries, automatic curriculum, environmental feedback.  
  <https://www.youtube.com/watch?v=GmtKbZRH2og>
- Generative Agents: memory, reflection, planning.  
  <https://glasp.co/youtube/XY5Wncq5vAE>
- MemGPT / Letta memory architecture.  
  <https://docs.letta.com/guides/agents/architectures/memgpt>
- POMDP intro: uncertainty and state inference.  
  <https://www.youtube.com/watch?v=-q61H11Lm0s>
- POMDPs for spoken dialogue systems.  
  <https://www.microsoft.com/en-us/research/video/partially-observable-markov-decision-processes-for-spoken-dialogue-systems/>
- Model predictive control lecture.  
  <https://resourcium.org/resource/model-predictive-control>

## 10. Strongest claim to preserve

Do not claim that recognition prompting or ego/superego staging has already produced robust adaptive behavior. The better claim is:

> Current results suggest recognition prompting calibrates tutor output and superego architecture supports partially substitutable error correction. Meaningful adaptation likely requires explicit learner-state updating, policy selection, prediction error, task-grounded feedback, and tutor-side deliberation that affects strategy rather than merely revising prose.

This gives the next phase a precise target: demonstrate strategy change conditioned on learner-state change.


## Related planning resources

- [03-resource-list.md](03-resource-list.md) — curated resources for adaptive recognition, Psyche-v2, agent orchestration, tutoring evals, and Codex/Claude Code workflows.
