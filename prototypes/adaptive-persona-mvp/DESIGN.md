# Design Note: Evidence-Bound Persona Adaptation

## 1. Why The Current Direction Is Stumbling

`paper-2.0-v3.0.79.pdf` makes a useful negative finding visible: recognition changes the quality level of tutor output, and the superego repairs local failures, but neither reliably steepens within-dialogue adaptive trajectories. The tutor changes across turns, but the change is not reliably caused by the experimental manipulations.

The codebase has already moved well beyond simple prompting. `services/adaptiveTutor/` now contains:

- externalized `learnerProfile` state;
- a finite policy-action vocabulary;
- several architecture flags including `state_policy`, `bilateral_tom`, `bilateral_tom_id_director_*`, and evidence-bound variants;
- counterfactual replay;
- an adaptive grader and strategy-shift analyzer.

That is enough infrastructure to show the next problem: adding more state fields, ToM fields, persona authoring, or prompt rewriting is not automatically adaptation. It can increase apparatus without forcing an accountable causal chain from learner evidence to action. The paper's later adaptive sections already suggest this: trap-suite policy shifts can move while whole-dialogue trajectory quality stays null, negative, or instrument-dependent.

The MVP therefore narrows the target. It asks whether we can make one simple chain work before adding it to the elaborate harness:

```text
quoted learner evidence
  -> knowledge component and correctness observation
  -> per-KC mastery update
  -> relation-state transition
  -> finite pedagogical policy
  -> bounded persona-vector delta
  -> learner-facing message
  -> rubric and counterfactual sensitivity check
```

## 2. Literature Synthesis

The relevant literature points toward hybrid control architectures rather than LLM-only tutoring.

- Classic KT gives the right shape: maintain an evolving learner state rather than trusting a fresh prose profile each turn. BKT is simple and interpretable; DKT, DKVMN, and AKT improve predictive power but at the cost of more data and machinery.
- Dialogue KT work shows a practical bridge for LLM tutoring: use LLMs to label knowledge components and response correctness in open-ended dialogue, then run KT over those labels. This is directly compatible with the repo's existing transcript logs.
- Newer difficulty-aware conversational KT adds interpretable ability and item-difficulty estimates, which matters because "the learner is weak" and "the task is hard" require different tutor actions.
- Recent adaptivity benchmarks find that LLMs do not reliably mimic ITS adaptivity from context alone. This matches the paper's null: sounding responsive is easier than choosing a different pedagogical move for the right learner-state reason.
- Long-horizon tutor work increasingly separates compact student state and high-level tutor actions from final utterance generation. That is the same decomposition this prototype uses.

Relevant sources:

- Borchers and Shou, "Can Large Language Models Match Tutoring System Adaptivity?" AIED 2025: https://arxiv.org/abs/2504.05570
- Scarlatos, Baker, and Lan, "Exploring Knowledge Tracing in Tutor-Student Dialogues using LLMs," LAK 2025: https://arxiv.org/abs/2409.16490
- Huang, Scarlatos, Lee, and Lan, "Interpretable Difficulty-Aware Knowledge Tracing in Tutor-Student Dialogues," 2026: https://arxiv.org/abs/2605.01097
- Hooshyar et al., "Problems With Large Language Models for Learner Modelling," 2025: https://arxiv.org/abs/2512.23036
- Nam et al., "Efficient RL for optimizing conversation level outcomes with an LLM-based tutor," 2025: https://arxiv.org/abs/2507.16252
- Cohn et al., "A Theory of Adaptive Scaffolding for LLM-Based Pedagogical Agents," AAAI 2026: https://arxiv.org/abs/2508.01503
- Dong et al., "Learning from Long-Term Engagement," AAAI 2026: https://doi.org/10.1609/aaai.v40i1.36984

## 3. Knowledge Tracing Choice

This MVP uses BKT-lite because the immediate need is not state-of-the-art prediction. The need is inspectability.

Each knowledge component carries:

```json
{
  "pMastery": 0.42,
  "observations": 1,
  "lastOutcome": "incorrect",
  "lastQuote": "I think recognition just means affirming someone..."
}
```

Outcomes map to updates:

- `correct`: raises mastery.
- `partial`: moves modestly.
- `incorrect`: lowers mastery.
- `unobserved`: does not inflate mastery.

The last rule is load-bearing. The current adaptive-tutor problem is often false personalization: the learner says "yes" or "I get it", and the tutor treats that as state evidence. The MVP makes that a testable failure.

## 4. Persona Evolution

The tutor persona is not a rewritten system prompt or a hidden character biography. It is a bounded response posture:

```json
{
  "warmth": 0.64,
  "challenge": 0.54,
  "directiveness": 0.36,
  "curiosity": 0.72,
  "humility": 0.50,
  "tempo": "medium"
}
```

Persona changes only after policy selection:

- `repair_misrecognition`: raise humility and warmth, slow tempo, lower challenge.
- `teach_back`: raise curiosity, lower directiveness.
- `transfer_challenge`: raise challenge while preserving warmth.
- `faded_example`: raise directiveness without declaring learner weakness.

No numeric dimension may change by more than 0.2 in one turn. That prevents dramatic persona swings from thin evidence.

## 5. Rubric

The rubric scores adaptation as a chain, not as vibes:

- `evidence_bound_state_update`: state updates cite learner quotes.
- `knowledge_tracing_signal`: mastery moves in the correct direction.
- `policy_evidence_fit`: policy matches the learner evidence.
- `persona_evolution_control`: persona changes are bounded and policy-mediated.
- `recognition_repair`: misrecognition is repaired before content continues.
- `counterfactual_sensitivity`: counterfactual learner evidence changes state, policy, and persona.
- `trajectory_gain`: the sequence moves toward teach-back or transfer rather than dependence.

The key metric is counterfactual sensitivity. If a changed learner signal only changes prose, the persona is decorative. If it changes state and policy before prose, the system is adapting.

## 6. Prototype Scenarios

The current scenarios are small by design:

- `polite_false_mastery_kt`: catches the "yes, I get it" trap; correct move is teach-back. The counterfactual branch gives real evidence and should trigger transfer.
- `attempted_then_stuck_hint`: catches partial work with a specific gap; correct move is a bounded hint. The counterfactual discouraged/dependent branch should trigger affective repair.
- `misrecognition_repair`: catches the repair-before-content requirement. The counterfactual removes the correction and should skip repair.

These scenarios are not a substitute for the existing adaptive trap suite. They are unit tests for the missing adaptive mechanism.

## 7. Gate For Promotion Into The Main Harness

Do not register this as a production cell until it passes four gates:

1. Deterministic gate: the current tests stay green and outputs are stable.
2. Log replay gate: the harness can consume existing adaptive dialogue logs as fixtures.
3. LLM extraction gate: an LLM-backed evidence extractor matches deterministic labels on a small hand-coded set.
4. Counterfactual gate: changed learner evidence changes state and policy in at least 80% of targeted counterfactual branches, with no increase in unsupported learner claims.

Only after those gates does it make sense to wire a new adaptive cell into `config/tutor-agents.yaml`.

## 8. Codex CLI Hook

`scripts/run-mvp-codex.js` adds Codex CLI at two controlled edges:

1. `codex-tutor`: receives the selected policy, persona vector, mastery state, relation state, and dialogue history; returns a learner-facing tutor message plus a short policy-alignment note.
2. `codex-observer`: receives the final trace, rubric, and counterfactual comparison; returns adaptation scores and a verdict.

This is intentionally not an LLM-owned controller. The code still owns:

- evidence validation;
- BKT-lite mastery updates;
- relation-state transitions;
- finite policy selection;
- bounded persona-vector mutation;
- deterministic counterfactual comparison.

The hook tests whether an LLM can enact the selected adaptive move and whether another LLM can detect the evidence-state-policy-persona chain. If Codex produces better prose but the observer says the chain did not hold, the result is style improvement, not adaptation.

## 9. Real Adaptation Assessment Harness

`scripts/run-adaptation-assessment.js` implements the five stronger assessment features:

1. **Closed-loop interaction.** A dynamic learner simulator reads the actual tutor message and produces the next learner turn from a hidden learner state. The tutor can no longer be assessed on isolated one-shot responses.
2. **Blind behavioral grading.** The blind judge sees only the transcript and final outcome task. It does not see policy labels, mastery deltas, hidden state, expected actions, or controller internals.
3. **Counterfactual hidden-state perturbation.** Each scenario runs an original and counterfactual branch with the same opening learner turn but different hidden learner state. The comparison reports policy divergence, downstream text divergence, and outcome changes.
4. **Baseline comparison.** The harness can run `static_codex` and `controller_codex` on the same scenario. Static Codex sees only the transcript; controller Codex receives the evidence-bound state and selected policy.
5. **Outcome task.** After tutoring, the simulated learner performs a task tied to the knowledge component. The branch records success/failure and the blind judge scores visible outcome quality.

This still is not human-learning evidence. It is a stronger synthetic adaptation assessment: the learner is dynamic, the judge is blind, the controller is compared against a static tutor, and counterfactual sensitivity is measured downstream rather than inferred from internal state alone.

### Learner Modes

The harness now supports two learner modes:

- `--learner rule` keeps the deterministic simulator. This is the reproducible default and should remain the regression-test target.
- `--learner codex` uses a Codex-backed learner proxy. The proxy receives the hidden learner state, visible transcript, and a stress-test persona prompt. It is instructed not to reward generic warmth, not to magically improve from polished explanation, to reveal misconceptions only when elicited, and to preserve confusion or dependence when the tutor gives the wrong support.

The LLM learner returns both a natural learner turn and simulator metadata (`outcome`, `affect`, `stance`, `expected_policy`) that currently stands in for a separate state-updater. This is still synthetic, but it is a harder test than the deterministic rule table because the tutor must now elicit useful behavior from a generative learner rather than match a fixed keyword transition.
