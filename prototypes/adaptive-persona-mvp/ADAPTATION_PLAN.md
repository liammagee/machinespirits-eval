# Three-Part Adaptation Repair Plan

This note documents the post-baseline fix for the MVP controller. The disciplinary comparison showed that the controller had adaptation mechanics, but did not reliably improve learning outcomes over a strong static tutor prompt. The failure was concentrated in misconception-repair branches.

## 1. Domain-Specific Misconception Models

The controller now has a small explicit misconception model for each non-philosophy curriculum slice:

- `compare_unit_fractions`: larger-denominator-means-larger-piece.
- `ai_bias_causal_diagnosis`: bias comes from one explicit sensitive attribute.
- `causal_inference_confounding`: correlation is treated as causation.

Each model specifies:

- misconception markers;
- success markers;
- repair markers;
- a required repair action template.

Implementation: `src/domainMisconceptions.js`.

The evidence extractor attaches `domainDiagnosis` to each learner event. This makes the controller reason about the learner's actual disciplinary misconception instead of only seeing generic labels like `partial` or `incorrect`.

## 2. Stronger Policy/Action Templates

The controller now has a `misconception_repair` policy. When a domain misconception is active, the selected policy carries an `actionTemplate` with:

- `mustDo`;
- `mustAvoid`;
- `messageFrame`;
- `successCheck`.

The Codex tutor prompt treats this template as binding. The LLM can choose wording, but it must satisfy the repair contract and cannot jump to transfer, summary, or generic encouragement.

Implementation:

- `src/stateMachine.js` selects `misconception_repair` and attaches the template.
- `src/codexPrompts.js` makes the template binding for Codex.
- `src/personaEngine.js` uses the same template for deterministic fallback and dry-run verification.

## 3. Outcome-Gated Controller

The controller now computes an `outcomeGate` for each evidence event:

- `repair_required`: a domain misconception is active; transfer and summary are blocked.
- `verify_before_transfer`: evidence is not enough for transfer; ask for diagnostic work or teach-back.
- `open`: learner supplied visible success evidence; transfer is allowed.

This prevents the old failure mode where the controller moved from a partial misconception to a polished but shallow next move. The gate is stored in the policy object and appears in the trace, making it inspectable by tests and later rubric analysis.

Implementation: `buildOutcomeGate()` in `src/stateMachine.js`.

## Acceptance Checks

The minimum deterministic acceptance check is:

```bash
node --test prototypes/adaptive-persona-mvp/tests/*.test.js
```

The disciplinary dry-run check should show each original misconception branch following:

```text
misconception_repair -> transfer_challenge
```

with `outcomeTask.success = true`.

Live Codex evaluation remains stochastic and slower. The live test to run after code changes is:

```bash
node prototypes/adaptive-persona-mvp/scripts/run-rubric-comparison.js \
  --scenarios fractions_denominator_size_closed_loop,ai_bias_single_cause_closed_loop,stats_confounding_closed_loop \
  --learner rule \
  --out outputs/rubric-comparison-disciplinary-live \
  --timeout-ms 600000
```

## What This Does Not Solve Yet

This does not prove human learning. It only raises the bar for synthetic adaptation: the controller must repair the named misconception and collect visible success evidence before advancing. The next promotion gate would be replaying real dialogue logs and replacing deterministic misconception labels with an LLM evidence extractor that matches hand labels on a small set.

## Reflexive Ego/Superego Variant

The next variant is `controller_reflexive_codex`, documented in
`config/reflexive-multiagent.yaml`.

This variant follows the user's Drama Machine / Geist direction:

1. Ego drafts a learner-facing message from policy, persona, learner evidence,
   and reflexive memory.
2. Superego critiques the draft backstage against the full action template,
   outcome gate, and domain misconception diagnosis.
3. Ego revises the final learner-facing message.
4. Reflexive memory carries the Superego's current focus into the next turn.

The design deliberately does not let the Superego speak directly to the learner.
It is an internal critic. The final tutor voice remains a single coherent Ego,
but the trace records whether the internal conflict produced a real revision.

Run it with:

```bash
node prototypes/adaptive-persona-mvp/scripts/run-rubric-comparison.js \
  --scenarios fractions_denominator_size_closed_loop,ai_bias_single_cause_closed_loop,stats_confounding_closed_loop \
  --conditions controller_codex,controller_reflexive_codex \
  --out outputs/rubric-comparison-reflexive-live \
  --timeout-ms 600000
```

## Psychodynamic Reflexive Variants

The next iteration adds named reflexive variants rather than treating
Ego/Superego as one prompt:

- `controller_reflexive_codex`: standard backstage critique focused on
  misconception repair, premature transfer, and generic tutoring moves.
- `controller_reflexive_psychodynamic_codex`: adds tutor-side defense
  recognition: rescue fantasy, projection of mastery, punitive challenge,
  compliance collusion, and shame amplification.
- `controller_reflexive_dialogical_codex`: adds dialogical memory for shared
  ground, unrecognized learner claims, and recognition failures.

The implementation maps these condition names to variant directives in
`src/reflexiveVariants.js`. The variant changes:

- Ego draft instructions;
- Superego risk vocabulary;
- revision obligations;
- durable memory fields carried across turns.

The psychodynamic variant is not allowed to expose psychodynamic labels to the
learner. The final tutor move must translate internal conflict into observable
learner agency: asking for work, preserving difficulty, and repairing a
misread without lecture or diagnosis.

### Reflexive Deep Analysis

The comparison report scores visible tutoring behavior. The deeper question is
whether the internal Ego/Superego loop is doing real work. The prototype now has
`scripts/analyze-reflexive-report.js`, which consumes an existing reflexive JSON
report and adds:

- parent deliberation-quality scoring;
- revision distance from Ego draft to Ego revision;
- Superego risk taxonomy counts;
- repair-gate and action-template usage;
- cross-turn reflexive-memory movement;
- an HTML view of Ego draft -> Superego critique -> Ego revision -> memory.

Run:

```bash
node prototypes/adaptive-persona-mvp/scripts/analyze-reflexive-report.js \
  --input prototypes/adaptive-persona-mvp/outputs/rubric-comparison-reflexive-live/rubric-comparison-2026-05-15T00-02-58-459Z.json \
  --out prototypes/adaptive-persona-mvp/outputs/reflexive-deep-analysis \
  --timeout-ms 600000
```

The deep analysis also applies
`config/psychodynamic-adaptation-rubric.yaml` unless
`--skip-psychodynamic` is passed. That rubric deliberately widens the scoring
space beyond the parent dialogue rubric:

- defense recognition;
- evidence-bound psychodynamic inference;
- repair debt tracking;
- learner agency preservation;
- revision transformation;
- public dialogue translation.

## Statistical Acceptance Gate

The prototype should not claim adaptation from a single attractive trace. The
replicated runner in `scripts/run-replicated-comparison.js` treats each
scenario branch as a paired observation between a baseline and target condition.
It reports:

- mean paired score difference;
- bootstrap 95% confidence interval;
- sign-flip permutation p-value;
- Cohen dz;
- win/tie/loss rates.

The current conservative pass condition is:

```text
mean paired difference > 0
bootstrap 95% CI lower bound > 0
sign-flip permutation p < 0.05
```

This is intentionally stricter than benchmaxxing a single rubric. Public
adaptation is tested on MVP adaptation, parent dialogue, and outcome success.
Reflexive mechanism quality is summarized separately with deliberation and
psychodynamic rubric scores, because static baselines do not have an internal
Ego/Superego trace.

## Staged Search-And-Confirm Workflow

The working protocol now lives in `ITERATION_PROTOCOL.md`. The operational
sequence is:

1. Run `scripts/run-variant-sweep.js` without deep reflexive judges to compare
   public adaptation across all variants.
2. Promote only candidates with positive public movement on at least two of
   MVP adaptation, parent dialogue, and outcome success, with no large public
   regression.
3. Rerun the survivor with deep reflexive scoring to inspect deliberation and
   psychodynamic mechanism quality.
4. Run the survivor with `--repeats 8 --skip-deep-reflexive` for public
   statistical confirmation.
5. Convert the resulting traces into theory notes: evidence -> state -> policy
   -> Ego/Superego revision -> memory -> public learner behavior.

This workflow keeps the prototype honest: mechanism-rich traces are useful, but
only public adaptive improvement can promote a tutor variant.

## Challenge-State Extension

The hard-mode triage showed that outcome gates and reflexive critique were not
enough when the learner repeatedly resisted or forgot. The controller now adds
a finite challenge-state observer before relation-state transition:

```text
learner evidence -> KT/domain diagnosis -> challenge_state -> relation_state
-> policy/action template -> persona -> Ego draft -> Superego critique
-> Ego revision -> public tutor message
```

Implementation: `src/challengeState.js` plus the integration points in
`src/assessmentHarness.js`, `src/stateMachine.js`, `src/personaEngine.js`,
`src/codexPrompts.js`, and `src/reflexivePrompts.js`.

The practical rule is simple: after resistance, forgetfulness, skepticism,
disinterest, or misconception reversion, the tutor must change strategy. For
statistics this means anchoring the repair with the terms `confounder` or
`third variable`, the concrete cue `winter versus summer`, and a request for a
matched, controlled, or randomized comparison before transfer. The tutor should
not name heat, weather, water exposure, or swimming before the learner generates
the confounder.

Full mechanism documentation: `STATE_MACHINE_ADAPTATION.md`.
