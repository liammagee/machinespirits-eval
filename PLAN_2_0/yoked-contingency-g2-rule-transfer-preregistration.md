# Yoked-contingency G2 rule-transfer novice preregistration

Date: 2026-06-24

This variant follows the hard-transfer scaled failure. The hard-transfer run reached positive mean Δ2 and 6/9 same-seed wins, but it missed the preregistered sign-test threshold because the held-out learner still solved several different-seed posttest items at ceiling.

## Repair hypothesis

The held-out learner should act as a simulated novice whose behavior is anchored in its rejected pretest answers. It should infer local novice rules from the pretest and apply them to analogous posttest items unless the tutoring messages directly address that rule.

## Frozen scope

- Runner: `scripts/run-yoked-contingency-g2-independent-outcome.js`
- Learner protocol: `rule-transfer-novice`
- Posttest profile: `hard-transfer`
- Input G1 plan artifact: `exports/yoked-contingency-g1-paid-smoke.json`
- Learner backend: `claude-code`
- Sessions: all sessions in the input artifact
- Arms: `contingent`, `same_seed_yoked`, `different_seed_yoked`
- Model calls: 9 planned, 12 maximum
- Output artifacts:
  - `exports/yoked-contingency-g2-rule-transfer-smoke.json`
  - `exports/yoked-contingency-g2-rule-transfer-smoke.md`

## Analysis rule

The primary outcome is exact posttest item correctness from selected choices. The same blinding rules apply: no seed IDs, arm labels, source learner IDs, target-family labels, deterministic gains, or posttest answer keys may be shown to the learner.

The smoke passes only if:

- every learner response is parseable;
- invalid posttest choice rate is 0;
- hidden family label leaks into learner prompts are 0;
- Δ2 diagnosis is greater than 0;
- at least 2 of 3 sessions have same-seed yoked gain greater than different-seed yoked gain.

Run the scaled rule-transfer variant only if this smoke passes.
