# Hard-Mode Adaptation Design

The earlier disciplinary runs exposed a ceiling problem: a strong static
Socratic baseline could score highly when the synthetic learner accepted one
well-formed contrast and immediately transferred. Hard mode makes that easier
benchmark insufficient.

## What Changed

### Hard Curricula

`config/assessment-scenarios.yaml` now includes three hard scenarios:

- `hard_fractions_forgetful_resistant_closed_loop`
- `hard_ai_bias_resistant_closed_loop`
- `hard_stats_confounding_skeptical_closed_loop`

Each uses `max_tutor_turns: 3` and a `challenge_profile` with stressors such as:

- apparent forgetfulness;
- misconception reversion;
- skepticism toward the teacher;
- disinterest;
- mild resistance.

### Hard Rule Learner

`src/dynamicLearner.js` now includes hard hidden states:

- `denominator_forgetful_resistant`
- `fraction_partition_skeptical_ready`
- `ai_bias_resistant_single_cause`
- `ai_bias_skeptical_evidence_ready`
- `correlation_skeptical_forgetful`
- `confounding_skeptical_ready`

The hard learner does not automatically improve after a polished explanation.
For original misconception branches, the first useful tutor move usually
produces a partial, resistant, or forgetful response. The tutor must detect that
reversion and repair again before transfer opens.

### Hard Rubric Addendum

`config/hard-adaptation-rubric.yaml` documents the hard-mode rubric addendum.
`src/assessmentPrompts.js` injects the addendum into the blind judge prompt when
`challenge_profile.mode = hard`.

The hard judge instructions cap high scores when:

- the tutor gives a correct explanation but does not recover after learner
  resistance;
- the learner never performs the key comparison, audit, or causal test;
- the tutor treats skepticism as defiance rather than evidence to investigate;
- the outcome answer merely repeats tutor language without transferring.

### Domain Repair Templates

The AI-bias and statistics templates were tightened:

- AI bias: the learner must choose two remaining sources and an audit rather
  than passively receiving a list of possible causes.
- Statistics: the learner must propose what else could move both variables and
  what comparison would convince a skeptic.

## Why This Is Harder For The Baseline

The static baseline still receives the visible transcript and can respond well.
It does not receive learner-state, policy, repair debt, or reflexive memory.
Hard mode therefore tests whether a tutor can notice that a learner has
reverted, resisted, or forgotten after an initially plausible intervention.

A high score now requires a trajectory:

```text
misconception -> targeted contrast -> resistance/forgetting -> second repair
-> learner-owned evidence -> transfer
```

That is closer to the adaptive-tutor claim than a single clean misconception
repair.
