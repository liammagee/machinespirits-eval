# Yoked-contingency G0 paid smoke preregistration

Date: 2026-06-23

This is a bounded paid-quota smoke, not the full G0 gate and not the G1 yoked-contingency experiment.

## Question

Can a seeded fractions learner be opaque in visible prose while remaining diagnosable from item behavior?

The deterministic smoke already checks the causal geometry. This paid smoke checks the first real bottleneck: whether model-generated learner utterances leak the hidden seeded misconception state before we spend on yoked tutor arms.

## Frozen scope

- Runner: `scripts/run-yoked-contingency-g0-paid-smoke.js`
- Backend default: `codex` for learner prose generation
- Classifier default: `claude-code` for prose-only blinded classification
- Sessions: 3
- Items per session: 4
- Max model calls: 18
- Seeds: `alpha`, `beta`, `gamma`
- Output artifacts:
  - `exports/yoked-contingency-g0-paid-smoke.json`
  - `exports/yoked-contingency-g0-paid-smoke.md`

## Analysis rule

For each session:

1. Hidden state is the fixed seed table used by the deterministic harness.
2. Behavior diagnosis uses pretest item responses and the existing item-family tags.
3. Prose diagnosis gives the classifier only the generated learner prose, not item stems, selected answers, correctness, or family tags.

The smoke read is `pass_g0_paid_smoke` only if:

- behavior recovers the active families exactly for every session;
- mean prose recall of active families is at or below 0.25;
- no exact hidden family label appears in generated learner prose.

Otherwise the read is `fail_g0_paid_smoke`.

## Stop rule

Do not run G1 from this smoke if G0 fails. If the CLI backend is unavailable, auth fails, or parsing fails enough to exceed the call cap, record the blocker and stop.

No prompt or threshold tuning after seeing paid outputs in this smoke.
