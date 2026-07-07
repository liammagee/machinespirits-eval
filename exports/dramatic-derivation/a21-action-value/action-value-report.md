# A21 Action-Value Microbench Report

Generated: 2026-06-16T15:18:39.929Z

## Boundary

- Status: zero-paid deterministic microbench.
- Runtime policy changes: none.
- Fresh paid validation: blocked until replay gates are explicitly implemented and pass.
- Selector/H/V defaults: unchanged.

## Sources

- Trials: `exports/dramatic-derivation/a21-action-value/microbench-trials.jsonl`
- Fixture: `exports/dramatic-derivation/a21-action-value/hethel-trigger-fixture.json`
- Fixture hash: `e4877f7c55a245ef65174a2480d246264552e735fd49fec899a26fd866706e4e`
- Command: `node scripts/a21-analyze-microbench.js --trials exports/dramatic-derivation/a21-action-value/microbench-trials.jsonl --out exports/dramatic-derivation/a21-action-value/action-value-report.md`
- Assignment probability: 0.25

## Decision

- Category: `release_beats_diagnostic`
- Top action(s): `B_RELEASE_P_POINT`
- Best mean reward: 9

This is an action-value result, not a production policy promotion. If a patch is proposed later, it must be separately gated by Hethel replay against hidden+proofDebt.

## Action Summary

| action | family | n | mean reward | mean D delta | owns target | uses released evidence | on-schedule release | delayed release | aporia | non-leak | generator | failures |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| B_RELEASE_P_POINT | release_next_evidence | 1 | 9 | -1 | 0 | 1 | 1 | 0 | 0 | 1 | 1 | none:1 |
| C_RESTAGE_P_POINT | repair_dependency | 1 | 7 | -1 | 1 | 0 | 0 | 1 | 0 | 1 | 1 | none:1 |
| D_CONSOLIDATE_THEN_RELEASE | consolidate_subproof | 1 | 2 | 0 | 0 | 0 | 0 | 1 | 0 | 1 | 1 | release_starvation:1 |
| A_DIAG_CONFLICT | ask_diagnostic | 1 | -5 | 0 | 0 | 0 | 0 | 1 | 1 | 1 | 1 | aporia:1 |

## Reward Component Means

| action | DDecrease | targetDependencyOwned | learnerUsesReleasedEvidence | engagementMaintained | noLeak | generatorCompliance | releaseOnSchedule | diagnosticRepetitionPenalty | delayedReleasePenalty | earlyReleasePenalty | aporiaPenalty | disengagementPenalty | overScaffoldingPenalty |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| B_RELEASE_P_POINT | 2 | 0 | 2 | 1 | 2 | 1 | 1 | 0 | 0 | 0 | 0 | 0 | 0 |
| C_RESTAGE_P_POINT | 2 | 3 | 0 | 1 | 2 | 1 | 0 | 0 | -2 | 0 | 0 | 0 | 0 |
| D_CONSOLIDATE_THEN_RELEASE | 0 | 0 | 0 | 1 | 2 | 1 | 0 | 0 | -2 | 0 | 0 | 0 | 0 |
| A_DIAG_CONFLICT | 0 | 0 | 0 | 0 | 2 | 1 | 0 | -2 | -2 | 0 | -4 | 0 | 0 |

## Reward Weights

- DDecrease: 2
- targetDependencyOwned: 3
- learnerUsesReleasedEvidence: 2
- engagementMaintained: 1
- noLeak: 2
- generatorCompliance: 1
- releaseOnSchedule: 1
- diagnosticRepetitionPenalty: -2
- delayedReleasePenalty: -2
- earlyReleasePenalty: -1
- aporiaPenalty: -4
- disengagementPenalty: -6
- overScaffoldingPenalty: -2

## Interpretation

The deterministic fixture favors releasing the due public point over repeating the diagnostic. This matches the contrastive Hethel autopsy: the failed overlay was locally compliant but starved proof progress, while the hidden+proofDebt success advanced by releasing `p_point`.

## Caveats

- The learner-state simulator is finite-state and deterministic.
- The report ranks local transition value only; final grounding still requires replay and fresh first-pass validation.
- The fixture retains observed hidden/failed contrasts as provenance but does not encode a winner in the action set.

