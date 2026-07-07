# Yoked-contingency G2 hard-transfer preregistration

Date: 2026-06-24

This variant follows the standard and calibrated-novice scaled G2 failures. Both failures showed a ceiling problem: different-seed tutoring often produced perfect posttest scores. The next gate therefore replaces the placeholder pilot posttest with a harder held-out transfer posttest with targeted distractors.

## Frozen scope

- Runner: `scripts/run-yoked-contingency-g2-independent-outcome.js`
- Learner protocol: `calibrated-novice`
- Posttest profile: `hard-transfer`
- Hard-transfer items: `config/yoked-contingency-hard-transfer-items.json`
- Input G1 plan artifact: `exports/yoked-contingency-g1-paid-smoke.json`
- Learner backend: `claude-code`
- Sessions: all sessions in the input artifact
- Arms: `contingent`, `same_seed_yoked`, `different_seed_yoked`
- Model calls: 9 planned, 12 maximum
- Output artifacts:
  - `exports/yoked-contingency-g2-hard-transfer-smoke.json`
  - `exports/yoked-contingency-g2-hard-transfer-smoke.md`

## Analysis rule

The primary outcome is exact posttest item correctness from selected choices. The same blinding rules apply: no seed IDs, arm labels, source learner IDs, target-family labels, deterministic gains, or posttest answer keys may be shown to the learner.

The smoke passes only if:

- every learner response is parseable;
- invalid posttest choice rate is 0;
- hidden family label leaks into learner prompts are 0;
- Δ2 diagnosis is greater than 0;
- at least 2 of 3 sessions have same-seed yoked gain greater than different-seed yoked gain.

Run the hard-transfer scaled variant only if this smoke passes.
