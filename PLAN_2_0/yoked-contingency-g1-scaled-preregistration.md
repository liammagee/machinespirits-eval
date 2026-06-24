# Yoked-contingency G1 scaled follow-up preregistration

Date: 2026-06-23

This scaled follow-up is permitted only if `exports/yoked-contingency-g1-paid-smoke.md` passes its frozen smoke rule.

## Frozen scope

- Runner: `scripts/run-yoked-contingency-g1-paid-smoke.js`
- Backend: `codex`
- Sessions: 9
- Arms per session: `contingent`, `same_seed_yoked`, `different_seed_yoked`
- Model calls: 27 planned, 30 maximum
- Visible prose protocol: `visible-affect`
- Outputs:
  - `exports/yoked-contingency-g1-scaled.json`
  - `exports/yoked-contingency-g1-scaled.md`

## Analysis rule

The scaled run uses the same programmatic expected-correct outcome and the same contrasts:

- Δ1 responsiveness/coherence = mean gain(`contingent`) - mean gain(`same_seed_yoked`)
- Δ2 diagnosis = mean gain(`same_seed_yoked`) - mean gain(`different_seed_yoked`)

The scaled run passes only if:

- source behavior recovery is exact for every generated plan;
- no plan uses an invalid family label;
- same-seed yoked plans target more active target families than different-seed yoked plans;
- Δ2 diagnosis is at least 0.05;
- at least 7 of 9 sessions have same-seed yoked gain greater than different-seed yoked gain;
- Δ1 is non-negative.

If the scaled run fails, do not treat the bounded smoke as sufficient evidence for G1.
