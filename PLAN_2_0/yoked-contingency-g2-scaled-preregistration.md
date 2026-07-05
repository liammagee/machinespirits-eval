# Yoked-contingency G2 scaled independent-outcome preregistration

Date: 2026-06-23

This scaled follow-up is permitted only if `exports/yoked-contingency-g2-independent-outcome-smoke.md` passes its frozen smoke rule.

## Frozen scope

- Runner: `scripts/run-yoked-contingency-g2-independent-outcome.js`
- Input G1 plan artifact: `exports/yoked-contingency-g1-scaled.json`
- Learner backend: `claude-code`
- Sessions: all sessions in the input artifact
- Arms: `contingent`, `same_seed_yoked`, `different_seed_yoked`
- Model calls: 27 planned, 30 maximum
- Output artifacts:
  - `exports/yoked-contingency-g2-independent-outcome-scaled.json`
  - `exports/yoked-contingency-g2-independent-outcome-scaled.md`

## Analysis rule

The primary outcome is exact posttest item correctness from the learner model's selected choices.

The scaled run passes only if:

- every learner response is parseable;
- invalid posttest choice rate is 0;
- hidden family label leaks into learner prompts are 0;
- Δ2 diagnosis is greater than 0;
- at least 6 of 9 sessions have same-seed yoked gain greater than different-seed yoked gain;
- a paired sign test for same-seed gain > different-seed gain has one-sided p <= 0.10.

If the scaled run fails, the project has not achieved the main-paper claim yet.
