# Adaptive Tutor Iteration Protocol

This protocol separates prompt exploration from evidence claims. The goal is
not to benchmax a single rubric; it is to find tutor configurations that show
public adaptive improvement and then inspect whether the improvement plausibly
comes from reflexive learner-state and memory mechanisms.

## Current Prototype TODO

Status started 2026-05-17 after the post-science-repair full rerun established
strict all-public-metric confirmation.

- [x] Push `5adeb9c` / the post-repair replicated result branch.
- [x] Inspect the two remaining adapted counterfactual misses for over-repair
  versus validator strictness.
- [x] Patch calibration so already-ready learners are certified and transferred
  rather than over-challenged.
- [x] Run compact causal ablations: full ego/superego/memory controller versus
  ego-only, no-memory, no-superego, no-challenge/escalation, and static
  baseline.
- [x] Replicate at a larger scale after the calibration patch, then add new
  disciplinary traps only after this benchmark remains stable.

Follow-up from the larger replication:

- [ ] Repair residual programming transfer failures where the learner can name
  the root cause but does not produce transcript-supported regression/transfer
  evidence.
- [ ] Repair residual social-measurement ready-branch failures where the learner
  does not explicitly reject the single-item validity shortcut.
- [ ] Improve parent-dialogue stability before claiming strict all-public-metric
  confirmation beyond the smaller post-science-repair run.

## Stage 1. Variant Sweep

Compare the static baseline, the non-reflexive controller, and all reflexive
variants in one report:

```bash
node prototypes/adaptive-persona-mvp/scripts/run-variant-sweep.js \
  --scenarios fractions_denominator_size_closed_loop,ai_bias_single_cause_closed_loop,stats_confounding_closed_loop \
  --conditions static_codex,controller_codex,controller_reflexive_codex,controller_reflexive_psychodynamic_codex,controller_reflexive_dialogical_codex \
  --baseline static_codex \
  --repeats 2 \
  --out prototypes/adaptive-persona-mvp/outputs/variant-sweep-live \
  --timeout-ms 600000
```

For cheap prompt iteration, do not pass `--deep-reflexive`. This keeps the
first live sweep focused on public adaptation:

- MVP adaptation rubric;
- parent dialogue rubric;
- outcome-task success.

The sweep report promotes a candidate when at least two public metrics have
positive mean paired differences and no public metric is worse by more than
five points. This is a triage rule, not a significance claim.

### Hard-Mode Sweep

Use hard mode when the baseline is scoring too highly on clean two-turn
misconception repair. Hard mode swaps in longer curricula where the learner
forgets, resists, shows disinterest, or distrusts the teacher:

```bash
node prototypes/adaptive-persona-mvp/scripts/run-variant-sweep.js \
  --hard \
  --conditions static_codex,controller_reflexive_psychodynamic_codex \
  --baseline static_codex \
  --repeats 1 \
  --out prototypes/adaptive-persona-mvp/outputs/hard-mode-live-triage \
  --timeout-ms 600000
```

Hard-mode scoring activates when a scenario has
`challenge_profile.mode = hard`. The blind judge prompt then applies the
addendum in `config/hard-adaptation-rubric.yaml`:

- a high score requires recovery after a visible learner challenge;
- correct explanation alone is capped when the learner does not perform;
- resistance and skepticism must be treated as testable evidence, not as
  disobedience;
- outcome success requires durable transfer under a harder task.

## Stage 2. Survivor Filtering

Only candidates with a public triage pass should move forward. If no target
passes, inspect the best weak signal, revise the variant prompt or memory
contract, and rerun Stage 1.

The runner writes a recommended candidate list to JSON/HTML. Prefer the top
candidate unless the trace shows a clear invalid mechanism, such as unsupported
learner diagnosis or an outcome-task artifact.

## Stage 3. Deep Mechanism Scoring

For the surviving candidate, rerun a one-target replicated comparison with
deep reflexive scoring enabled:

```bash
node prototypes/adaptive-persona-mvp/scripts/run-replicated-comparison.js \
  --scenarios fractions_denominator_size_closed_loop,ai_bias_single_cause_closed_loop,stats_confounding_closed_loop \
  --conditions static_codex,controller_reflexive_psychodynamic_codex \
  --baseline static_codex \
  --target controller_reflexive_psychodynamic_codex \
  --repeats 2 \
  --out prototypes/adaptive-persona-mvp/outputs/replicated-psychodynamic-deep-live \
  --timeout-ms 600000
```

This adds:

- parent deliberation-quality scoring of the Ego/Superego trace;
- psychodynamic adaptation scoring;
- target-only mechanism summaries.

Mechanism scores can explain a public improvement, but they do not replace it.
A high deliberation score with no public adaptation should be treated as a
theoretical trace, not as an adaptive tutor result.

## Stage 4. Statistical Confirmation

Run the surviving candidate against the static baseline with enough paired
observations to make the sign-flip test meaningful:

```bash
node prototypes/adaptive-persona-mvp/scripts/run-replicated-comparison.js \
  --scenarios fractions_denominator_size_closed_loop,ai_bias_single_cause_closed_loop,stats_confounding_closed_loop \
  --conditions static_codex,controller_reflexive_psychodynamic_codex \
  --baseline static_codex \
  --target controller_reflexive_psychodynamic_codex \
  --repeats 8 \
  --skip-deep-reflexive \
  --out prototypes/adaptive-persona-mvp/outputs/replicated-psychodynamic-confirm-live \
  --timeout-ms 600000
```

The public confirmation gate is:

```text
mean paired difference > 0
bootstrap 95% CI lower bound > 0
sign-flip permutation p < 0.05
```

Use `--skip-deep-reflexive` in this final public confirmation run unless the
mechanism scores themselves are the object of the experiment. Deep reflexive
judging is expensive and should be reserved for candidate interpretation.

For hard-mode confirmation, pass the hard scenario IDs explicitly:

```bash
node prototypes/adaptive-persona-mvp/scripts/run-replicated-comparison.js \
  --scenarios hard_fractions_forgetful_resistant_closed_loop,hard_ai_bias_resistant_closed_loop,hard_stats_confounding_skeptical_closed_loop \
  --conditions static_codex,controller_reflexive_psychodynamic_codex \
  --baseline static_codex \
  --target controller_reflexive_psychodynamic_codex \
  --repeats 4 \
  --skip-deep-reflexive \
  --out prototypes/adaptive-persona-mvp/outputs/hard-mode-confirm-live \
  --timeout-ms 600000
```

## Stage 5. Theory Notes

After a candidate passes or fails, write down:

- what learner evidence changed state;
- what state changed policy;
- what Ego draft was rejected or revised by Superego;
- what memory item carried across turns;
- what public learner behavior improved or failed to improve.

These notes are the bridge from engineering iteration to a later theoretical
account of reflexive adaptive tutors.
