# Adaptive Mechanism Ablation Conditions

This note defines the mechanism-deletion variants used to test Claude's
critique that the confirmed rule-learner result may be a bundled phrase loop
rather than evidence for a particular adaptive mechanism.

All conditions stay inside the prototype harness. They do not alter the parent
evaluation stack.

## Naming

The runner now interprets mechanism switches from condition names:

| Condition token | Effect |
|---|---|
| `no_challenge` or `no_challenge_state` | disables the hard-mode challenge-state observer and removes challenge directives |
| `no_outcome_gate` or `ungated` | leaves misconception diagnosis visible but prevents the gate from forcing `misconception_repair` |
| `ego_only` or `no_superego` | uses the Ego draft directly, without Superego critique or Ego revision |
| `no_memory` or `memoryless` | resets reflexive memory each turn |

Examples:

```text
controller_reflexive_psychodynamic_no_challenge_codex
controller_reflexive_psychodynamic_no_outcome_gate_codex
controller_reflexive_psychodynamic_ego_only_codex
controller_reflexive_psychodynamic_no_memory_codex
```

The base condition remains:

```text
controller_reflexive_psychodynamic_codex
```

## What Each Ablation Tests

### Challenge State Off

Tests whether the hard-mode gains require explicit recognition of resistance,
forgetfulness, skepticism, disinterest, or reversion.

Expected failure if challenge state is causal: repeated hard-mode learner
challenge should receive a less specific repair, fewer concrete cues, and less
strategy change after resistance.

### Outcome Gate Off

Tests whether the controller's improvement comes from an explicit guard that
blocks transfer until visible repair evidence appears.

Expected failure if the gate is causal: the tutor may use weaker contrastive
or generic probes while active domain misconceptions remain unrepaired.

### Superego Off

Tests whether the multiagent reflexive pass contributes beyond the first Ego
draft.

Expected failure if Superego is causal: more answer leakage, over-explanation,
generic warmth, or repeated abstract repair after learner challenge.

### Memory Off

Tests whether durable critique/memory contributes across turns.

Expected failure if memory is causal: the tutor may resolve a local turn but
forget repair debt, repeat prior mistakes, or fail to restore agency after
the learner has repaired the challenge.

## Recommended Run

Use the LLM learner before treating ablations as evidence:

```bash
node prototypes/adaptive-persona-mvp/scripts/run-variant-sweep.js \
  --hard \
  --learner codex \
  --conditions static_codex,controller_reflexive_psychodynamic_codex,controller_reflexive_psychodynamic_no_challenge_codex,controller_reflexive_psychodynamic_no_outcome_gate_codex,controller_reflexive_psychodynamic_ego_only_codex,controller_reflexive_psychodynamic_no_memory_codex \
  --baseline static_codex \
  --repeats 1 \
  --out prototypes/adaptive-persona-mvp/outputs/hard-mode-llm-ablation-live \
  --timeout-ms 600000 \
  --permutations 200
```

For a fast artifact and trace-shape check:

```bash
node prototypes/adaptive-persona-mvp/scripts/run-variant-sweep.js \
  --hard \
  --dry-run \
  --conditions static_codex,controller_reflexive_psychodynamic_codex,controller_reflexive_psychodynamic_no_challenge_codex,controller_reflexive_psychodynamic_no_outcome_gate_codex,controller_reflexive_psychodynamic_ego_only_codex,controller_reflexive_psychodynamic_no_memory_codex \
  --baseline static_codex \
  --repeats 1 \
  --out prototypes/adaptive-persona-mvp/outputs/hard-mode-ablation-dry-run \
  --permutations 100
```

## Reporting

Report ablations as mechanism evidence, not as a new leaderboard. A useful
ablation report should include:

- public deltas against the static baseline;
- deltas against the full psychodynamic controller;
- per-curriculum win/tie/loss;
- challenge-state detection and resolution rates where applicable;
- transcript quotes showing what disappeared when the mechanism was removed.
