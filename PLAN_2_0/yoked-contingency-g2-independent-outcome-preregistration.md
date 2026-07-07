# Yoked-contingency G2 independent-outcome preregistration

Date: 2026-06-23

This run is the first attempt to convert the G1 causal-geometry result into a candidate main-paper empirical claim. It is still a bounded smoke, not a paper claim by itself.

## Prior limitation

G1 passed both the bounded and scaled checks, but its primary outcome was deterministic: plan target families were mapped to expected posttest correctness. That proves the yoked-contingency machinery and the diagnostic contrast, but it does not yet show that independent learner behavior improves.

## Question

Using the already generated G1 tutor plans, does a held-out learner model answer posttest items better after same-state yoked plans than after different-state yoked plans?

## Frozen scope

- Runner: `scripts/run-yoked-contingency-g2-independent-outcome.js`
- Input G1 plan artifact: `exports/yoked-contingency-g1-paid-smoke.json`
- Learner backend: `claude-code`
- Sessions: all sessions in the input artifact
- Arms: `contingent`, `same_seed_yoked`, `different_seed_yoked`
- Model calls: 9 planned, 12 maximum
- Output artifacts:
  - `exports/yoked-contingency-g2-independent-outcome-smoke.json`
  - `exports/yoked-contingency-g2-independent-outcome-smoke.md`

## Blinding and leakage rules

The learner prompt may see:

- its pretest item stems;
- its selected pretest answers;
- accepted/not-accepted feedback;
- visible affect-only learner prose;
- the intervention text from the tutor plan;
- held-out posttest item stems and choices.

The learner prompt must not see:

- hidden seed IDs;
- target-family labels;
- arm labels;
- source learner IDs;
- G1 deterministic gains;
- posttest answer keys.

## Analysis rule

The primary outcome is exact posttest item correctness from the learner model's selected choices.

- Δ1 responsiveness/coherence = mean gain(`contingent`) - mean gain(`same_seed_yoked`)
- Δ2 diagnosis = mean gain(`same_seed_yoked`) - mean gain(`different_seed_yoked`)

The smoke passes only if:

- every learner response is parseable;
- invalid posttest choice rate is 0;
- hidden family label leaks into learner prompts are 0;
- Δ2 diagnosis is greater than 0;
- at least 2 of 3 sessions have same-seed yoked gain greater than different-seed yoked gain.

## Stop rule

Run a scaled G2 only if this smoke passes. If this smoke fails because the held-out learner is ceilinged or insensitive to interventions, do not convert G1 into a main-paper claim without a stronger learner/outcome design.
