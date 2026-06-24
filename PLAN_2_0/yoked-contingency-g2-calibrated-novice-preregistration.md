# Yoked-contingency G2 calibrated-novice preregistration

Date: 2026-06-24

This variant follows the standard independent-outcome scaled failure. It is designed to address the observed ceiling effect: the held-out learner model often answered every posttest item correctly, including after different-seed tutoring.

## Prior failure

`exports/yoked-contingency-g2-independent-outcome-scaled.md` failed its frozen scaled rule despite positive mean Δ2 because same-seed gain exceeded different-seed gain in only 2/9 sessions. Inspection showed the held-out learner was frequently at posttest ceiling.

## Repair hypothesis

For simulated-learner outcome generation, the learner model must be calibrated to the pretest pattern. It should not solve as the base model. It should preserve misconceptions shown in rejected pretest answers unless the tutoring messages plausibly address the same kind of reasoning.

## Frozen scope

- Runner: `scripts/run-yoked-contingency-g2-independent-outcome.js`
- Learner protocol: `calibrated-novice`
- Input G1 plan artifact: `exports/yoked-contingency-g1-paid-smoke.json`
- Learner backend: `claude-code`
- Sessions: all sessions in the input artifact
- Arms: `contingent`, `same_seed_yoked`, `different_seed_yoked`
- Model calls: 9 planned, 12 maximum
- Output artifacts:
  - `exports/yoked-contingency-g2-calibrated-novice-smoke.json`
  - `exports/yoked-contingency-g2-calibrated-novice-smoke.md`

## Analysis rule

The primary outcome remains exact posttest item correctness from selected choices. The same blinding rules apply: no seed IDs, arm labels, source learner IDs, target-family labels, deterministic gains, or posttest answer keys may be shown to the learner.

The smoke passes only if:

- every learner response is parseable;
- invalid posttest choice rate is 0;
- hidden family label leaks into learner prompts are 0;
- Δ2 diagnosis is greater than 0;
- at least 2 of 3 sessions have same-seed yoked gain greater than different-seed yoked gain.

Run the scaled calibrated-novice variant only if this smoke passes.
