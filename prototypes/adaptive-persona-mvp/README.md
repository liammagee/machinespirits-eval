# Adaptive Persona MVP

This subdirectory is a contained prototype. It does not import, modify, or register anything in the existing evaluation harness. The goal is to test a narrower claim than the paper's full adaptive-runner arc:

> A tutor persona is genuinely adaptive only when quoted learner evidence changes learner state, learner state changes a finite pedagogical policy, and the policy changes the tutor's voice in a constrained, inspectable way.

## Diagnosis From `paper-2.0-v3.0.79.pdf`

The current paper is strongest as a mechanism-discovery paper. It shows robust tutor-production effects:

- Recognition or intersubjective-pedagogy prompts raise the tutor's quality level and narrow variance.
- Ego/superego architecture catches local pedagogical failures, especially under weaker baseline prompting.
- The adaptive-responsiveness mechanism is still unresolved: the paper reports high descriptive cross-turn variation, but no robust condition-modulated slope effect in the main N=432 trajectory analysis, and the extended disengagement effect failed pre-registered replication.

The prototype therefore avoids another broad "richer persona" or "more memory" pass. It makes adaptation a closed loop:

1. Extract quoted evidence from the learner turn.
2. Update mastery with a small knowledge-tracing model.
3. Select a finite policy from learner state plus relation state.
4. Evolve the persona vector within bounded dimensions.
5. Generate a learner-facing move from the policy and persona.
6. Score whether the state, policy, persona, and counterfactual branch actually diverged for the right reasons.

## Literature Takeaways

The design follows the newer adaptive-tutoring literature rather than relying on LLM prompt atmosphere alone:

- Borchers and Shou (AIED 2025) found current LLMs only marginally mimic ITS adaptivity when student errors and knowledge components are ablated from prompts.
- Scarlatos, Baker, and Lan (LAK 2025) show LLMs can help label dialogue turns with knowledge components and correctness, then feed KT methods over dialogue.
- Huang, Scarlatos, Lee, and Lan (2026) add interpretable difficulty-aware conversational KT with IRT-style ability and task-difficulty parameters.
- Hooshyar et al. (2025) argue LLMs alone are unreliable learner models and that responsible tutoring needs hybrid learner-modeling frameworks.
- Nam et al. (2025) optimize conversation-level tutor outcomes by using a compact latent student state and high-level tutor actions, rather than directly optimizing one utterance at a time.
- Cohn et al. (AAAI 2026) frame adaptive scaffolding around Evidence-Centered Design, Social Cognitive Theory, and the Zone of Proximal Development.

That points to a conservative MVP: use the LLM for interpretation and language, but keep learner state, policy labels, state transitions, and evaluation explicit.

## Files

- `config/multiagent.yaml` defines the proposed agents, state objects, policy vocabulary, and state machine.
- `config/reflexive-multiagent.yaml` defines the Ego/Superego reflexive variant.
- `config/adaptation-rubric.yaml` defines a prototype rubric for whether adaptation actually occurred.
- `config/hard-adaptation-rubric.yaml` documents the hard-mode addendum for resistant, forgetful, skeptical, or disinterested learner trajectories.
- `config/psychodynamic-adaptation-rubric.yaml` scores the reflexive trace for defense recognition, repair debt, learner agency, and public-dialogue translation.
- `config/scenarios.yaml` contains deterministic trap scenarios with counterfactual branches.
- `DESIGN.md` gives the full paper/code/literature synthesis and promotion gates.
- `ADAPTATION_PLAN.md` documents the post-baseline repair plan: domain misconception models, policy/action templates, and outcome gates.
- `STATE_MACHINE_ADAPTATION.md` documents the challenge-state finite state machine that escalates resistance, forgetfulness, skepticism, disinterest, and reversion into binding tutor directives.
- `ABLATION_CONDITIONS.md` documents mechanism-deletion conditions for challenge state, outcome gates, Superego revision, and reflexive memory.
- `ADAPTIVE_FEATURE_ARC_AND_NEXT_STEPS.md` summarizes the arc to the confirmed adaptive-delta result and lays out maturation directions.
- `CRITIQUE_INTEGRATION_PLAN.md` integrates Claude's critique into the next validation sequence.
- `NEAR_MEDIUM_TERM_ROADMAP.md` operationalizes the near/medium-term path after the LLM robustness verdict.
- `scripts/evaluate-robustness.js` aggregates saved live reports and decides whether hard-mode LLM results establish a robust positive effect.
- `scripts/replay-parent-stack.js` reads existing parent adaptive dialogue logs and replays them through the prototype state machine without changing parent scores.
- `ITERATION_PROTOCOL.md` documents the staged variant sweep, survivor filtering, deep mechanism scoring, and statistical confirmation workflow.
- `ITERATION_RESULTS.md` records the 2026-05-15 sweep, repair iteration, deep mechanism score, and public confirmation attempt.
- `prompts/*.md` are replaceable prompt contracts for the LLM-backed version.
- `src/*.js` contains a deterministic implementation of the controller and evaluator.
- `scripts/run-mvp.js` runs the prototype and writes outputs.
- `tests/mvp.test.js` verifies KT updates, policy divergence, and scoring behavior.

## Run

```bash
node prototypes/adaptive-persona-mvp/scripts/run-mvp.js
node --test prototypes/adaptive-persona-mvp/tests/*.test.js
```

The run writes JSON and Markdown summaries to `prototypes/adaptive-persona-mvp/outputs/` by default.

## Run With Codex CLI

Use Codex CLI for the learner-facing tutor messages and for an independent adaptation observation pass:

```bash
node prototypes/adaptive-persona-mvp/scripts/run-mvp-codex.js --scenario polite_false_mastery_kt
```

Useful flags:

```bash
node prototypes/adaptive-persona-mvp/scripts/run-mvp-codex.js \
  --scenario polite_false_mastery_kt \
  --model gpt-5.4-mini \
  --observer-model gpt-5.4 \
  --keep-prompts
```

Dry-run mode writes the exact prompts without calling Codex:

```bash
node prototypes/adaptive-persona-mvp/scripts/run-mvp-codex.js --scenario polite_false_mastery_kt --dry-run
```

The controller still owns KT, relation-state transitions, policy selection, and persona-vector updates. Codex only writes the tutor message from that structured state and judges the resulting trace.

## Run The Real Adaptation Assessment

This is the stronger harness for actual adaptation assessment. It adds:

- closed-loop learner simulation, where the tutor's message changes the next learner turn;
- blind transcript-only behavioral grading;
- original vs counterfactual hidden learner branches with the same opening turn;
- static Codex vs controller+Codex baseline comparison;
- an outcome task after tutoring.

Dry run:

```bash
node prototypes/adaptive-persona-mvp/scripts/run-adaptation-assessment.js \
  --scenario recognition_false_mastery_closed_loop \
  --dry-run
```

Live controller-only smoke:

```bash
node prototypes/adaptive-persona-mvp/scripts/run-adaptation-assessment.js \
  --scenario recognition_false_mastery_closed_loop \
  --conditions controller_codex
```

Use the LLM learner proxy instead of the deterministic rule-based learner:

```bash
node prototypes/adaptive-persona-mvp/scripts/run-adaptation-assessment.js \
  --scenario recognition_false_mastery_closed_loop \
  --conditions controller_codex \
  --learner codex
```

Separate model knobs are available for tutor, learner, and judge:

```bash
node prototypes/adaptive-persona-mvp/scripts/run-adaptation-assessment.js \
  --scenario recognition_false_mastery_closed_loop \
  --learner codex \
  --model gpt-5.4-mini \
  --learner-model gpt-5.4-mini \
  --judge-model gpt-5.4
```

Full live static-vs-controller assessment:

```bash
node prototypes/adaptive-persona-mvp/scripts/run-adaptation-assessment.js \
  --scenario recognition_false_mastery_closed_loop
```

## Run The Rubric Comparison HTML

This reruns the stronger closed-loop assessment with both conditions and applies
two rubrics:

- the MVP adaptation rubric, which is a blind transcript/outcome judge focused
  on visible adaptation;
- the parent project's dialogue-quality rubric
  (`config/evaluation-rubric-dialogue.yaml`), which is the parent rubric meant
  for multi-turn pedagogical encounters.

It also includes a static AI tutor baseline prompt. The baseline sees only the
scenario objective and visible transcript; it does not see mastery estimates,
hidden learner state, policy labels, or counterfactual information.

```bash
node prototypes/adaptive-persona-mvp/scripts/run-rubric-comparison.js \
  --scenario fractions_denominator_size_closed_loop \
  --out prototypes/adaptive-persona-mvp/outputs/rubric-comparison-fractions
```

Run the three non-philosophy curriculum slices together:

```bash
node prototypes/adaptive-persona-mvp/scripts/run-rubric-comparison.js \
  --scenarios fractions_denominator_size_closed_loop,ai_bias_single_cause_closed_loop,stats_confounding_closed_loop \
  --out prototypes/adaptive-persona-mvp/outputs/rubric-comparison-disciplinary
```

Run the Ego/Superego reflexive condition:

```bash
node prototypes/adaptive-persona-mvp/scripts/run-rubric-comparison.js \
  --scenarios fractions_denominator_size_closed_loop,ai_bias_single_cause_closed_loop,stats_confounding_closed_loop \
  --conditions controller_codex,controller_reflexive_codex \
  --out prototypes/adaptive-persona-mvp/outputs/rubric-comparison-reflexive
```

Run the psychodynamic Ego/Superego variant:

```bash
node prototypes/adaptive-persona-mvp/scripts/run-rubric-comparison.js \
  --scenarios fractions_denominator_size_closed_loop,ai_bias_single_cause_closed_loop,stats_confounding_closed_loop \
  --conditions static_codex,controller_codex,controller_reflexive_psychodynamic_codex \
  --out prototypes/adaptive-persona-mvp/outputs/rubric-comparison-psychodynamic \
  --timeout-ms 600000
```

Analyze the internal Ego/Superego deliberation in an existing reflexive report:

```bash
node prototypes/adaptive-persona-mvp/scripts/analyze-reflexive-report.js \
  --input prototypes/adaptive-persona-mvp/outputs/rubric-comparison-reflexive-live/rubric-comparison-2026-05-15T00-02-58-459Z.json \
  --out prototypes/adaptive-persona-mvp/outputs/reflexive-deep-analysis
```

## Run A Replicated Significance Check

This runner repeats the rubric comparison, pairs target and baseline branches
within the same scenario/repeat, and reports mean difference, bootstrap 95% CI,
sign-flip permutation p-value, Cohen dz, and a conservative gate:

```text
bootstrap CI lower bound > 0 and permutation p < 0.05
```

The default target is `controller_reflexive_psychodynamic_codex` against
`static_codex`. Reflexive target branches are also scored with the parent
deliberation rubric and the psychodynamic adaptation rubric.

```bash
node prototypes/adaptive-persona-mvp/scripts/run-replicated-comparison.js \
  --scenarios fractions_denominator_size_closed_loop,ai_bias_single_cause_closed_loop,stats_confounding_closed_loop \
  --conditions static_codex,controller_codex,controller_reflexive_psychodynamic_codex \
  --baseline static_codex \
  --target controller_reflexive_psychodynamic_codex \
  --repeats 8 \
  --out prototypes/adaptive-persona-mvp/outputs/replicated-psychodynamic-live \
  --timeout-ms 600000
```

Use `--dry-run` for a fast artifact-shape check. Use `--skip-deep-reflexive`
when you only want public transcript/outcome comparison and want to avoid the
extra deliberation and psychodynamic judge calls.

## Run A Variant Sweep

The staged iteration workflow in `ITERATION_PROTOCOL.md` starts with a sweep
over the non-reflexive controller and all reflexive variants:

```bash
node prototypes/adaptive-persona-mvp/scripts/run-variant-sweep.js \
  --scenarios fractions_denominator_size_closed_loop,ai_bias_single_cause_closed_loop,stats_confounding_closed_loop \
  --conditions static_codex,controller_codex,controller_reflexive_codex,controller_reflexive_psychodynamic_codex,controller_reflexive_dialogical_codex \
  --baseline static_codex \
  --repeats 2 \
  --out prototypes/adaptive-persona-mvp/outputs/variant-sweep-live \
  --timeout-ms 600000
```

Pass `--deep-reflexive` only after a candidate survives public triage. The
sweep report writes JSON/HTML and ranks candidates by public improvement first,
then mechanism quality.

Run the harder stress-test curricula:

```bash
node prototypes/adaptive-persona-mvp/scripts/run-variant-sweep.js \
  --hard \
  --conditions static_codex,controller_reflexive_psychodynamic_codex \
  --baseline static_codex \
  --repeats 1 \
  --out prototypes/adaptive-persona-mvp/outputs/hard-mode-live-triage \
  --timeout-ms 600000
```

Run the held-out hard curricula from the near/medium-term roadmap:

```bash
node prototypes/adaptive-persona-mvp/scripts/run-variant-sweep.js \
  --heldout \
  --learner codex \
  --conditions static_codex,controller_reflexive_psychodynamic_codex \
  --baseline static_codex \
  --repeats 1 \
  --out prototypes/adaptive-persona-mvp/outputs/heldout-hard-llm-live \
  --timeout-ms 600000
```

Evaluate whether saved live reports establish a robust positive effect:

```bash
node prototypes/adaptive-persona-mvp/scripts/evaluate-robustness.js \
  --inputs prototypes/adaptive-persona-mvp/outputs \
  --out prototypes/adaptive-persona-mvp/outputs/robustness-evaluation \
  --permutations 1000
```

For held-out curricula, add `--scenario-set heldout`.

Run the harder hidden-state trap curricula, where the visible opening is
deliberately insufficient and the tutor must elicit learner state before
committing to repair or transfer:

```bash
node prototypes/adaptive-persona-mvp/scripts/run-variant-sweep.js \
  --traps \
  --learner codex \
  --conditions static_codex,controller_reflexive_psychodynamic_codex \
  --baseline static_codex \
  --repeats 1 \
  --out prototypes/adaptive-persona-mvp/outputs/trap-scenarios-llm-live \
  --timeout-ms 600000
```

For trap-only robustness aggregation, use `--scenario-set traps`.

This robustness gate only treats LLM-learner, non-dry-run, full hard-curriculum
runs as eligible evidence. Focused one-scenario slices and rule-learner runs are
reported separately.

Hard mode uses longer, more adversarial learner trajectories with apparent
forgetfulness, skepticism toward the teacher, disinterest, and misconception
reversion. The blind judge prompt applies stricter caps when the tutor explains
correctly but fails to recover after those challenges.

The hard-mode controller now includes an explicit challenge-state observer. It
detects repeated challenge signals, merges a domain-specific directive into the
selected policy, and passes that directive through the Ego/Superego revision
loop. See `STATE_MACHINE_ADAPTATION.md`.

Dry-run mode is useful for checking the artifact shape without Codex calls:

```bash
node prototypes/adaptive-persona-mvp/scripts/run-rubric-comparison.js \
  --scenario fractions_denominator_size_closed_loop \
  --dry-run
```

## Replay Parent Stack Logs

The parent replay adapter is read-only. It selects existing parent
`evaluation_results` rows, loads their `logs/tutor-dialogues/*.json` traces,
normalizes learner turns, and runs those turns through the prototype
evidence/state/policy/challenge-state pipeline. It writes separate JSON, HTML,
and Markdown reports; it does not write to the parent DB or alter parent
scores.

```bash
node prototypes/adaptive-persona-mvp/scripts/replay-parent-stack.js \
  --run-id eval-2026-05-12-de6d48ab \
  --limit 12 \
  --out prototypes/adaptive-persona-mvp/outputs/parent-stack-replay
```

Useful alternatives:

```bash
node prototypes/adaptive-persona-mvp/scripts/replay-parent-stack.js --latest --limit 8
node prototypes/adaptive-persona-mvp/scripts/replay-parent-stack.js --dialogue-id <dialogue_id>
node prototypes/adaptive-persona-mvp/scripts/replay-parent-stack.js --inputs logs/tutor-dialogues/<dialogue_id>.json
```

The output compares parent policy actions with prototype policy labels by an
explicit compatibility map. Treat this as mechanism triage, not final scoring:
it tells us whether the prototype labels are informative on richer parent
dialogues before any parent-stack integration is attempted.

## MVP Hypotheses

H1. Evidence-bound KT improves over a single-shot learner profile when the learner gives mixed or ambiguous signals.

H2. Policy labels should diverge under counterfactual learner evidence before the final prose diverges. If only prose changes, the persona is decorative.

H3. Persona evolution should be bounded and policy-mediated. A frustrated learner may increase warmth and repair language; a correct advanced learner may increase challenge; neither should rewrite the tutor's identity.

H4. A good adaptive tutor asks for validation when state confidence is low, rather than personalizing confidently from thin evidence.

## Extension Path

The current code uses deterministic mock agents. To connect it to the existing repo later without contaminating the harness:

1. Replace `extractEvidence` and `recognizeState` with LLM calls governed by the prompt contracts.
2. Keep `updateMastery`, `transitionRelationState`, `selectPolicy`, and the evaluator in code.
3. Add an adapter that consumes existing adaptive dialogue logs as fixtures.
4. Only after the prototype produces stable counterfactual sensitivity, register a new production cell in `config/tutor-agents.yaml`.

## Sources

- https://arxiv.org/abs/2504.05570
- https://arxiv.org/abs/2409.16490
- https://arxiv.org/abs/2605.01097
- https://arxiv.org/abs/2512.23036
- https://arxiv.org/abs/2507.16252
- https://arxiv.org/abs/2508.01503
