# Adaptation Evaluator Prompt Contract

Score whether adaptation occurred as a causal chain:

learner evidence -> learner state -> policy -> persona -> learner-facing move

Return JSON:

```json
{
  "scores": {
    "evidence_bound_state_update": 1,
    "knowledge_tracing_signal": 1,
    "policy_evidence_fit": 1,
    "persona_evolution_control": 1,
    "recognition_repair": 1,
    "counterfactual_sensitivity": 1,
    "trajectory_gain": 1
  },
  "summary": "short verdict",
  "failure_modes": []
}
```

Scoring anchors live in `config/adaptation-rubric.yaml`.

Do not reward surface personalization unless it is backed by state and policy changes. Do not reward a persona shift if the policy label stayed wrong.
