# Claude Critique Integration Plan

This note translates `CLAUDES_CRITIQUE.md` into concrete next actions.

## Accepted Critiques

1. The confirmed rule-learner result is vulnerable to closed-circuit
   gameability. The tutor templates, deterministic learner, and outcome scorer
   can be made to agree by phrase alignment.
2. The effective conceptual sample is closer to six hard cells than twenty-four
   independent observations.
3. The replicated effect is driven partly by rescue branches where the static
   baseline fails badly, while some branches are at ceiling or show
   parent-dialogue regressions.
4. The portable contribution is architectural, not the MVP scoring track:
   challenge state, outcome gates, reflexive critique, and structured traces.

## Immediate Validation Sequence

### A. LLM Learner Proxy

Run hard scenarios with `--learner codex`:

```bash
node prototypes/adaptive-persona-mvp/scripts/run-variant-sweep.js \
  --hard \
  --learner codex \
  --conditions static_codex,controller_reflexive_psychodynamic_codex \
  --baseline static_codex \
  --repeats 1 \
  --out prototypes/adaptive-persona-mvp/outputs/hard-mode-llm-learner-live \
  --timeout-ms 600000 \
  --permutations 200
```

Interpretation:

- If positive across MVP, parent dialogue, and outcome: proceed to mechanism
  scoring and ablations.
- If the effect collapses: retain the rule-learner result as a regression
  harness only and focus on learner-model redesign.

### B. Deep Mechanism Scoring

If the LLM-learner triage holds, run a small deep-reflexive pass:

```bash
node prototypes/adaptive-persona-mvp/scripts/run-replicated-comparison.js \
  --scenarios hard_fractions_forgetful_resistant_closed_loop,hard_ai_bias_resistant_closed_loop,hard_stats_confounding_skeptical_closed_loop \
  --conditions static_codex,controller_reflexive_psychodynamic_codex \
  --baseline static_codex \
  --target controller_reflexive_psychodynamic_codex \
  --repeats 2 \
  --out prototypes/adaptive-persona-mvp/outputs/hard-mode-deep-mechanism-live \
  --timeout-ms 600000 \
  --permutations 1000
```

### C. Ablations

Add explicit ablation conditions:

- controller without challenge state:
  `controller_reflexive_psychodynamic_no_challenge_codex`;
- reflexive controller without Superego revision:
  `controller_reflexive_psychodynamic_ego_only_codex`;
- controller without outcome gate:
  `controller_reflexive_psychodynamic_no_outcome_gate_codex`;
- reflexive controller without durable memory:
  `controller_reflexive_psychodynamic_no_memory_codex`.

The first target should be challenge-state off, because Claude's critique
questions whether the confirmed effect is state adaptation or phrase alignment.

Status after the first focused LLM ablation: challenge-state removal weakens
the hard-AI slice but does not erase the outcome rescue. This means the next
attribution checks should target `no_outcome_gate`, then `ego_only`, then
`no_memory`.

Status after the focused outcome-gate ablation: the static baseline solved both
hard-AI branches at ceiling, so neither the full controller nor the ungated
controller beat it. The result is not a clean gate ablation; it is stronger
evidence that single live LLM slices are too volatile for final attribution.
Move toward replicated LLM ablations or controlled learner-proxy settings.

Status after the post-patch full hard LLM sweep and robustness evaluation:
robust positive effects are not established. The focused hard-AI agency
restoration can win, but the whole hard-curriculum LLM check is flat:

- post-patch full hard LLM sweep: MVP `0`, parent `+1.375`, outcome `0`;
- aggregate over eligible full hard LLM runs: MVP `-0.417`, parent `-0.875`,
  outcome `0`;
- no public metric passes the non-trivial positive gate.

This means the current method should not be promoted as a robust adaptive tutor
effect without either a stronger learner-proxy design, harder held-out tasks
where the static baseline is not at ceiling, or a main-line adaptive-runner
port that can be judged on the parent stack.

### D. Main-Line Candidate

Only after LLM-learner and ablation checks:

- port typed challenge state to `services/adaptiveTutor/`;
- add new adaptive cells rather than altering pre-registered cells;
- run the existing cross-suite trap scenarios and parent scoring stack;
- frame any result as a §6.8 extension.

## Reporting Rules

Future reports should include:

- per-cell win/tie/loss, not only mean deltas;
- explicit note that rule-learner repeats are pseudo-replicates;
- transcript excerpts for every claimed rescue;
- target outcome failures and parent-dialogue regressions;
- whether the learner was rule-based or LLM-based.
