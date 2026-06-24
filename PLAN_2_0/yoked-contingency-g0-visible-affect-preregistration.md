# Yoked-contingency G0 visible-affect preregistration

Date: 2026-06-23

This variant follows the failed open-rationale G0 paid smoke. It is a new bounded paid-quota G0 smoke, not a retuning of the failed artifact and not the G1 yoked-contingency experiment.

## Prior failure

`exports/yoked-contingency-g0-paid-smoke.md` failed because learner prose carried arithmetic rationale. Behavior diagnosis was exact in 3/3 sessions, but the visible utterances disclosed item-level reasoning such as operating on numerators/denominators or using denominator magnitude.

## Repair hypothesis

The G0 estimand requires separating two channels:

1. item behavior logs carry diagnostic evidence;
2. visible learner prose carries affective or epistemic stance, not arithmetic rationale.

If a downstream tutor is meant to receive explicit learner rationale in prose, that is a different estimand and should not use this G0/G1 design.

## Frozen scope

- Runner: `scripts/run-yoked-contingency-g0-paid-smoke.js`
- Prose protocol: `visible-affect`
- Backend default for this run: `codex`
- Classifier default for this run: `claude-code`
- Sessions: 3
- Items per session: 4
- Max model calls: 18
- Seeds: `alpha`, `beta`, `gamma`
- Output artifacts:
  - `exports/yoked-contingency-g0-visible-affect.json`
  - `exports/yoked-contingency-g0-visible-affect.md`

## Analysis rule

The visible-affect protocol passes only if:

- behavior recovers the active families exactly for every session;
- mean prose recall of active families is at or below 0.25;
- no exact hidden family label appears in generated learner prose;
- no visible arithmetic-rationale leak is detected by the frozen lexical guard.

The classifier receives only generated learner prose, not item stems, selected answers, correctness, behavior logs, hidden seeds, or family tags.

## Stop rule

If this variant fails because learner prose still leaks arithmetic rationale, repair the prompt once and rerun a new preregistered variant. If this variant fails only because the prose-only classifier over-infers from generic affective language, run one independent cross-check classifier before declaring exhaustion. Do not run G1 unless a G0 variant passes its frozen rule.
