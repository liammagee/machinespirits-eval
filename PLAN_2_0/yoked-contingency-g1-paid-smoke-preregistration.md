# Yoked-contingency G1 paid smoke preregistration

Date: 2026-06-23

This is the first bounded paid-quota G1 smoke after the visible-affect G0 pass. It is not a full battery and not a paper claim.

## Question

When visible learner prose is non-diagnostic, does a tutor plan generated from another learner with the same hidden behavior state help the target learner more than a tutor plan generated from another learner with a different hidden behavior state?

## Frozen scope

- Runner: `scripts/run-yoked-contingency-g1-paid-smoke.js`
- Backend: `codex`
- Sessions: 3
- Arms per session:
  - `contingent`: plan generated from the target learner's own behavior log
  - `same_seed_yoked`: plan generated from a peer behavior log with the same hidden seed
  - `different_seed_yoked`: plan generated from a peer behavior log with a different hidden seed
- Model calls: 9 planned, 12 maximum
- Visible prose protocol: `visible-affect`
- Outputs:
  - `exports/yoked-contingency-g1-paid-smoke.json`
  - `exports/yoked-contingency-g1-paid-smoke.md`

## Analysis rule

The primary outcome is programmatic expected pre/post item correctness, not an LLM judge.

- Δ1 responsiveness/coherence = mean gain(`contingent`) - mean gain(`same_seed_yoked`)
- Δ2 diagnosis = mean gain(`same_seed_yoked`) - mean gain(`different_seed_yoked`)

The smoke passes only if:

- source behavior recovery is exact for every generated plan;
- no plan uses an invalid family label;
- same-seed yoked plans target more active target families than different-seed yoked plans;
- Δ2 diagnosis is at least 0.05;
- Δ1 is non-negative.

## Scale rule

Run the scaled preregistered version only if this bounded smoke passes. If it fails, inspect the failure mode and do not scale from this result.
