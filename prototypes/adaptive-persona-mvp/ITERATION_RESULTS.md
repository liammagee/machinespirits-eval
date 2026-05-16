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

Both pass.

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
