# Continuous Registers, ML, And DAG Grounding

Date: 2026-07-09
Status: paper-update note; exploratory methods rationale, not an empirical result.

## Summary

The continuous register work makes the tutor-stub system ML-ready without yet
turning it into a trained ML policy. The current `dynamical_system` family is a
model-based controller: it builds a learner/discourse/proof state vector, applies
theory priors plus empirical corrections, and maps that state to a register
choice. The continuous variants preserve the nearest discrete
`selected_register` for compatibility, but also expose a weighted
`register_vector`, making the action space closer to actual tutor speech:
mostly precise, partly warm, low briskness, and so on.

The important paper-facing point is not "we trained a tutor." The point is that
the system now defines a measurable transition-learning problem:

```text
s_t = [learner classifier state, learner-DAG state, field values, derivatives, learner profile]
a_t = [register_vector, tutor content/release move]
s_{t+1} = state after the learner's next reply
R_t = proxy reward over mastery gain, risk reduction, leak discipline, learner ownership,
      grounded closure, turn efficiency, and avoidance of premature assertion
```

The empirical variants are the bridge from hand-authored control to learned
control. Today they are empirical corrections over a theory affinity matrix, not
trained policies. With enough transcripts, those corrections can become a
learned transition/reward model that predicts which register blends tend to move
which learner states.

## Why The DAG Matters

The DAG should not be treated as an independent side system. It is the symbolic
grounding layer that makes the dynamical system measurable.

Without the DAG, register adaptation can only be judged by surface cues: the
learner sounded more confident, the tutor sounded warmer, the conversation was
shorter. With the DAG, we can ask whether a turn changed the epistemic state:

- Did the learner ground a public premise?
- Did best-path coverage increase?
- Did missing premise count fall?
- Did the learner assert a hidden answer before warrant?
- Did the tutor leak or repair?
- Did closure occur only after the public evidence licensed it?

This is a proto neuro-symbolic arrangement. The LLM handles interpretation and
fluid speech. The DAG provides symbolic accountability. The register policy maps
measured state into adaptive action. The empirical layer learns, cautiously,
which actions actually improve the measured state.

## Transcript Value For ML

Generated transcripts have real value for training the next layer, but the claim
boundary matters:

- They are simulation data first, useful for fitting priors, testing policy
  families, estimating local transition geometry, and finding failure modes.
- They are not direct human-learning evidence until compared against held-out
  worlds, held-out learner profiles, independent judges, and eventually human
  learner traces.
- The immediate ML target should be a lightweight transition/reward model, not
  tutor fine-tuning.

The useful training row is per turn, not just per dialogue:

```text
run_id, world_id, learner_profile, policy, turn
state_vector_before, derivative_vector_before, DAG features before
register_vector, selected_register, policy distribution / propensity
tutor text, learner text
next DAG features, next state vector, next field values
delta mastery, delta risk, delta coverage, leak event, grounded closure
```

Once that exists, the first models should be deliberately simple:

- Ridge/logistic or gradient-boosted models predicting next-state deltas.
- Off-policy evaluation using logged policy distributions where available.
- Held-out tests by world and learner profile.
- Only later, if those baselines work, a learned policy that replaces or
  corrects the hand-authored affinity matrix.

## Relation To The Jacobian

The Jacobian becomes meaningful only after we have turn-level transition data. It
would estimate the local response of outcomes to small changes in register
weights:

```text
d(next mastery, risk, coverage, leak probability, closure pressure)
/
d(precise, warm, brisk, witnessing, ...)
```

For now, that is future work. The continuous register vector is the necessary
action representation; the new per-turn transcript/SQL capture is the necessary
data substrate.

## Implementation Note

The current trace and report pipeline now captures the required substrate in two
forms:

- On disk, auto-eval JSON rows include `trainingExamples`, derived from the
  transcript drilldown and animated visualization frames.
- In SQLite ingest, `tutor_stub_turn_frames` normalizes those examples into
  queryable per-turn rows, and `v_tutor_stub_turn_training` exposes the fields
  needed for transition/reward-model export.

Raw JSONL traces still preserve full `turnRecord` objects, including learner
text, tutor text, classifier output, tutor-side learner-DAG model/update,
register selection, continuous vector metadata, leak audit, and usage. The
summary and DB layers now make those fields easier to query without reparsing
every trace line.

## Suggested Next Steps

1. Run an adaptive QA matrix with continuous policies across learner profiles
   and at least two worlds, ingest the summaries, and inspect
   `v_tutor_stub_turn_training`.
2. Add a dataset export script that materializes a stable train/test split from
   `tutor_stub_turn_frames`.
3. Fit baseline transition/reward models before attempting policy learning.
4. Estimate whether continuous register weights add predictive value beyond the
   nearest discrete `selected_register`.
5. Use held-out worlds/profiles before making any paper claim; treat simulation
   results as exploratory until human or independently adjudicated validation.
