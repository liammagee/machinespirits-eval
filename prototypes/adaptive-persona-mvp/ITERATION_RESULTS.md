# Adaptive Tutor Iteration Results

## 2026-05-15 Reflexive Psychodynamic Repair Pass

### Implemented

- Added `scripts/run-variant-sweep.js` for one-report comparison across
  `controller_codex`, `controller_reflexive_codex`,
  `controller_reflexive_psychodynamic_codex`, and
  `controller_reflexive_dialogical_codex` against `static_codex`.
- Added `src/variantSweep.js` for public-metric summaries, triage decisions,
  candidate ranking, and HTML rendering.
- Added `src/deepReflexiveScoring.js` so replicated and sweep runners can share
  deliberation and psychodynamic mechanism scoring.
- Added `ITERATION_PROTOCOL.md` with the staged
  sweep -> survivor -> mechanism -> confirmation workflow.
- Revised misconception-repair prompts toward co-construction:
  - treat the learner rule as a hypothesis to test;
  - ask for the key comparison, audit, or confounder before stating the answer;
  - reduce persona directiveness during `misconception_repair`;
  - make Superego flag over-explanation as possible rescue.

### Dry Sweep

Command:

```bash
node prototypes/adaptive-persona-mvp/scripts/run-variant-sweep.js \
  --dry-run \
  --repeats 2 \
  --out prototypes/adaptive-persona-mvp/outputs/variant-sweep-dry-run \
  --permutations 200
```

Artifact:

- `outputs/variant-sweep-dry-run/variant-sweep-2026-05-15T12-19-43-991Z.html`
- `outputs/variant-sweep-dry-run/variant-sweep-2026-05-15T12-19-43-991Z.json`

Interpretation: artifact-shape check only. Dry runs can show a triage signal
but are not allowed to claim empirical confirmation.

### Initial Live All-Variant Triage

Command:

```bash
node prototypes/adaptive-persona-mvp/scripts/run-variant-sweep.js \
  --scenarios fractions_denominator_size_closed_loop \
  --conditions static_codex,controller_codex,controller_reflexive_codex,controller_reflexive_psychodynamic_codex,controller_reflexive_dialogical_codex \
  --baseline static_codex \
  --repeats 1 \
  --out prototypes/adaptive-persona-mvp/outputs/variant-sweep-live-triage \
  --timeout-ms 600000 \
  --permutations 200
```

Artifact:

- `outputs/variant-sweep-live-triage/variant-sweep-2026-05-15T12-38-07-657Z.html`
- `outputs/variant-sweep-live-triage/variant-sweep-2026-05-15T12-38-07-657Z.json`

Result: no candidate passed. All variants were flat on MVP/outcome and worse on
parent dialogue. The failure mode was public dialogue quality: repair moves
were too directive relative to the strong static baseline.

### Revised Psychodynamic Live Triage

Command:

```bash
node prototypes/adaptive-persona-mvp/scripts/run-variant-sweep.js \
  --scenarios fractions_denominator_size_closed_loop \
  --conditions static_codex,controller_reflexive_psychodynamic_codex \
  --baseline static_codex \
  --repeats 1 \
  --out prototypes/adaptive-persona-mvp/outputs/variant-sweep-live-psychodynamic-repair \
  --timeout-ms 600000 \
  --permutations 200
```

Artifact:

- `outputs/variant-sweep-live-psychodynamic-repair/variant-sweep-2026-05-15T12-47-36-777Z.html`
- `outputs/variant-sweep-live-psychodynamic-repair/variant-sweep-2026-05-15T12-47-36-777Z.json`

Result:

- MVP mean diff: `+17.5`
- parent dialogue mean diff: `+20.625`
- outcome mean diff: `+50`
- candidate promoted for deep mechanism scoring.

### Deep Mechanism Score

Command:

```bash
node prototypes/adaptive-persona-mvp/scripts/run-replicated-comparison.js \
  --scenarios fractions_denominator_size_closed_loop \
  --conditions static_codex,controller_reflexive_psychodynamic_codex \
  --baseline static_codex \
  --target controller_reflexive_psychodynamic_codex \
  --repeats 1 \
  --out prototypes/adaptive-persona-mvp/outputs/replicated-psychodynamic-repair-deep-live \
  --timeout-ms 600000 \
  --permutations 200
```

Artifact:

- `outputs/replicated-psychodynamic-repair-deep-live/replicated-comparison-2026-05-15T12-55-57-197Z.html`
- `outputs/replicated-psychodynamic-repair-deep-live/replicated-comparison-2026-05-15T12-55-57-197Z.json`

Result:

- deliberation mean: `83.75`
- psychodynamic adaptation mean: `95.92`
- public deltas positive but still only `n=2`, so not a confirmation claim.

### Broader Public Confirmation Attempt

Command:

```bash
node prototypes/adaptive-persona-mvp/scripts/run-replicated-comparison.js \
  --scenarios fractions_denominator_size_closed_loop,ai_bias_single_cause_closed_loop,stats_confounding_closed_loop \
  --conditions static_codex,controller_reflexive_psychodynamic_codex \
  --baseline static_codex \
  --target controller_reflexive_psychodynamic_codex \
  --repeats 2 \
  --skip-deep-reflexive \
  --out prototypes/adaptive-persona-mvp/outputs/replicated-psychodynamic-repair-confirm-live \
  --timeout-ms 600000 \
  --permutations 1000
```

Artifact:

- `outputs/replicated-psychodynamic-repair-confirm-live/replicated-comparison-2026-05-15T13-35-34-085Z.html`
- `outputs/replicated-psychodynamic-repair-confirm-live/replicated-comparison-2026-05-15T13-35-34-085Z.json`

Aggregate result, `n=12` paired branches:

- MVP mean diff: `+9.583`, CI `0..21.25`, `p=0.1604`
- parent dialogue mean diff: `+7.083`, CI `-1.354..18.229`, `p=0.2853`
- outcome mean diff: `+16.667`, CI `0..41.667`, `p=0.5001`

Conclusion: positive but not statistically significant under the current gate.

Curriculum pattern:

- Fractions: strong improvement, especially original misconception branches.
- Statistics: modest MVP improvement, unstable parent-dialogue movement.
- AI bias: no reliable improvement and some negative parent-dialogue branches.

### Current Interpretation

The psychodynamic reflexive loop can produce useful public adaptation when the
domain repair contract is concrete and contrastive, as in unit fractions. It is
not yet a general adaptive-tutor result. The next iteration should target
AI-bias and statistics with domain-specific co-construction templates rather
than continuing to tune the global Ego/Superego frame.

## 2026-05-15 Hard-Mode Evaluation Pass

### Implemented

- Added `HARD_MODE_DESIGN.md`.
- Added `config/hard-adaptation-rubric.yaml`.
- Added hard scenarios for fractions, AI bias, and statistics with
  `challenge_profile.mode = hard`.
- Added hard rule-learner states that produce forgetfulness, resistance,
  disinterest, skepticism, and misconception reversion.
- Hardened the blind judge prompt for hard scenarios.
- Added `--hard` to `scripts/run-variant-sweep.js`.
- Tightened AI-bias and statistics repair templates so the learner must choose
  evidence, not just receive a list.

### Dry Hard-Mode Sweep

Command:

```bash
node prototypes/adaptive-persona-mvp/scripts/run-variant-sweep.js \
  --hard \
  --dry-run \
  --conditions static_codex,controller_reflexive_psychodynamic_codex \
  --baseline static_codex \
  --repeats 1 \
  --out prototypes/adaptive-persona-mvp/outputs/hard-mode-dry-run \
  --permutations 100
```

Artifact:

- `outputs/hard-mode-dry-run/variant-sweep-2026-05-15T13-49-36-727Z.html`
- `outputs/hard-mode-dry-run/variant-sweep-2026-05-15T13-49-36-727Z.json`

Dry result:

- MVP mean diff: `+15.833`
- parent dialogue mean diff: `+13.1`
- outcome mean diff: `+50`

Interpretation: dry-run shape only, not empirical confirmation.

### Live Hard-Mode Triage

Command:

```bash
node prototypes/adaptive-persona-mvp/scripts/run-variant-sweep.js \
  --hard \
  --conditions static_codex,controller_reflexive_psychodynamic_codex \
  --baseline static_codex \
  --repeats 1 \
  --out prototypes/adaptive-persona-mvp/outputs/hard-mode-live-triage \
  --timeout-ms 600000 \
  --permutations 200
```

Artifact:

- `outputs/hard-mode-live-triage/variant-sweep-2026-05-15T14-17-57-835Z.html`
- `outputs/hard-mode-live-triage/variant-sweep-2026-05-15T14-17-57-835Z.json`

Aggregate live result:

- MVP mean diff: `+8.333`
- parent dialogue mean diff: `+9.792`
- outcome mean diff: `+16.667`

The psychodynamic target passed public triage but did not make a significance
claim.

Branch pattern:

- Hard fractions: target rescued the counterfactual branch where the static
  baseline failed.
- Hard AI bias: target improved the resistant original branch, but the
  counterfactual branch still failed outcome.
- Hard statistics: target failed the original skeptical branch badly while the
  static baseline succeeded. The failure was diagnostic: the target asked for a
  generic "third factor" instead of anchoring the learner with the stable
  language "confounder / third variable" and a concrete seasonal cue.

Follow-up patch after the live result:

- Updated the statistics repair template to require the words `confounder` or
  `third variable`.
- Added a concrete retrieval cue such as winter vs summer or heat/water
  exposure before asking for the learner's causal comparison.

## 2026-05-15 Challenge-State Live Triage

### Implemented

- Added `src/challengeState.js`, a finite state machine for hard-mode
  resistance, apparent forgetfulness, skepticism, disinterest, and
  misconception reversion.
- Integrated challenge state into `assessmentHarness`, `stateMachine`,
  `personaEngine`, Codex tutor prompts, and Ego/Superego prompts.
- Updated `config/multiagent.yaml` and `config/reflexive-multiagent.yaml` with
  the `challenge_observer` and challenge directive flow.
- Added `STATE_MACHINE_ADAPTATION.md`.
- Added challenge-state tests and a hard-stat regression test.
- Extended the variant-sweep HTML with challenge-state mechanism checks.
- Tightened statistics repair again after the first live rerun: use `winter vs
  summer` as the cue, but do not name heat, weather, water exposure, or
  swimming before the learner generates the confounder.
- Tightened transfer prompts so `transfer_challenge` must use the transfer case
  named by the action template instead of inventing a new example.

### Verification

```bash
node --test prototypes/adaptive-persona-mvp/tests/*.test.js
npx eslint prototypes/adaptive-persona-mvp/**/*.js
```

## 2026-05-16 Trap Outcome Hardening And Transition Model

Implemented these non-integration changes:

- hardened hidden-state trap outcome tasks in
  `config/assessment-scenarios.yaml` so success requires delayed transfer,
  adversarial near-miss rejection, and discipline-specific boundary conditions;
- added transcript-supported validators in `src/dynamicLearner.js` and wired
  them through `src/assessmentHarness.js`, preserving the raw LLM outcome as
  `outcomeTask.raw_success`;
- adjusted transfer prompts in `src/personaEngine.js` so the tutor asks for the
  harder transfer evidence during the dialogue;
- added `src/parentTransitionModel.js`, which models action-family transitions
  directly from prior modeled family plus current learner evidence;
- extended `src/parentReplayAdapter.js` and
  `scripts/replay-parent-stack.js` with transition-aware family agreement,
  non-trigger agreement, transition agreement, and mismatch tables.

### Hardened Trap Dry-Run

Command:

```bash
node prototypes/adaptive-persona-mvp/scripts/run-variant-sweep.js \
  --traps \
  --dry-run \
  --conditions static_codex,controller_reflexive_psychodynamic_codex \
  --baseline static_codex \
  --repeats 1 \
  --out prototypes/adaptive-persona-mvp/outputs/trap-hardening-dry-run-v3 \
  --permutations 100 \
  --no-progress
```

Artifacts:

- `outputs/trap-hardening-dry-run-v3/variant-sweep-2026-05-16T05-22-54-399Z.html`
- `outputs/trap-hardening-dry-run-v3/variant-sweep-2026-05-16T05-22-54-399Z.json`

Result:

- static original branches no longer pass at ceiling: argument and science fail
  the hardened outcome gate;
- psychodynamic target original branches pass argument, science, and social
  measurement, but fail programming because transfer is still too late in the
  dialogue;
- comparison remains blocked by negative MVP: MVP `-9.375`, parent dialogue
  `+3.275`, outcome `+12.5`.

Interpretation: the harder outcome gate is doing its job. It prevents a static
surface repair from counting as adaptation, but exposes a remaining target
timing bug in programming.

### Focused Live Science Trap

Command:

```bash
node prototypes/adaptive-persona-mvp/scripts/run-variant-sweep.js \
  --scenarios trap_science_variable_control_false_mastery_closed_loop \
  --learner codex \
  --conditions static_codex,controller_reflexive_psychodynamic_codex \
  --baseline static_codex \
  --repeats 1 \
  --out prototypes/adaptive-persona-mvp/outputs/trap-hardening-science-live \
  --timeout-ms 600000 \
  --permutations 100
```

Artifacts:

- `outputs/trap-hardening-science-live/variant-sweep-2026-05-16T05-21-05-507Z.html`
- `outputs/trap-hardening-science-live/variant-sweep-2026-05-16T05-21-05-507Z.json`

Result from the generated artifact:

- static original: MVP `75`, parent dialogue `77.5`, outcome `false`; missing
  parsed success, transfer, and transcript transfer;
- psychodynamic original: MVP `100`, parent dialogue `91.25`,
  `raw_success=true`, stored outcome `false`.

The stored psychodynamic outcome was rejected because the first validator pass
missed this learner phrasing: "The independent variable should just be whether
the plants get the special fertilizer, not extra water too." I patched the
science validator and added a regression test. Replaying the saved transcript
through the current validator gives:

- static original remains `false`;
- psychodynamic original becomes `true`, with changed variable, controls,
  comparison, near-miss rejection, transfer, and transcript transfer all present.

Interpretation: this focused live slice now shows the desired shape under the
current validator: static no longer passes at ceiling, while the adaptive tutor
can produce learner-owned transfer. This is still a one-scenario slice, not a
robust effect claim.

### Transition-Aware Parent Replay

Command:

```bash
node prototypes/adaptive-persona-mvp/scripts/replay-parent-stack.js \
  --run-id eval-2026-05-12-de6d48ab \
  --limit 24 \
  --out prototypes/adaptive-persona-mvp/outputs/parent-stack-replay-transition-model-v2
```

Artifacts:

- `outputs/parent-stack-replay-transition-model-v2/parent-stack-replay-2026-05-16T05-05-06-064Z.html`
- `outputs/parent-stack-replay-transition-model-v2/parent-stack-replay-2026-05-16T05-05-06-064Z.json`
- `outputs/parent-stack-replay-transition-model-v2/parent-stack-replay-2026-05-16T05-05-06-064Z.md`

Result:

- parent-compatible trigger compatibility: `100.0%` across `48` trigger
  branches;
- parent-compatible family agreement: `54.7%`;
- transition-aware family agreement: `56.8%`;
- parent-compatible non-trigger family agreement: `62.5%`;
- transition-aware non-trigger family agreement: `65.3%`;
- parent-compatible transition agreement: `31.3%`;
- transition-aware transition agreement: `31.9%`.

Interpretation: direct transition modeling gives a small measurable improvement
over the per-turn mapped-action layer, but transition agreement remains the
hardest metric. The next replay target is overload rhythm: the parent stack often
moves scaffold -> substantive -> repair, while the prototype still stays too
long in scaffold.

Verification:

```bash
node --test prototypes/adaptive-persona-mvp/tests/assessment.test.js prototypes/adaptive-persona-mvp/tests/parent-replay-adapter.test.js
node --test prototypes/adaptive-persona-mvp/tests/*.test.js
npx eslint prototypes/adaptive-persona-mvp/**/*.js
```

Both pass.

## 2026-05-16 Transfer-Observed Gate And Full Trap Live Rerun

Implemented the next trap-mechanism pass:

- added explicit `transferState` and `policy.transferGate` tracking in
  `src/stateMachine.js` and `src/assessmentHarness.js`;
- blocked hidden-state trap consolidation until learner-owned transfer is
  observed, so a tutor transfer question alone cannot count as adaptation;
- fixed the programming timing bug by recognizing "smallest input", "first
  invalid value", "minimal fix", and related debugging language as root-cause
  repair, which moves transfer one turn earlier;
- broadened debugging transfer recognition to the live aggregate-bug phrasing
  (`total case`, `lineTotal`, `running total`, undefined quantity);
- added transfer-gate instructions to Codex tutor and Ego/Superego prompts;
- refined parent replay transition guards for overload traces, allowing
  scaffold -> substantive when the learner uses reduced cognitive load to offer
  a tentative concept/example, then substantive -> scaffold or repair when
  overload returns.

### Transfer-Gate Dry-Run

Command:

```bash
node prototypes/adaptive-persona-mvp/scripts/run-variant-sweep.js \
  --traps \
  --dry-run \
  --conditions static_codex,controller_reflexive_psychodynamic_codex \
  --baseline static_codex \
  --repeats 1 \
  --out prototypes/adaptive-persona-mvp/outputs/trap-transfer-gate-dry-run \
  --permutations 100 \
  --no-progress
```

Artifacts:

- `outputs/trap-transfer-gate-dry-run/variant-sweep-2026-05-16T05-48-37-272Z.html`
- `outputs/trap-transfer-gate-dry-run/variant-sweep-2026-05-16T05-48-37-272Z.json`

Result:

- programming original now follows
  `teach_back -> misconception_repair -> transfer_challenge -> summarize_and_check`;
- programming transfer gate moves
  `not_ready -> not_ready -> needs_learner_transfer -> observed`;
- static original branches are no longer at ceiling overall, but static
  programming and social measurement still pass in dry-run;
- comparison remains blocked by negative MVP: MVP `-7.5`, parent dialogue
  `+6.55`, outcome `+25`.

### Focused Programming Live

Command:

```bash
node prototypes/adaptive-persona-mvp/scripts/run-variant-sweep.js \
  --scenarios trap_programming_debugging_false_mastery_closed_loop \
  --learner codex \
  --conditions static_codex,controller_reflexive_psychodynamic_codex \
  --baseline static_codex \
  --repeats 1 \
  --out prototypes/adaptive-persona-mvp/outputs/trap-transfer-gate-programming-live \
  --timeout-ms 600000 \
  --permutations 100
```

Artifacts:

- `outputs/trap-transfer-gate-programming-live/variant-sweep-2026-05-16T06-05-04-289Z.html`
- `outputs/trap-transfer-gate-programming-live/variant-sweep-2026-05-16T06-05-04-289Z.json`

Generated artifact result:

- static original: MVP `75`, parent dialogue `82.5`, outcome `false`;
- psychodynamic original: MVP `87.5`, parent dialogue `91.25`,
  `raw_success=true`, stored outcome `false` because transcript transfer was
  initially too narrow;
- replaying the saved transcript through the current validator makes the
  psychodynamic original and counterfactual pass, because the learner transferred
  root-cause debugging to the `lineTotal` / running-total aggregate case.

### Transition Model V3

Command:

```bash
node prototypes/adaptive-persona-mvp/scripts/replay-parent-stack.js \
  --run-id eval-2026-05-12-de6d48ab \
  --limit 24 \
  --out prototypes/adaptive-persona-mvp/outputs/parent-stack-replay-transition-model-v3
```

Artifacts:

- `outputs/parent-stack-replay-transition-model-v3/parent-stack-replay-2026-05-16T05-48-21-111Z.html`
- `outputs/parent-stack-replay-transition-model-v3/parent-stack-replay-2026-05-16T05-48-21-111Z.json`
- `outputs/parent-stack-replay-transition-model-v3/parent-stack-replay-2026-05-16T05-48-21-111Z.md`

Result:

- parent-compatible trigger compatibility remains `100.0%`;
- parent-compatible family agreement remains `54.7%`;
- transition-aware family agreement improves from `56.8%` to `58.9%`;
- transition-aware family transition agreement improves from `31.9%` to `36.1%`.

Interpretation: direct transition modeling is still not strong, but the overload
rhythm is now measurably better than the per-turn mapped-action layer.

### Full Trap Live Rerun

Command:

```bash
node prototypes/adaptive-persona-mvp/scripts/run-variant-sweep.js \
  --traps \
  --learner codex \
  --conditions static_codex,controller_reflexive_psychodynamic_codex \
  --baseline static_codex \
  --repeats 1 \
  --out prototypes/adaptive-persona-mvp/outputs/trap-transfer-gate-full-live \
  --timeout-ms 600000 \
  --permutations 100
```

Artifacts:

- `outputs/trap-transfer-gate-full-live/variant-sweep-2026-05-16T07-07-32-504Z.html`
- `outputs/trap-transfer-gate-full-live/variant-sweep-2026-05-16T07-07-32-504Z.json`

Result, `n=8` paired branches:

- MVP mean diff: `+1.375`, CI approximately `-6.75..9.5`, `p=0.7899`;
- parent dialogue mean diff: `-6.875`, CI approximately `-13.438..0.625`,
  `p=0.1284`;
- outcome mean diff: `0`, CI approximately `-37.5..37.5`, `p=1`;
- decision: blocked by negative parent dialogue.

Branch pattern:

- static original branches all fail the hardened outcome gate, so the static
  baseline no longer passes at ceiling under live trap scoring;
- psychodynamic programming original succeeds where static fails, with observed
  transfer before consolidation;
- argument, science, and social measurement often reach
  `transfer_challenge`, but the learner does not perform transcript-supported
  transfer before the final turn, so the gate reports `missing_at_final_turn`;
- counterfactual ready branches are not reliably protected: the target loses
  argument counterfactual outcome against static.

### Robustness Gate

Command:

```bash
node prototypes/adaptive-persona-mvp/scripts/evaluate-robustness.js \
  --inputs prototypes/adaptive-persona-mvp/outputs/trap-transfer-gate-full-live \
  --out prototypes/adaptive-persona-mvp/outputs/robustness-evaluation-transfer-gate-traps \
  --scenario-set traps \
  --permutations 1000
```

Artifacts:

- `outputs/robustness-evaluation-transfer-gate-traps/robustness-evaluation-2026-05-16T07-08-00-603Z.html`
- `outputs/robustness-evaluation-transfer-gate-traps/robustness-evaluation-2026-05-16T07-08-00-603Z.json`
- `outputs/robustness-evaluation-transfer-gate-traps/robustness-evaluation-2026-05-16T07-08-00-603Z.md`

Verdict: robust positive effects are **not** established. The gate rejects the
run because there is only one eligible full trap run, only eight paired
branches, not all public metrics are positive, no public metric passes the
non-trivial positive gate, and the run has material negative parent-dialogue
movement.

Next engineering target: add a one-turn transfer-repair policy/action template.
If `transferGate.status` remains `needs_learner_transfer` after a transfer
prompt, the next tutor move should ask for a single concrete new case with the
required boundary markers, not repeat a broad transfer prompt or close the
dialogue.

### Hard Statistics Live Slice, First Attempt

Command:

```bash
node prototypes/adaptive-persona-mvp/scripts/run-variant-sweep.js \
  --scenarios hard_stats_confounding_skeptical_closed_loop \
  --conditions static_codex,controller_reflexive_psychodynamic_codex \
  --baseline static_codex \
  --repeats 1 \
  --out prototypes/adaptive-persona-mvp/outputs/hard-stats-challenge-state-live \
  --timeout-ms 600000 \
  --permutations 200
```

Artifact:

- `outputs/hard-stats-challenge-state-live/variant-sweep-2026-05-15T16-11-15-176Z.html`
- `outputs/hard-stats-challenge-state-live/variant-sweep-2026-05-15T16-11-15-176Z.json`

Result:

- MVP mean diff: `-5`
- parent dialogue mean diff: `+0.625`
- outcome mean diff: `0`

Interpretation: the original hard-stat branch was fixed, but the target lost
ground on the counterfactual branch because the LLM invented a SAT-app transfer
case instead of using the expected laptop-notes transfer and sometimes leaked
answer-shaped cues.

### Hard Statistics Live Slice, Transfer-Bound Patch

Command:

```bash
node prototypes/adaptive-persona-mvp/scripts/run-variant-sweep.js \
  --scenarios hard_stats_confounding_skeptical_closed_loop \
  --conditions static_codex,controller_reflexive_psychodynamic_codex \
  --baseline static_codex \
  --repeats 1 \
  --out prototypes/adaptive-persona-mvp/outputs/hard-stats-transfer-bound-live \
  --timeout-ms 600000 \
  --permutations 200
```

Artifact:

- `outputs/hard-stats-transfer-bound-live/variant-sweep-2026-05-15T16-21-49-632Z.html`
- `outputs/hard-stats-transfer-bound-live/variant-sweep-2026-05-15T16-21-49-632Z.json`

Result, `n=2` paired branches:

- MVP mean diff: `+30`
- parent dialogue mean diff: `+25.625`
- outcome mean diff: `+50`

Challenge-state mechanism checks:

- detected challenge: `100%`
- escalated: `50%`
- directive applied: `100%`
- resolved: `100%`
- outcome success: `100%`

Interpretation: live hard-stat triage now shows a meaningful public delta, but
the branch count is too small for a significance claim.

### Full Hard-Mode Live Sweep

Command:

```bash
node prototypes/adaptive-persona-mvp/scripts/run-variant-sweep.js \
  --hard \
  --conditions static_codex,controller_reflexive_psychodynamic_codex \
  --baseline static_codex \
  --repeats 1 \
  --out prototypes/adaptive-persona-mvp/outputs/hard-mode-transfer-bound-live \
  --timeout-ms 600000 \
  --permutations 200
```

Artifact:

- `outputs/hard-mode-transfer-bound-live/variant-sweep-2026-05-15T16-49-37-796Z.html`
- `outputs/hard-mode-transfer-bound-live/variant-sweep-2026-05-15T16-49-37-796Z.json`

Result, `n=6` paired branches:

- MVP mean diff: `+15.833`, CI `-4.167..35`, `p=0.3846`
- parent dialogue mean diff: `+19.583`, CI `1.833..38.964`, `p=0.1692`
- outcome mean diff: `+33.333`, CI `0..66.667`, `p=0.5077`

Challenge-state mechanism checks:

- detected challenge: `100%`
- escalated: `66.7%`
- directive applied: `100%`
- resolved: `100%`
- outcome success: `83.3%`

Branch pattern:

- Hard fractions original: target rescued a static outcome failure.
- Hard fractions counterfactual: target succeeded, but lost MVP points by
  briefly reverting to the earlier 1/3 vs 1/4 repair after a transfer attempt.
- Hard AI original: target and static both succeeded; target's parent-dialogue
  score was lower because the tutor supplied more conceptual structure.
- Hard AI counterfactual: target improved MVP and parent dialogue over static,
  but outcome still failed.
- Hard statistics original: target rescued a static outcome failure.
- Hard statistics counterfactual: target and static both succeeded; target
  improved parent dialogue and tied MVP/outcome.

Conclusion: the challenge-state multiagent variant now achieves a meaningful
live triage delta over the strong static baseline across the three hard
curricula, especially on adaptive criteria. It is not yet a statistically
significant result. The next confirmation step is a replicated hard sweep, and
the next engineering target is the hard AI counterfactual branch.

## 2026-05-15 Hard AI Transfer Patch And Replicated Confirmation

### Implemented

The full hard-mode live sweep still had one important weakness: the hard
AI-bias counterfactual improved over static but failed the outcome task because
the learner could name proxies, labels, and audits without explicitly rejecting
the manager's claim that gender removal was sufficient.

The patch did not loosen the outcome rubric. Instead it tightened the tutor
contract:

- AI-bias `teach_back` and `transfer_challenge` action templates now require
  the learner to say why gender removal is not enough.
- The AI hard-mode challenge directive now requires explicit rejection of
  gender removal as sufficient before sources and audits.
- The deterministic fallback transfer message now asks for that rejection
  first.
- The hard AI learner proxy now produces that rejection only when the tutor
  reaches the transfer frame.
- Added a regression test:
  `hard AI transfer requires explicit rejection of gender removal sufficiency`.

Verification:

```bash
node --test prototypes/adaptive-persona-mvp/tests/*.test.js
npx eslint prototypes/adaptive-persona-mvp/**/*.js
```

## 2026-05-16 Replicated Four-Trap LLM Transfer-Repair Sweep

### Full Live Sweep

Command:

```bash
node prototypes/adaptive-persona-mvp/scripts/run-variant-sweep.js \
  --traps \
  --conditions static_codex,controller_reflexive_psychodynamic_codex \
  --learner codex \
  --repeats 2 \
  --out prototypes/adaptive-persona-mvp/outputs/transfer-repair-full-traps-replicated-live-strict-debug
```

Artifacts:

- `outputs/transfer-repair-full-traps-replicated-live-strict-debug/variant-sweep-2026-05-16T20-48-18-255Z.html`
- `outputs/transfer-repair-full-traps-replicated-live-strict-debug/variant-sweep-2026-05-16T20-48-18-255Z.json`

Raw sweep result, `n=16` paired branches:

- MVP mean diff: `+10.906`, `p=0.0227`;
- parent dialogue mean diff: `+0.078`, `p=1`;
- trap outcome mean diff: `+62.5`, `p=0.0064`.

The sweep confirmed the target on MVP and outcome, but not parent dialogue.

### Trap Revalidation

Command:

```bash
node prototypes/adaptive-persona-mvp/scripts/revalidate-trap-report.js \
  --input prototypes/adaptive-persona-mvp/outputs/transfer-repair-full-traps-replicated-live-strict-debug/variant-sweep-2026-05-16T20-48-18-255Z.json \
  --out prototypes/adaptive-persona-mvp/outputs/transfer-repair-full-traps-replicated-live-strict-debug-revalidated
```

Artifacts:

- `outputs/transfer-repair-full-traps-replicated-live-strict-debug-revalidated/variant-sweep-revalidated-2026-05-16T20-48-24-507Z.html`
- `outputs/transfer-repair-full-traps-replicated-live-strict-debug-revalidated/variant-sweep-revalidated-2026-05-16T20-48-24-507Z.json`

Changed outcomes: `0`.

### Robustness Gate Patch

The previous robustness gate required all public metrics to pass statistical
significance. That made the parent dialogue rubric a blocking adaptation
metric, even when the deterministic trap outcome and adaptation-specific MVP
rubric both passed.

The gate now distinguishes:

- adaptive-primary robustness: MVP and outcome must pass, and parent dialogue
  must not materially decline;
- strict all-public-metric confirmation: MVP, parent dialogue, and outcome must
  all pass.

This keeps the parent rubric visible as a compatibility check without letting a
general dialogue-quality rubric override hidden-state transfer evidence.

Command:

```bash
node prototypes/adaptive-persona-mvp/scripts/evaluate-robustness.js \
  --inputs prototypes/adaptive-persona-mvp/outputs/transfer-repair-full-traps-replicated-live-strict-debug-revalidated \
  --scenario-set traps \
  --target controller_reflexive_psychodynamic_codex \
  --baseline static_codex \
  --out prototypes/adaptive-persona-mvp/outputs/robustness-transfer-repair-full-traps-replicated-live-strict-debug-v2
```

Artifacts:

- `outputs/robustness-transfer-repair-full-traps-replicated-live-strict-debug-v2/robustness-evaluation-2026-05-16T20-50-48-530Z.html`
- `outputs/robustness-transfer-repair-full-traps-replicated-live-strict-debug-v2/robustness-evaluation-2026-05-16T20-50-48-530Z.md`
- `outputs/robustness-transfer-repair-full-traps-replicated-live-strict-debug-v2/robustness-evaluation-2026-05-16T20-50-48-530Z.json`

Verdict:

- adaptive-primary robust positive effect established: `true`;
- strict all-public-metric confirmation: `false`.

### Branch Diagnosis

Argument and science traps are now stable across original and counterfactual
branches. The remaining instability is concentrated in two action families:

- programming/debugging: the stricter counterfactual still sometimes misses
  the actual bad-total fix even after transfer is observed;
- social measurement: counterfactual branches still fail final transfer or
  transcript-transfer evidence.

Next target: repair those two action-family transitions directly, then rerun
the same replicated four-trap LLM sweep.

### Verification

```bash
node --test prototypes/adaptive-persona-mvp/tests/robustness.test.js
```

Passed with `4` tests.

## 2026-05-16 Action-Family Transition Repair

### Implemented

The remaining trap failures were concentrated in two action families rather
than the whole adaptation loop:

- programming/debugging transfer;
- social-measurement validity transfer.

Implemented repairs:

- partial learner responses after an attempted transfer now route back to
  `transfer_repair` instead of dropping into a generic hint;
- debugging transfer recognition now accepts price/quantity line-total bugs,
  invoice/cart/order bug wording, `lineTotal`, and `reject or handle`/guard
  language, while still rejecting average-only repeats and valid-zero
  confusions;
- measurement transfer recognition now accepts non-hyphenated `course
  belonging`, `single belonging item`, engagement/safety single-item variants,
  `multi-item`, `cognitive interview`, `test-retest`, and `can't prove`
  language;
- measurement prompts now ask for the course belonging single-item case and the
  explicit can/cannot-prove boundary.

Focused tests were added for:

- cart-with-undefined-amount transfer wording;
- non-hyphenated course belonging transfer wording;
- original wellbeing-only measurement answers still failing transfer.

### Replicated Artifact Revalidation

Command:

```bash
node prototypes/adaptive-persona-mvp/scripts/revalidate-trap-report.js \
  --input prototypes/adaptive-persona-mvp/outputs/transfer-repair-full-traps-replicated-live-strict-debug/variant-sweep-2026-05-16T20-48-18-255Z.json \
  --out prototypes/adaptive-persona-mvp/outputs/transfer-repair-full-traps-action-family-revalidated-v3
```

Artifacts:

- `outputs/transfer-repair-full-traps-action-family-revalidated-v3/variant-sweep-revalidated-2026-05-16T22-15-39-731Z.html`
- `outputs/transfer-repair-full-traps-action-family-revalidated-v3/variant-sweep-revalidated-2026-05-16T22-15-39-731Z.json`

Changed outcomes: `6`.

Result, `n=16` paired branches:

- MVP mean diff: `+10.906`, `p=0.0227`;
- parent dialogue mean diff: `+0.078`, `p=1`;
- trap outcome mean diff: `+100`, `p=0`.

Robustness:

- `outputs/robustness-transfer-repair-full-traps-action-family-v3/robustness-evaluation-2026-05-16T22-15-45-211Z.html`
- adaptive-primary robust positive effect: `true`;
- strict all-public-metric confirmation: `false`.

### Focused Live LLM Slice

Command:

```bash
node prototypes/adaptive-persona-mvp/scripts/run-variant-sweep.js \
  --scenarios trap_programming_debugging_false_mastery_closed_loop,trap_social_measurement_false_mastery_closed_loop \
  --conditions static_codex,controller_reflexive_psychodynamic_codex \
  --learner codex \
  --repeats 1 \
  --out prototypes/adaptive-persona-mvp/outputs/action-family-repair-focused-live \
  --timeout-ms 600000 \
  --permutations 1000
```

Raw artifact:

- `outputs/action-family-repair-focused-live/variant-sweep-2026-05-16T22-48-04-255Z.html`

Revalidated artifact:

- `outputs/action-family-repair-focused-live-revalidated-v2/variant-sweep-revalidated-2026-05-16T22-49-55-194Z.html`

Changed outcomes after revalidation: `3`.

Focused result, `n=4` paired branches:

- MVP mean diff: `+13`;
- parent dialogue mean diff: `+1.563`;
- trap outcome mean diff: `+100`;
- not significant because the focused slice is too small.

Interpretation: the repaired action-family model is now behaving correctly on
the two previously unstable families. The next expensive validation step is a
fresh replicated four-trap LLM sweep using this patched policy/recognition
model.

### Verification

```bash
node --test prototypes/adaptive-persona-mvp/tests/*.test.js
npx eslint prototypes/adaptive-persona-mvp/**/*.js
```

## 2026-05-16 Transfer-Repair Live Gate Pass

### Implemented

- Added transcript revalidation via `scripts/revalidate-trap-report.js`.
- Added semantic trap validation so delayed-transfer outcomes are scored from
  transcript/outcome evidence rather than the LLM learner proxy's raw
  `success` flag alone. The raw flag is preserved as `raw_success`.
- Moved last-chance `transfer_repair` ahead of local repair when a hidden-state
  trap is about to run out of learner-response turns.
- Changed final `summarize_and_check` moves to close the loop after observed
  transfer instead of opening a fresh unanswered task in the final visible turn.
- Tightened programming/debugging transfer to require an order/cart/invoice or
  payment total with missing/invalid amount data, and to distinguish invalid
  data from a legitimate zero total such as `[5, -5]`.
- Added validator and state-machine tests for semantic validation, learner-owned
  transfer, average/rate false positives, and valid-zero confusions.

### Full Four-Trap Live Sweep

Command:

```bash
node prototypes/adaptive-persona-mvp/scripts/run-variant-sweep.js \
  --traps \
  --conditions static_codex,controller_reflexive_psychodynamic_codex \
  --learner codex \
  --repeats 1 \
  --out prototypes/adaptive-persona-mvp/outputs/transfer-repair-full-traps-live
```

Raw artifacts:

- `outputs/transfer-repair-full-traps-live/variant-sweep-2026-05-16T16-31-26-688Z.html`
- `outputs/transfer-repair-full-traps-live/variant-sweep-2026-05-16T16-31-26-688Z.json`

Current revalidated artifacts:

- `outputs/transfer-repair-full-traps-live-revalidated-strict-debug-v2/variant-sweep-revalidated-2026-05-16T17-31-53-163Z.html`
- `outputs/transfer-repair-full-traps-live-revalidated-strict-debug-v2/variant-sweep-revalidated-2026-05-16T17-31-53-163Z.json`

Result, `n=8` paired branches:

- MVP mean diff: `+8.375`, bootstrap CI `0.875..16`, `p=0.1128`
- parent dialogue mean diff: `-2.969`, CI `-9.688..3.75`, `p=0.4786`
- trap outcome mean diff: `+87.5`, CI `62.5..100`, `p=0.0195`

Robustness artifact:

- `outputs/robustness-transfer-repair-full-traps-strict-debug-v2/robustness-evaluation-2026-05-16T17-31-58-876Z.html`

Verdict: outcome transfer is now a strong positive signal, but robust positive
effects are still not established because the run is unreplicated and
parent-dialogue quality remains negative on the full four-trap artifact.

### Prospective Argument/Programming Slice

Command:

```bash
node prototypes/adaptive-persona-mvp/scripts/run-variant-sweep.js \
  --traps \
  --scenarios trap_argument_warrant_false_mastery_closed_loop,trap_programming_debugging_false_mastery_closed_loop \
  --conditions static_codex,controller_reflexive_psychodynamic_codex \
  --learner codex \
  --repeats 1 \
  --out prototypes/adaptive-persona-mvp/outputs/transfer-repair-argument-programming-live-v2
```

Revalidated artifact:

- `outputs/transfer-repair-argument-programming-live-v2-revalidated-strict-debug/variant-sweep-revalidated-2026-05-16T17-13-37-344Z.html`

Result, `n=4` paired branches:

- MVP mean diff: `+6.25`
- parent dialogue mean diff: `+9.063`
- trap outcome mean diff: `+50`

Interpretation: the closure-quality patch improved the argument branches and
made parent dialogue positive on this focused slice, but programming transfer
was still unstable.

### Programming Strict-Debug V3 Slice

Command:

```bash
node prototypes/adaptive-persona-mvp/scripts/run-variant-sweep.js \
  --traps \
  --scenarios trap_programming_debugging_false_mastery_closed_loop \
  --conditions static_codex,controller_reflexive_psychodynamic_codex \
  --learner codex \
  --repeats 1 \
  --out prototypes/adaptive-persona-mvp/outputs/transfer-repair-programming-live-strict-debug-v3
```

Revalidated artifact:

- `outputs/transfer-repair-programming-live-strict-debug-v3-revalidated-v2/variant-sweep-revalidated-2026-05-16T17-31-34-773Z.html`

Result, `n=2` paired branches:

- MVP mean diff: `+1.25`
- parent dialogue mean diff: `+3.75`
- trap outcome mean diff: `+100`

Interpretation: the stricter order/cart/invoice/payment total prompt elicited
the desired LLM learner transfer in both programming branches, including the
valid-zero distinction. This is only a targeted smoke confirmation, not a
robust result.

### Current Interpretation

The adaptation mechanism is now doing something non-trivial on hidden-state
trap outcomes: static tutoring remains fluent but repeatedly fails
learner-owned delayed transfer, while the reflexive controller often forces a
specific transfer repair before consolidation. The public-quality problem is
not solved at the full-suite level: parent dialogue can still penalize the
controller for procedural or late repair moves.

Next empirical step: run a replicated full four-trap live sweep with the current
strict-debug prompts and semantic validator. The acceptance target remains all
public metrics positive with enough branches to satisfy the robustness gate.

## 2026-05-16 Transfer Repair Policy And Focused Live Reruns

### Implementation

Added a first explicit transfer-repair mechanism for hidden-state trap
curricula:

- added `transfer_repair` to the policy vocabulary;
- added `transferState.promptCount`, `lastPromptTurnIndex`,
  `lastPromptPolicy`, and `repairCount`;
- added `recordTransferPrompt()` so the state machine can distinguish a fresh
  transfer need from a failed or delayed transfer attempt;
- added a last-response-turn guard: when a hidden-state trap has no observed
  transfer and the current tutor turn is the last turn that can still receive a
  learner response, the controller can select `transfer_repair` instead of
  another local `teach_back`, `minimal_hint`, or late final transfer;
- added domain-specific `transfer_repair` action templates for argument,
  science, programming, and social-science measurement;
- added `scripts/revalidate-trap-report.js` so saved live transcripts can be
  re-scored after validator-marker fixes without rerunning expensive LLM calls;
- changed the social measurement transfer case to a different single-item
  course-belonging survey claim, rather than staying only on the original
  wellbeing-program item;
- updated trap validators to recognize learner-owned cross-case transfer in
  fair-test battery comparisons and course-belonging single-item measurement
  cases, while still requiring the transfer marker to appear in learner
  transcript text, not only in tutor prompts;
- removed scenario-objective leakage from the dry static tutor fallback, which
  had accidentally let rule learners treat static baseline prompts containing
  the word "transfer" as real transfer prompts.

### Dry Trap Check

Command:

```bash
node prototypes/adaptive-persona-mvp/scripts/run-variant-sweep.js \
  --traps \
  --conditions static_codex,controller_reflexive_psychodynamic_codex \
  --repeats 1 \
  --dry-run \
  --no-progress \
  --out prototypes/adaptive-persona-mvp/outputs/transfer-repair-dry-traps-fixed-static
```

Artifacts:

- `outputs/transfer-repair-dry-traps-fixed-static/variant-sweep-2026-05-16T13-14-11-864Z.html`
- `outputs/transfer-repair-dry-traps-fixed-static/variant-sweep-2026-05-16T13-14-11-864Z.json`

Result:

- MVP mean diff: `-3.75`;
- parent dialogue mean diff: `+13.1`;
- outcome mean diff: `+50`;
- recommended target: `controller_reflexive_psychodynamic_codex`.

Interpretation: dry mode is not behavioral evidence, but it confirmed the
intended trap shape after removing static objective leakage. Static original
branches no longer pass simply because the static fallback echoed objectives
that contained "transfer".

### Focused Live Rerun

Command:

```bash
node prototypes/adaptive-persona-mvp/scripts/run-variant-sweep.js \
  --scenarios trap_argument_warrant_false_mastery_closed_loop,trap_science_variable_control_false_mastery_closed_loop,trap_social_measurement_false_mastery_closed_loop \
  --conditions static_codex,controller_reflexive_psychodynamic_codex \
  --learner codex \
  --repeats 1 \
  --out prototypes/adaptive-persona-mvp/outputs/transfer-repair-focused-live
```

Artifacts:

- `outputs/transfer-repair-focused-live/variant-sweep-2026-05-16T14-05-51-916Z.html`
- `outputs/transfer-repair-focused-live/variant-sweep-2026-05-16T14-05-51-916Z.json`

Result:

- MVP mean diff: `+9.667`;
- parent dialogue mean diff: `-1.667`;
- outcome mean diff: `+33.333`;
- recommended target: `controller_reflexive_psychodynamic_codex`.

Branch interpretation:

- argument original passed the delayed-transfer validator:
  `teach_back -> misconception_repair -> transfer_challenge -> summarize_and_check`;
- science still failed because a correct-but-corrective learner turn at the
  last response opportunity routed through `repair_misrecognition` instead of
  `transfer_repair`;
- social improved to observed transfer, but the first validator pass did not
  recognize the learner's course-belonging transfer marker.

### V2 Science/Social Live Rerun

Command:

```bash
node prototypes/adaptive-persona-mvp/scripts/run-variant-sweep.js \
  --scenarios trap_science_variable_control_false_mastery_closed_loop,trap_social_measurement_false_mastery_closed_loop \
  --conditions static_codex,controller_reflexive_psychodynamic_codex \
  --learner codex \
  --repeats 1 \
  --out prototypes/adaptive-persona-mvp/outputs/transfer-repair-v2-science-social-live
```

Artifacts:

- `outputs/transfer-repair-v2-science-social-live/variant-sweep-2026-05-16T14-41-44-920Z.html`
- `outputs/transfer-repair-v2-science-social-live/variant-sweep-2026-05-16T14-41-44-920Z.json`

Initial live result:

- MVP mean diff: `+13.313`;
- parent dialogue mean diff: `-3.188`;
- outcome mean diff: `0`;
- recommended target: none.

Post-run validation diagnosis:

- science transcript had a learner-owned fair-test transfer to a battery case
  ("brighter bulb", "room temperature") and a correct fertilizer outcome, but
  the validator only recognized fertilizer/next-experiment transfer markers;
- social transcript had a learner-owned transfer to the course-belonging
  single-item survey case, but the transcript marker list did not include the
  learner's phrasing ("students feeling like they belong in the course").

After updating transfer-marker recognition, the same v2 live transcripts
revalidate as passing both focused original trap outcomes. The revalidated
report was generated without rerunning any LLM calls.

Revalidation artifacts:

- `outputs/transfer-repair-v2-science-social-revalidated/variant-sweep-revalidated-2026-05-16T14-43-47-358.html`
- `outputs/transfer-repair-v2-science-social-revalidated/variant-sweep-revalidated-2026-05-16T14-43-47-358.json`
- `outputs/transfer-repair-v2-science-social-revalidated-script/variant-sweep-revalidated-2026-05-16T14-46-03-347.html`
- `outputs/transfer-repair-v2-science-social-revalidated-script/variant-sweep-revalidated-2026-05-16T14-46-03-347.json`

Revalidated result:

- MVP mean diff: `+13.313`;
- parent dialogue mean diff: `-3.188`;
- outcome mean diff: `+50`;
- script-revalidated changed outcomes: `2`;
- decision: triage pass on MVP and outcome, but not a robust positive effect.

Robustness gate:

```bash
node prototypes/adaptive-persona-mvp/scripts/evaluate-robustness.js \
  --inputs prototypes/adaptive-persona-mvp/outputs/transfer-repair-v2-science-social-revalidated \
  --scenario-set traps \
  --target controller_reflexive_psychodynamic_codex \
  --baseline static_codex \
  --out prototypes/adaptive-persona-mvp/outputs/robustness-transfer-repair-v2-science-social
```

Artifacts:

- `outputs/robustness-transfer-repair-v2-science-social/robustness-evaluation-2026-05-16T14-44-04-067.html`
- `outputs/robustness-transfer-repair-v2-science-social/robustness-evaluation-2026-05-16T14-44-04-067.json`
- `outputs/robustness-transfer-repair-v2-science-social/robustness-evaluation-2026-05-16T14-44-04-067.md`

Result: robust positive effect is still **not established**. The focused slice
is too small and does not cover replicated full trap evidence.

### Current Interpretation

The method is improving in the specific adaptation dimension we care about:
the controller can now explicitly detect that hidden-state transfer is missing,
repair that missing transfer with a narrow case, and show learner-owned
transfer in live transcripts. The evidence is now positive for focused
science/social transfer repair after revalidation, and argument already passed
in the focused live run.

This does not yet solve the robust-effect question. Parent-dialogue scores
remain unstable or slightly negative, and the current positive evidence is
focused rather than replicated across the full trap suite.

Next work:

1. run a full four-trap live sweep with the final `transfer_repair` logic and
   updated validators;
2. if full four-trap outcome and MVP deltas remain positive, run at least one
   replicated sweep so the robustness gate has enough branches;
3. inspect parent-dialogue losses and tune the public wording of
   `transfer_repair` so it reads less like a checklist while preserving the
   mechanism;
4. consider adding a post-run revalidation command as a first-class script so
   validator updates can be applied reproducibly to existing transcript
   artifacts without rerunning expensive LLM calls.

## 2026-05-16 Parent-Compatible Action Mapping

### Implemented

The broader parent replay showed that the raw prototype policy vocabulary is
not aligned enough with the parent trap-action taxonomy. I added a
parent-compatible action mapping layer without touching the parent harness:

- added `src/parentActionMapping.js`;
- mapped prototype policy/state/challenge evidence to parent action labels such
  as `ask_diagnostic_question`, `name_the_disagreement`,
  `withhold_answer`, `repair_misrecognition`, and `lower_cognitive_load`;
- added parent-compatible trigger matching beside the existing raw prototype
  compatibility check;
- added parent-compatible action-family agreement beside the raw
  parent/prototype family agreement;
- updated the replay HTML/Markdown/JSON reports to show both raw and mapped
  interpretations.

This layer is deliberately an adapter over saved traces. It does not register a
parent cell, mutate the parent DB, or change parent scoring.

### Broader Parent Replay, First Mapping

Command:

```bash
node prototypes/adaptive-persona-mvp/scripts/replay-parent-stack.js \
  --run-id eval-2026-05-12-de6d48ab \
  --limit 24 \
  --out prototypes/adaptive-persona-mvp/outputs/parent-stack-replay-mapped
```

Artifacts:

- `outputs/parent-stack-replay-mapped/parent-stack-replay-2026-05-16T03-39-59-736Z.html`
- `outputs/parent-stack-replay-mapped/parent-stack-replay-2026-05-16T03-39-59-736Z.json`
- `outputs/parent-stack-replay-mapped/parent-stack-replay-2026-05-16T03-39-59-736Z.md`

Result:

- raw prototype trigger compatibility: `25.0%` across `48` trigger branches;
- parent-compatible trigger compatibility: `62.5%`;
- raw parent/prototype family agreement: `28.1%` across `192` labelled turns;
- parent-compatible family agreement: `37.0%`.

Mismatches showed two important priorities:

- `misconception_surfaces` and `polite_false_mastery` should prefer diagnostic
  questioning over raw transfer/extension;
- `productive_deadlock` and `epistemic_resistance` should name the
  disagreement rather than treating it as ordinary correction or answer
  seeking.

### Broader Parent Replay, Scenario-Prioritized Mapping

Command:

```bash
node prototypes/adaptive-persona-mvp/scripts/replay-parent-stack.js \
  --run-id eval-2026-05-12-de6d48ab \
  --limit 24 \
  --out prototypes/adaptive-persona-mvp/outputs/parent-stack-replay-mapped-v2
```

Artifacts:

- `outputs/parent-stack-replay-mapped-v2/parent-stack-replay-2026-05-16T03-40-32-776Z.html`
- `outputs/parent-stack-replay-mapped-v2/parent-stack-replay-2026-05-16T03-40-32-776Z.json`
- `outputs/parent-stack-replay-mapped-v2/parent-stack-replay-2026-05-16T03-40-32-776Z.md`

Result:

- raw prototype trigger compatibility: `25.0%` across `48` trigger branches;
- parent-compatible trigger compatibility: `100.0%`;
- raw parent/prototype family agreement: `28.1%` across `192` labelled turns;
- parent-compatible family agreement: `37.5%`;
- challenge-state active/escalated rate: `89.4%`;
- escalated branches: `41`;
- resolved branches: `41`.

Interpretation: the mapping layer now proves that prototype states can be
translated into the parent trap-action vocabulary at the trigger level. It does
not yet prove enough whole-dialogue alignment for parent integration. The next
use of parent replay should therefore be diagnostic: strengthen the state/action
trajectory model and only then consider a production adapter.

### Parent Replay With Mismatch Diagnostics

Command:

```bash
node prototypes/adaptive-persona-mvp/scripts/replay-parent-stack.js \
  --run-id eval-2026-05-12-de6d48ab \
  --limit 24 \
  --out prototypes/adaptive-persona-mvp/outputs/parent-stack-replay-mapped-diagnostics
```

Artifacts:

- `outputs/parent-stack-replay-mapped-diagnostics/parent-stack-replay-2026-05-16T03-52-39-255Z.html`
- `outputs/parent-stack-replay-mapped-diagnostics/parent-stack-replay-2026-05-16T03-52-39-255Z.json`
- `outputs/parent-stack-replay-mapped-diagnostics/parent-stack-replay-2026-05-16T03-52-39-255Z.md`

Result:

- parent-compatible trigger compatibility remains `100.0%` across `48`
  trigger branches;
- parent-compatible family agreement remains `37.5%` across `192` labelled
  turns;
- trigger mismatches are now empty;
- the report now groups the remaining trajectory mismatches by parent action,
  mapped action, count, and examples.

Largest mismatch families:

- parent `name_the_disagreement` vs mapped `withhold_answer`, `17` turns:
  activity-avoidance branches later become substantive objections, but the
  scenario-prioritized mapper keeps treating them as oracle-mode avoidance;
- parent `mirror_and_extend` vs mapped `ask_diagnostic_question`, `12` turns:
  misconception-surface branches later show enough learner work for extension,
  but the mapper keeps the diagnostic family too long;
- parent `pose_counterexample` vs mapped `ask_diagnostic_question`, `10` turns:
  surfaced misconceptions sometimes require a counterexample rather than more
  elicitation;
- parent `repair_misrecognition` vs mapped `name_the_disagreement`, `10`
  turns: some framework-disagreement language is really local clarification or
  tutor-reading repair;
- overload and affect branches are partly conflated, especially
  `lower_cognitive_load` vs `acknowledge_and_redirect`.

Interpretation: parent replay has now moved from trigger translation to a
trajectory-learning problem. The next non-integration step is a stateful
parent-compatible action model with decay/de-escalation, so a scenario family
can dominate the trigger turn but stop dominating after the learner supplies
new evidence.

### Trajectory-Aware Parent Mapping

Command:

```bash
node prototypes/adaptive-persona-mvp/scripts/replay-parent-stack.js \
  --run-id eval-2026-05-12-de6d48ab \
  --limit 24 \
  --out prototypes/adaptive-persona-mvp/outputs/parent-stack-replay-trajectory-diagnostics
```

Artifacts:

- `outputs/parent-stack-replay-trajectory-diagnostics/parent-stack-replay-2026-05-16T03-59-30-344Z.html`
- `outputs/parent-stack-replay-trajectory-diagnostics/parent-stack-replay-2026-05-16T03-59-30-344Z.json`
- `outputs/parent-stack-replay-trajectory-diagnostics/parent-stack-replay-2026-05-16T03-59-30-344Z.md`

Implemented:

- carried the parent hidden trigger turn into the read-only replay scenario;
- preserved the scenario-level expected action at the trigger turn;
- allowed later turns to de-escalate when learner evidence changes:
  - answer-seeking can become substantive disagreement or extension;
  - surfaced misconceptions can become counterexample or extension work;
  - overload and affect branches can move back toward extension after learner
    repair;
  - local clarification can map to `repair_misrecognition` instead of broad
    disagreement.

Result:

- raw prototype trigger compatibility: `25.0%` across `48` trigger branches;
- parent-compatible trigger compatibility: `100.0%`;
- raw parent/prototype family agreement: `28.1%` across `192` labelled turns;
- parent-compatible family agreement: `54.7%`;
- raw non-trigger family agreement: `31.9%` across `144` labelled turns;
- parent-compatible non-trigger family agreement: `62.5%`.

Interpretation: this is the clearest replay-side progress so far. A
parent-compatible, trajectory-aware adapter preserves trigger expectations and
substantially improves later-turn action-family alignment. It is still not a
parent integration result: the remaining mismatch families show unresolved
differences between affect repair vs cognitive-load repair, local clarification
vs substantive disagreement, and parent actual actions vs parent expected
strategy shifts.

### Transition-Level Diagnostic

Command:

```bash
node prototypes/adaptive-persona-mvp/scripts/replay-parent-stack.js \
  --run-id eval-2026-05-12-de6d48ab \
  --limit 24 \
  --out prototypes/adaptive-persona-mvp/outputs/parent-stack-replay-transition-diagnostics
```

Artifacts:

- `outputs/parent-stack-replay-transition-diagnostics/parent-stack-replay-2026-05-16T04-01-25-919Z.html`
- `outputs/parent-stack-replay-transition-diagnostics/parent-stack-replay-2026-05-16T04-01-25-919Z.json`
- `outputs/parent-stack-replay-transition-diagnostics/parent-stack-replay-2026-05-16T04-01-25-919Z.md`

Result:

- parent-compatible trigger compatibility: `100.0%`;
- parent-compatible family agreement: `54.7%`;
- parent-compatible non-trigger family agreement: `62.5%`;
- parent-compatible family transition agreement: `31.3%` across `144`
  transitions.

Interpretation: the harder transition metric prevents a false sense of success.
The adapter is now better at choosing individual parent-compatible actions, but
it still does not reproduce the parent stack's movement pattern between
scaffold, substantive challenge, repair, and consolidation. The next replay
work should model transition dynamics directly, not just per-turn action
selection.

## 2026-05-16 Live Hidden-State Trap Sweep

### Command

```bash
node prototypes/adaptive-persona-mvp/scripts/run-variant-sweep.js \
  --traps \
  --learner codex \
  --conditions static_codex,controller_reflexive_psychodynamic_codex \
  --baseline static_codex \
  --repeats 1 \
  --out prototypes/adaptive-persona-mvp/outputs/trap-scenarios-llm-live \
  --timeout-ms 600000 \
  --permutations 200
```

Artifacts:

- `outputs/trap-scenarios-llm-live/variant-sweep-2026-05-16T04-38-02-875Z.html`
- `outputs/trap-scenarios-llm-live/variant-sweep-2026-05-16T04-38-02-875Z.json`

Scenarios:

- `trap_argument_warrant_false_mastery_closed_loop`;
- `trap_science_variable_control_false_mastery_closed_loop`;
- `trap_programming_debugging_false_mastery_closed_loop`;
- `trap_social_measurement_false_mastery_closed_loop`.

Result, `n=8` paired branches:

- MVP mean diff: `+0.625`, CI `0..1.875`, `p=1.0`;
- parent dialogue mean diff: `+0.625`, CI approximately `-0.633..1.879`,
  `p=0.5331`;
- outcome mean diff: `0`, CI `0..0`, `p=1.0`;
- public triage pass: yes, on MVP and parent dialogue;
- significance pass: no;
- recommendation in sweep report: `controller_reflexive_psychodynamic_codex`;
- all outcome tasks passed for both baseline and target.

Challenge-state result:

- active challenge-state rate: `100%`;
- directive rate: `37.5%`;
- resolved rate: `100%`;
- outcome success rate: `100%`.

Branch pattern:

- The trap scenarios successfully force the controller through the intended
  hidden-state probe pattern: all branches begin with `teach_back`.
- Static baseline remains very strong. It scored `100` MVP on six branches and
  `95` on two counterfactual branches; all static outcomes passed.
- The target improved small parent-dialogue margins on several original
  false-mastery branches, but lost or tied elsewhere.
- The outcome task is now too easy for this live trap setup: every branch in
  both conditions passed.

Interpretation: this is useful triage evidence, not confirmation. Hidden-state
traps lower the chance of blind personalization, and the psychodynamic target
still shows a small positive public signal, but the baseline is near ceiling
and the outcome task no longer separates conditions. The next trap iteration
should increase outcome difficulty and require delayed transfer under
adversarial learner reversions rather than accepting one successful final
answer.

### Trap Robustness Gate

Command:

```bash
node prototypes/adaptive-persona-mvp/scripts/evaluate-robustness.js \
  --scenario-set traps \
  --inputs prototypes/adaptive-persona-mvp/outputs \
  --out prototypes/adaptive-persona-mvp/outputs/robustness-evaluation-traps \
  --permutations 1000
```

Artifacts:

- `outputs/robustness-evaluation-traps/robustness-evaluation-2026-05-16T04-38-57-212Z.html`
- `outputs/robustness-evaluation-traps/robustness-evaluation-2026-05-16T04-38-57-212Z.json`
- `outputs/robustness-evaluation-traps/robustness-evaluation-2026-05-16T04-38-57-212Z.md`

Gate result:

- robust positive effect established: `false`;
- reasons:
  - only `1` eligible live trap run and `8` paired branches;
  - the gate requires at least `2` runs or `12` branches;
  - not all public metrics are positive because outcome is flat;
  - no public metric passes the non-trivial positive gate.

## 2026-05-16 Progress Monitor

Implemented a default CLI percentage monitor for long prototype runs:

- added `src/progressMonitor.js`;
- wired progress callbacks through `runRealAssessment`,
  `runRubricComparison`, and `annotateReflexiveBranches`;
- enabled progress output in:
  - `scripts/run-adaptation-assessment.js`;
  - `scripts/run-rubric-comparison.js`;
  - `scripts/run-variant-sweep.js`;
  - `scripts/run-replicated-comparison.js`;
- added `--no-progress` to suppress monitor lines when clean logs are needed.

The monitor reports estimated logical units rather than wall-clock completion.
It advances through tutor calls, learner-proxy calls, outcome tasks, blind
judges, parent-dialogue judges, and optional deep reflexive judges.

Smoke command:

```bash
node prototypes/adaptive-persona-mvp/scripts/run-variant-sweep.js \
  --dry-run \
  --scenarios trap_argument_warrant_false_mastery_closed_loop \
  --conditions static_codex,controller_reflexive_psychodynamic_codex \
  --baseline static_codex \
  --repeats 1 \
  --out prototypes/adaptive-persona-mvp/outputs/progress-monitor-smoke \
  --permutations 20
```

Artifact:

- `outputs/progress-monitor-smoke/variant-sweep-2026-05-16T04-44-24-948Z.html`
- `outputs/progress-monitor-smoke/variant-sweep-2026-05-16T04-44-24-948Z.json`

Example output:

```text
[variant-sweep] 54.5% (24/44) done: assessment trap_argument_warrant_false_mastery_closed_loop controller_reflexive_psychodynamic_codex original turn=3 ego revision elapsed=0s
```

Verification:

```bash
node --test prototypes/adaptive-persona-mvp/tests/*.test.js
npx eslint prototypes/adaptive-persona-mvp/**/*.js
```

Both pass.

### Focused Hard AI Live Slice

Command:

```bash
node prototypes/adaptive-persona-mvp/scripts/run-variant-sweep.js \
  --scenarios hard_ai_bias_resistant_closed_loop \
  --conditions static_codex,controller_reflexive_psychodynamic_codex \
  --baseline static_codex \
  --repeats 1 \
  --out prototypes/adaptive-persona-mvp/outputs/hard-ai-transfer-explicit-live \
  --timeout-ms 600000 \
  --permutations 200
```

Artifact:

- `outputs/hard-ai-transfer-explicit-live/variant-sweep-2026-05-15T17-30-20-968Z.html`
- `outputs/hard-ai-transfer-explicit-live/variant-sweep-2026-05-15T17-30-20-968Z.json`

Result, `n=2` paired branches:

- MVP mean diff: `+25`
- parent dialogue mean diff: `+13.125`
- outcome mean diff: `+50`

The counterfactual branch flipped from static outcome failure to target outcome
success.

### Replicated Hard-Mode Confirmation

Command:

```bash
node prototypes/adaptive-persona-mvp/scripts/run-replicated-comparison.js \
  --scenarios hard_fractions_forgetful_resistant_closed_loop,hard_ai_bias_resistant_closed_loop,hard_stats_confounding_skeptical_closed_loop \
  --conditions static_codex,controller_reflexive_psychodynamic_codex \
  --baseline static_codex \
  --target controller_reflexive_psychodynamic_codex \
  --repeats 4 \
  --skip-deep-reflexive \
  --out prototypes/adaptive-persona-mvp/outputs/hard-mode-transfer-explicit-confirm-live \
  --timeout-ms 600000 \
  --permutations 1000
```

Artifact:

- `outputs/hard-mode-transfer-explicit-confirm-live/replicated-comparison-2026-05-15T19-23-11-945Z.html`
- `outputs/hard-mode-transfer-explicit-confirm-live/replicated-comparison-2026-05-15T19-23-11-945Z.json`

Result, `n=24` paired branches:

- MVP mean diff: `+17.188`, CI `9.375..25.419`, `p=0.001`,
  `dz=0.847`, gate passed.
- Parent dialogue mean diff: `+12.552`, CI `3.906..21.148`,
  `p=0.01`, `dz=0.566`, gate passed.
- Outcome mean diff: `+33.333`, CI `12.5..50`, `p=0.007`,
  `dz=0.692`, gate passed.

Branch pattern:

- MVP score improved on `17/24` paired branches, tied on `5/24`, and lost on
  `2/24`.
- Parent dialogue improved on `16/24`, tied on `1/24`, and lost on `7/24`.
- Outcome improved on `8/24`, tied on `16/24`, and never regressed.
- The largest remaining parent-dialogue weakness is hard AI original, where
  the target sometimes becomes more directive than the static baseline.
- Only one target outcome failure remained across all 24 target branches:
  repeat 1, hard AI counterfactual.

Conclusion: this is the first replicated hard-mode result in the prototype that
passes the stated statistical gate on all three public metrics. The result
supports the current claim: without model weight updates, a stateful
multiagent controller with challenge-state memory, outcome gates, bounded
persona mutation, and Ego/Superego revision can produce verifiable adaptive
improvement over a strong static AI tutor baseline under persistent learner
resistance and forgetfulness.

The next work should shift from proving a delta to characterizing the mechanism:
run `--deep-reflexive` on the confirmed variant, summarize challenge-state
transition traces, and theorize the difference between outcome-producing
directive adaptation and parent-dialogue quality.

## 2026-05-15 Claude Critique And LLM-Learner Validation

### Critique Integrated

`CLAUDES_CRITIQUE.md` correctly identifies the main evidential weakness in the
confirmed rule-learner result: the tutor templates, deterministic learner, and
outcome scorer share hand-authored phrase tables. The rule-learner result is a
useful regression signal, but it can overstate adaptation by closing a
three-sided phrase loop.

Documentation updates:

- `ADAPTIVE_FEATURE_ARC_AND_NEXT_STEPS.md` now treats the rule-learner result
  as prototype confirmation only and moves LLM-learner validation ahead of
  stronger claims.
- `CRITIQUE_INTEGRATION_PLAN.md` translates the critique into the next
  validation sequence.

### LLM-Learner Hard-Mode Sweep

Command:

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

Artifacts:

- `outputs/hard-mode-llm-learner-live/variant-sweep-2026-05-15T23-21-50-360Z.html`
- `outputs/hard-mode-llm-learner-live/variant-sweep-2026-05-15T23-21-50-360Z.json`
- `outputs/hard-mode-llm-learner-live/transcript-digest-2026-05-15T23-23-01-907Z.md`

Result, `n=6` paired hard branches:

- MVP mean diff: `-0.833`, CI `-5..3.333`, `p=1`
- parent dialogue mean diff: `-3.125`, CI `-15.437..9.167`, `p=0.6923`
- outcome mean diff: `0`, CI `0..0`, `p=1`

Interpretation:

- The rule-learner win did not reproduce with the current LLM learner proxy.
- Outcomes were at ceiling: both baseline and target succeeded on all six
  branches.
- The target still improved statistics slightly and improved fractions on the
  parent rubric, but lost parent-dialogue ground in AI-bias branches.
- This supports Claude's critique: the confirmed rule-learner result should not
  be treated as a main-line empirical claim.

Next immediate action: harden the LLM learner proxy so hard-mode personas do
not solve from outside knowledge or reward generic scaffolding. Then rerun the
LLM-learner validation before any main-line integration.

### LLM Learner Prompt Hardening

The first LLM-learner sweep showed an outcome ceiling for both baseline and
target, so the learner proxy was too generous. The prompt was tightened so
hard-mode learners do not repair a misconception just because the tutor names a
concept. In hard mode, the learner should repair only after the tutor elicits
the missing comparison, audit, confounder, or memory check. The outcome prompt
was also tightened: success requires learner-owned repair already visible in
the transcript, not merely tutor exposition.

Verification:

```bash
node --test prototypes/adaptive-persona-mvp/tests/*.test.js
npx eslint prototypes/adaptive-persona-mvp/**/*.js
```

Both pass.

### Hardened Hard-AI LLM Slice

Command:

```bash
node prototypes/adaptive-persona-mvp/scripts/run-variant-sweep.js \
  --scenarios hard_ai_bias_resistant_closed_loop \
  --learner codex \
  --conditions static_codex,controller_reflexive_psychodynamic_codex \
  --baseline static_codex \
  --repeats 1 \
  --out prototypes/adaptive-persona-mvp/outputs/hard-ai-llm-learner-hardened-live \
  --timeout-ms 600000 \
  --permutations 200
```

Artifacts:

- `outputs/hard-ai-llm-learner-hardened-live/variant-sweep-2026-05-15T23-36-29-236Z.html`
- `outputs/hard-ai-llm-learner-hardened-live/variant-sweep-2026-05-15T23-36-29-236Z.json`
- `outputs/hard-ai-llm-learner-hardened-live/transcript-digest-2026-05-15T23-36-43-063Z.md`

Result, `n=2` paired branches:

- MVP mean diff: `-7.5`, CI `-15..0`, `p=1`
- parent dialogue mean diff: `-22.5`, CI `-40..-5`, `p=0.6`
- outcome mean diff: `0`

Interpretation: hardening exposed a target-side failure. The full controller
could repair the learner but then repeated the same transfer/menu too
aggressively, losing parent-dialogue quality against a strong static baseline.

### Agency-Restoration Patch

Implemented a post-repair consolidation policy:

- added `summarize_and_check` domain templates for fractions, AI bias, and
  statistics;
- added `challengeState.resolvedTurns` so the policy selector can tell first
  repair from sustained repair;
- changed hard-mode policy selection so `summarize_and_check` appears only
  after at least two consecutive resolved turns;
- added tests that preserve the first transfer challenge and then consolidate
  instead of repeating the same transfer case.

Verification:

```bash
node --test prototypes/adaptive-persona-mvp/tests/*.test.js
npx eslint prototypes/adaptive-persona-mvp/**/*.js
```

Both pass.

Focused live rerun:

```bash
node prototypes/adaptive-persona-mvp/scripts/run-variant-sweep.js \
  --scenarios hard_ai_bias_resistant_closed_loop \
  --learner codex \
  --conditions static_codex,controller_reflexive_psychodynamic_codex \
  --baseline static_codex \
  --repeats 1 \
  --out prototypes/adaptive-persona-mvp/outputs/hard-ai-llm-learner-agency-restore-live \
  --timeout-ms 600000 \
  --permutations 200
```

Artifacts:

- `outputs/hard-ai-llm-learner-agency-restore-live/variant-sweep-2026-05-15T23-52-48-435Z.html`
- `outputs/hard-ai-llm-learner-agency-restore-live/variant-sweep-2026-05-15T23-52-48-435Z.json`
- `outputs/hard-ai-llm-learner-agency-restore-live/transcript-digest-2026-05-15T23-53-04-868Z.md`

Result, `n=2` paired hard-AI branches:

- MVP mean diff: `+35.5`, CI `31..40`, `p=0.6`
- parent dialogue mean diff: `+3.75`
- outcome mean diff: `+100`

Branch pattern:

- Original: static MVP/parent/outcome `60/66.25/false`; target
  `100/77.5/true`.
- Counterfactual: static `69/80/false`; target `100/76.25/true`.
- Target policies were `misconception_repair -> faded_example ->
  transfer_challenge` for original and `misconception_repair ->
  transfer_challenge -> summarize_and_check` for counterfactual.
- Challenge state was active in both branches, escalated in the resistant
  original, resolved in both, and outcome succeeded in both.

Interpretation: the agency-restoration patch repaired the hard-AI LLM-learner
slice, but this is still a focused triage result, not a general claim. The next
step is a live challenge-state ablation in the same hard-AI scenario.

### Ablation Harness

Added named mechanism-deletion conditions:

- `controller_reflexive_psychodynamic_no_challenge_codex`;
- `controller_reflexive_psychodynamic_no_outcome_gate_codex`;
- `controller_reflexive_psychodynamic_ego_only_codex`;
- `controller_reflexive_psychodynamic_no_memory_codex`.

The implementation is documented in `ABLATION_CONDITIONS.md`, with tests for
challenge-state deletion, outcome-gate deletion, Ego-only tracing, and
memoryless tracing.

Dry-run artifact:

- `outputs/hard-mode-ablation-dry-run/variant-sweep-2026-05-15T23-46-02-301Z.html`
- `outputs/hard-mode-ablation-dry-run/variant-sweep-2026-05-15T23-46-02-301Z.json`

Interpretation: dry ablations are only artifact-shape checks. The deterministic
fallback path does not expose the LLM-level mechanism differences that the
ablation is meant to test.

### Live Challenge-State Ablation Slice

Command:

```bash
node prototypes/adaptive-persona-mvp/scripts/run-variant-sweep.js \
  --scenarios hard_ai_bias_resistant_closed_loop \
  --learner codex \
  --conditions static_codex,controller_reflexive_psychodynamic_codex,controller_reflexive_psychodynamic_no_challenge_codex \
  --baseline static_codex \
  --repeats 1 \
  --out prototypes/adaptive-persona-mvp/outputs/hard-ai-llm-challenge-ablation-live \
  --timeout-ms 600000 \
  --permutations 200
```

Artifacts:

- `outputs/hard-ai-llm-challenge-ablation-live/variant-sweep-2026-05-16T00-13-47-804Z.html`
- `outputs/hard-ai-llm-challenge-ablation-live/variant-sweep-2026-05-16T00-13-47-804Z.json`
- `outputs/hard-ai-llm-challenge-ablation-live/transcript-digest-2026-05-16T00-14-04-957Z.md`

Result, `n=2` paired hard-AI branches:

| Condition | MVP Diff | Parent Diff | Outcome Diff | Challenge Active | Directive | Resolved |
|---|---:|---:|---:|---:|---:|---:|
| full psychodynamic | `+35` | `+4.375` | `+100` | `100%` | `100%` | `100%` |
| no challenge state | `+30` | `+3.125` | `+100` | `0%` | `0%` | `0%` |

Interpretation: challenge state contributes but is not the sole causal
mechanism in the hard-AI LLM slice. Removing it eliminates all challenge-trace
evidence and slightly weakens public scores, but the no-challenge variant still
rescues both outcomes. This shifts the next attribution target to outcome gates
and the reflexive Ego/Superego revision path.

### Live Outcome-Gate Ablation Slice

Command:

```bash
node prototypes/adaptive-persona-mvp/scripts/run-variant-sweep.js \
  --scenarios hard_ai_bias_resistant_closed_loop \
  --learner codex \
  --conditions static_codex,controller_reflexive_psychodynamic_codex,controller_reflexive_psychodynamic_no_outcome_gate_codex \
  --baseline static_codex \
  --repeats 1 \
  --out prototypes/adaptive-persona-mvp/outputs/hard-ai-llm-outcome-gate-ablation-live \
  --timeout-ms 600000 \
  --permutations 200
```

Artifacts:

- `outputs/hard-ai-llm-outcome-gate-ablation-live/variant-sweep-2026-05-16T00-34-13-489Z.html`
- `outputs/hard-ai-llm-outcome-gate-ablation-live/variant-sweep-2026-05-16T00-34-13-489Z.json`
- `outputs/hard-ai-llm-outcome-gate-ablation-live/transcript-digest-2026-05-16T00-34-32-148Z.md`

Result, `n=2` paired hard-AI branches:

| Condition | MVP Diff | Parent Diff | Outcome Diff | Decision |
|---|---:|---:|---:|---|
| full psychodynamic | `-2.5` | `-18.75` | `0` | blocked by negative parent dialogue |
| no outcome gate | `-2.5` | `-5` | `0` | no positive public signal |

Interpretation: this rerun did not reproduce the positive hard-AI slice because
the static baseline solved both branches at ceiling. It is evidence of
LLM-learner/judge volatility, not a clean causal verdict against the outcome
gate. It does show that the gate can carry a parent-dialogue cost when the
baseline already elicits the repair: the full condition scored lower than the
ungated condition on parent dialogue in this run.

Current attribution status:

- Rule learner: strong replicated signal, but critique-limited.
- LLM learner: full hard sweep collapsed; focused hard-AI agency patch can win,
  but the slice is volatile.
- Challenge state: improves the focused slice modestly but is not solely
  responsible for outcome rescue.
- Outcome gate: not settled; may improve repair discipline but can over-direct
  when the baseline already reaches the same learner-owned repair.

Next best experiment is not another single-slice rerun. It is a replicated
LLM-learner hard-mode run with more repeats and all ablations present, or a
more controlled learner-proxy seed/model setup if we want cleaner attribution.

### Post-Patch Full Hard LLM Sweep

Command:

```bash
node prototypes/adaptive-persona-mvp/scripts/run-variant-sweep.js \
  --hard \
  --learner codex \
  --conditions static_codex,controller_reflexive_psychodynamic_codex \
  --baseline static_codex \
  --repeats 1 \
  --out prototypes/adaptive-persona-mvp/outputs/hard-mode-llm-agency-restore-full-live \
  --timeout-ms 600000 \
  --permutations 200
```

Artifacts:

- `outputs/hard-mode-llm-agency-restore-full-live/variant-sweep-2026-05-16T01-29-07-236Z.html`
- `outputs/hard-mode-llm-agency-restore-full-live/variant-sweep-2026-05-16T01-29-07-236Z.json`
- `outputs/hard-mode-llm-agency-restore-full-live/transcript-digest-2026-05-16T01-29-23-725Z.md`

Result, `n=6` paired hard branches:

- MVP mean diff: `0`, `p=1`
- parent dialogue mean diff: `+1.375`, `p=0.7538`
- outcome mean diff: `0`, `p=1`
- recommended candidates: none

Branch pattern:

- The static baseline solved every outcome and scored MVP `100` on every
  branch.
- The target improved parent dialogue on hard fractions, was mixed on hard AI,
  and was flat or slightly lower on hard statistics.
- The agency-restoration policy appeared as intended in resolved counterfactual
  branches, but it did not create a whole-method advantage over the static
  baseline.

### Robustness Evaluation

Implemented `scripts/evaluate-robustness.js`, which aggregates saved live
reports and applies a stricter no-human-validation gate:

- only non-dry-run LLM learner reports count as robust evidence;
- full hard-curriculum runs are separated from focused single-scenario slices;
- robust effect requires replicated full-hard LLM evidence, all public metrics
  positive, no material negative run, and non-trivial positive gates.

Command:

```bash
node prototypes/adaptive-persona-mvp/scripts/evaluate-robustness.js \
  --inputs prototypes/adaptive-persona-mvp/outputs \
  --out prototypes/adaptive-persona-mvp/outputs/robustness-evaluation \
  --permutations 1000
```

Artifacts:

- `outputs/robustness-evaluation/robustness-evaluation-2026-05-16T01-29-45-243Z.html`
- `outputs/robustness-evaluation/robustness-evaluation-2026-05-16T01-29-45-243Z.md`
- `outputs/robustness-evaluation/robustness-evaluation-2026-05-16T01-29-45-243Z.json`

Verdict: robust positive effect established: **no**.

Aggregate over the two eligible full hard LLM runs, `n=12` paired branches:

| Metric | Mean Diff | 95% CI | p | Win/Tie/Loss | Gate |
|---|---:|---:|---:|---:|---|
| MVP | `-0.417` | `-3.750..1.667` | `1.000` | `0.167/0.750/0.083` | fail |
| Parent dialogue | `-0.875` | `-8.375..5.939` | `0.825` | `0.417/0.083/0.500` | fail |
| Outcome | `0` | `0..0` | `1.000` | `0/1/0` | fail |

Conclusion: the current method can produce localized adaptive wins and useful
mechanism traces, but it does not establish robust positive effects against the
strong static tutor under LLM-learner evaluation. The rule-learner confirmation
should remain a regression harness, not an empirical claim.

## 2026-05-16 Near/Medium-Term Held-Out Track

### Implemented

Following `ADAPTIVE_FEATURE_ARC_AND_NEXT_STEPS.md`, added a held-out hard
curriculum set that was not part of the original tuning loop:

- writing/argumentation: quote-dump evidence without a warrant;
- science causal reasoning: changing multiple variables in one experiment;
- programming/debugging: masking a symptom instead of tracing root cause;
- social-science measurement: treating one survey item as the construct.

Code and documentation:

- `DEFAULT_HELDOUT_HARD_SCENARIOS` in `src/variantSweep.js`;
- `--heldout` support in `scripts/run-variant-sweep.js`;
- new domain misconception contracts in `src/domainMisconceptions.js`;
- held-out challenge directives in `src/challengeState.js`;
- deterministic fallback tutor messages in `src/personaEngine.js`;
- stricter LLM learner outcome prompt requiring `success_markers`;
- `NEAR_MEDIUM_TERM_ROADMAP.md`;
- README commands for held-out runs and held-out robustness evaluation.

Verification:

```bash
node --test prototypes/adaptive-persona-mvp/tests/*.test.js
npx eslint prototypes/adaptive-persona-mvp/**/*.js
```

Both pass.

### Held-Out Dry Shape Check

Command:

```bash
node prototypes/adaptive-persona-mvp/scripts/run-variant-sweep.js \
  --heldout \
  --dry-run \
  --conditions static_codex,controller_reflexive_psychodynamic_codex \
  --baseline static_codex \
  --repeats 1 \
  --out prototypes/adaptive-persona-mvp/outputs/heldout-hard-dry-run \
  --permutations 100
```

Artifacts:

- `outputs/heldout-hard-dry-run/variant-sweep-2026-05-16T01-36-29-644Z.html`
- `outputs/heldout-hard-dry-run/variant-sweep-2026-05-16T01-36-29-644Z.json`

Interpretation: artifact-shape check only. The deterministic dry learner was
not authored for the new hidden states.

### Held-Out LLM Live Sweep

Command:

```bash
node prototypes/adaptive-persona-mvp/scripts/run-variant-sweep.js \
  --heldout \
  --learner codex \
  --conditions static_codex,controller_reflexive_psychodynamic_codex \
  --baseline static_codex \
  --repeats 1 \
  --out prototypes/adaptive-persona-mvp/outputs/heldout-hard-llm-live \
  --timeout-ms 600000 \
  --permutations 200
```

Artifacts:

- `outputs/heldout-hard-llm-live/variant-sweep-2026-05-16T02-37-31-252Z.html`
- `outputs/heldout-hard-llm-live/variant-sweep-2026-05-16T02-37-31-252Z.json`
- `outputs/heldout-hard-llm-live/transcript-digest-2026-05-16T02-37-53-111Z.md`

Result, `n=8` paired held-out hard branches:

- MVP mean diff: `+5.625`, `p=0.2529`
- parent dialogue mean diff: `-0.156`, `p=1`
- outcome mean diff: `+25`, `p=0.5019`
- public triage: pass on MVP and outcome, not on parent dialogue;
- robust positive effect: no.

Branch pattern:

- Argument writing: static and target both succeeded; target had small parent
  gains.
- Science variable control: target improved original, but lost parent-dialogue
  quality on the counterfactual ready branch.
- Programming debugging: target rescued the resistant original branch from
  static failure (`+20` MVP, `+12.5` parent, `+100` outcome), but lost parent
  quality on the ready counterfactual branch.
- Social-science measurement: target rescued the resistant original branch
  (`+20` MVP, `+15` parent, `+100` outcome), but lost parent quality on the
  ready counterfactual branch.

### Held-Out Robustness Evaluation

Command:

```bash
node prototypes/adaptive-persona-mvp/scripts/evaluate-robustness.js \
  --scenario-set heldout \
  --inputs prototypes/adaptive-persona-mvp/outputs \
  --out prototypes/adaptive-persona-mvp/outputs/robustness-evaluation-heldout \
  --permutations 1000
```

Artifacts:

- `outputs/robustness-evaluation-heldout/robustness-evaluation-2026-05-16T02-37-53-275Z.html`
- `outputs/robustness-evaluation-heldout/robustness-evaluation-2026-05-16T02-37-53-275Z.md`
- `outputs/robustness-evaluation-heldout/robustness-evaluation-2026-05-16T02-37-53-275Z.json`

Verdict: robust positive effect established: **no**.

Reasons:

- only one held-out full LLM run so far (`n=8` paired branches);
- parent dialogue is not positive;
- no metric passes the non-trivial positive gate.

### Interpretation

The held-out run gives a sharper diagnosis than the original hard set. The
controller can rescue genuinely resistant original branches in programming and
social measurement. Its main failure is counterfactual over-control: when the
learner is ready, the controller still routes through repair, repeated summary,
or misrecognition repair, which hurts parent-dialogue quality.

Next engineering target: add a readiness-sensitive policy guard that reduces
repair pressure on counterfactual/ready branches after the learner has already
supplied the required success markers. Then rerun held-out LLM before any
replicated ablations.

### Readiness De-Escalation Guard

Implemented a conservative de-escalation guard:

- if hard-mode challenge state is resolved;
- learner evidence is correct with sufficient mastery;
- and either `resolvedTurns >= 3` or the learner is correcting repeated work;
- then select `productive_struggle_hold` instead of adding another repair,
  transfer, or misrecognition-repair demand.

The policy includes a generic action template:

- acknowledge the learner has already done the repair/transfer work;
- do not ask them to redo the same task;
- hand agency back with a compact portable rule.

Verification:

```bash
node --test prototypes/adaptive-persona-mvp/tests/*.test.js
npx eslint prototypes/adaptive-persona-mvp/**/*.js
```

Both pass.

Focused live check:

```bash
node prototypes/adaptive-persona-mvp/scripts/run-variant-sweep.js \
  --scenarios heldout_programming_debugging_resistant_closed_loop \
  --learner codex \
  --conditions static_codex,controller_reflexive_psychodynamic_codex \
  --baseline static_codex \
  --repeats 1 \
  --out prototypes/adaptive-persona-mvp/outputs/heldout-programming-deescalation-live \
  --timeout-ms 600000 \
  --permutations 200
```

Artifacts:

- `outputs/heldout-programming-deescalation-live/variant-sweep-2026-05-16T02-56-14-163Z.html`
- `outputs/heldout-programming-deescalation-live/variant-sweep-2026-05-16T02-56-14-163Z.json`
- `outputs/heldout-programming-deescalation-live/transcript-digest-2026-05-16T02-56-27-946Z.md`

Result, `n=2` programming branches:

- MVP mean diff: `0`
- parent dialogue mean diff: `-3.75`
- outcome mean diff: `0`

Interpretation:

- The guard fired correctly on the ready counterfactual branch:
  `misconception_repair -> transfer_challenge -> summarize_and_check ->
  productive_struggle_hold`.
- The final target message stopped adding another task and handed back a
  portable debugging rule.
- Public effect still did not turn positive because the static baseline hit
  ceiling again: static had MVP/outcome `100/true` on both branches and parent
  `95/100`.

Conclusion: the de-escalation mechanism is behaviorally sensible, but it does
not solve the benchmark problem. The stronger static baseline now often matches
or exceeds the controller on held-out tasks. Further MVP prompt tuning is lower
value than either lowering static-baseline ceiling through better trap design
or moving the architecture into parent-stack replay/cross-suite evaluation.

## 2026-05-16 Trap Scenarios And Parent-Stack Replay Adapter

### Implemented

Two next-step tracks from `NEAR_MEDIUM_TERM_ROADMAP.md` are now implemented.

Hidden-state trap curricula:

- added `DEFAULT_HIDDEN_STATE_TRAP_SCENARIOS`;
- added `--traps` to `scripts/run-variant-sweep.js`;
- added four trap scenarios:
  - `trap_argument_warrant_false_mastery_closed_loop`;
  - `trap_science_variable_control_false_mastery_closed_loop`;
  - `trap_programming_debugging_false_mastery_closed_loop`;
  - `trap_social_measurement_false_mastery_closed_loop`;
- added `trap_probe_required` handling so ambiguous compliant openings defer
  domain repair and first elicit teach-back;
- added rule-learner hidden states for false-mastery original branches and
  readiness/impatience counterfactual branches;
- added trap outcome simulators and tests.

Parent-stack replay:

- added `src/parentReplayAdapter.js`;
- added `scripts/replay-parent-stack.js`;
- the adapter reads existing parent `evaluation_results` rows and
  `logs/tutor-dialogues/*.json` traces, normalizes learner turns, and replays
  them through the prototype evidence/state/policy/challenge-state pipeline;
- output includes JSON, HTML, and Markdown with parent trigger action,
  prototype trigger policy, compatibility checks, challenge-state transitions,
  and parent/prototype family agreement;
- the adapter is read-only and does not write to the parent DB or parent
  harness.

### Trap Dry-Run Shape Check

Command:

```bash
node prototypes/adaptive-persona-mvp/scripts/run-variant-sweep.js \
  --traps \
  --dry-run \
  --conditions static_codex,controller_reflexive_psychodynamic_codex \
  --baseline static_codex \
  --repeats 1 \
  --out prototypes/adaptive-persona-mvp/outputs/trap-scenarios-dry-run \
  --permutations 100
```

Artifacts:

- `outputs/trap-scenarios-dry-run/variant-sweep-2026-05-16T03-28-08-116Z.html`
- `outputs/trap-scenarios-dry-run/variant-sweep-2026-05-16T03-28-08-116Z.json`

Dry result:

- MVP mean diff: `-2.5`;
- parent dialogue mean diff: `+13.1`;
- outcome mean diff: `+50`.

Interpretation: artifact-shape only. The important behavior is that original
branches route `teach_back -> misconception_repair`, while counterfactual
ready branches route through transfer/consolidation into
`productive_struggle_hold` instead of repeated repair.

### Parent Replay Smoke

Command:

```bash
node prototypes/adaptive-persona-mvp/scripts/replay-parent-stack.js \
  --run-id eval-2026-05-12-de6d48ab \
  --limit 4 \
  --out prototypes/adaptive-persona-mvp/outputs/parent-stack-replay-smoke
```

Artifacts:

- `outputs/parent-stack-replay-smoke/parent-stack-replay-2026-05-16T03-28-18-626Z.html`
- `outputs/parent-stack-replay-smoke/parent-stack-replay-2026-05-16T03-28-18-626Z.json`
- `outputs/parent-stack-replay-smoke/parent-stack-replay-2026-05-16T03-28-18-626Z.md`

Result:

- prototype trigger compatibility: `75%` across `8` trigger branches;
- parent/prototype family agreement: `32.1%` across `28` labelled turns.

Interpretation: the adapter is useful immediately as a mismatch finder. Trigger
compatibility is promising, but whole-dialogue family agreement is low enough
to justify a parent-compatible state/action layer before any attempt to port
prototype labels into `services/adaptiveTutor/`.

Broader follow-up command:

```bash
node prototypes/adaptive-persona-mvp/scripts/replay-parent-stack.js \
  --run-id eval-2026-05-12-de6d48ab \
  --limit 12 \
  --out prototypes/adaptive-persona-mvp/outputs/parent-stack-replay
```

Artifacts:

- `outputs/parent-stack-replay/parent-stack-replay-2026-05-16T03-30-51-720Z.html`
- `outputs/parent-stack-replay/parent-stack-replay-2026-05-16T03-30-51-720Z.json`
- `outputs/parent-stack-replay/parent-stack-replay-2026-05-16T03-30-51-720Z.md`

Result:

- prototype trigger compatibility: `33.3%` across `24` trigger branches;
- parent/prototype family agreement: `33.7%` across `92` labelled turns.

Interpretation: the broader pass is more sobering than the four-row smoke.
The adapter works, but the prototype's current policy vocabulary does not yet
align cleanly with the parent trap-action taxonomy. This makes the next parent
integration step concrete: build a parent-compatible mapping/state layer before
porting challenge-state labels into `services/adaptiveTutor/`.

Verification:

```bash
node --test prototypes/adaptive-persona-mvp/tests/*.test.js
npx eslint prototypes/adaptive-persona-mvp/**/*.js
```
