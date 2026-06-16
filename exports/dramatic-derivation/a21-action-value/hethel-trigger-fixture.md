# A21 Hethel Trigger Fixture

Generated: 2026-06-16T15:07:50.262Z

- Fixture ID: `hethel-trigger-fixture`
- Fixture hash: `e4877f7c55a245ef65174a2480d246264552e735fd49fec899a26fd866706e4e`
- Trigger turn: 4
- Prefix source: `exports/dramatic-derivation/loop/hethel-phase5g-a20-fresh-selective-v4-r1`
- Prefix through turn: 3
- Primary label: `release_starvation`
- Validation: pass

## Candidate Actions

| action | family | release now | hold | risk |
|---|---|---|---|---|
| A_DIAG_CONFLICT | ask_diagnostic |   | p_point | May repeat the A20 maintenance pattern after diagnostic budget exhaustion. |
| B_RELEASE_P_POINT | release_next_evidence | p_point |   | May advance before the dependency is owned. |
| C_RESTAGE_P_POINT | repair_dependency |   | p_point | May be only a dressed-up consolidation move if p_point has not actually been seen. |
| D_CONSOLIDATE_THEN_RELEASE | consolidate_subproof |   | p_point | May become another maintenance move that delays proof advance. |

## Boundary

The fixture preserves the failed overlay dialogue prefix through turn 3, then leaves turn 4 open for action-value trials. Observed hidden/failed turn-4 outcomes are stored only as provenance, not as an encoded winner.
