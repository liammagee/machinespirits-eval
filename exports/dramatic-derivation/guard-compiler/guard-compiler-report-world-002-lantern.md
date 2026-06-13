# Guard compiler replay report: The Light on the Knock

Static P1a slice only: WorldIR + GuardSpec compilation and dry replay over archived arms. No live runtime behavior, model calls, database writes, or new k-fans.

## WorldIR summary

- World: `world_002_lantern`
- Premises: 10
- Release entries: 8
- Proof paths: 4
- Secret proof root rule: `R4_light`
- Secret top-level branches: 2
- Independent top-level join: no

| branch | root predicate | base premises |
|---|---|---|
| `secret_branch_1` | `steeredByLampOf` | `p_bearing`, `p_chart`, `p_glimpse`, `p_residue` |
| `secret_branch_2` | `litLampOf` | `p_ferry`, `p_glimpse`, `p_key`, `p_residue`, `p_skiff` |

## GuardSpec summary

- Hidden pacing premises: 3
- Visible projection status: `candidate_requires_replay`
- Proof-debt tutor view: `premiseId`, `surface`, `sinceTurn`

| premise | scheduled | safe turns | unsafe turns |
|---|---:|---|---|
| `p_bearing` | t4 | t4, t5, t6 | t2:aporia, t3:aporia |
| `p_chart` | t9 | t8, t9 | t7:aporia, t10:aporia, t11:aporia |
| `p_key` | t17 | t15, t16, t17, t18 | t19:disengagement |

## Archived replay

| guard state | grounded | early_pull_death | decay_seating_death | n |
|---|---:|---:|---:|---:|
| `unguarded` | 4 | 6 | 0 | 10 |
| `pacing` | 4 | 0 | 1 | 5 |
| `visible` | 5 | 0 | 0 | 5 |

## Played-release safety replay

| guard state | arms | played releases | unsafe played releases | guard interventions |
|---|---:|---:|---:|---:|
| `unguarded` | 10 | 23 | 17 | 0 |
| `pacing` | 5 | 13 | 0 | 0 |
| `visible` | 5 | 15 | 8 | 2 |

## Arm details

| arm | verdict | guard | failure mode | unsafe releases | key evidence |
|---|---|---|---|---:|---|
| `lantern-e2-real-r1` | disengagement t12 | `unguarded` | `early_pull_death` | 2 | tempo-insolvent tutor release(s): p_bearing@t3, p_chart@t7 |
| `lantern-e2-real-r2` | grounded_anagnorisis t20 | `unguarded` | `grounded` | 3 | grounded verdict; no detector split applied |
| `lantern-e2-real-r3` | grounded_anagnorisis t20 | `unguarded` | `grounded` | 3 | grounded verdict; no detector split applied |
| `lantern-e2-real-r4` | grounded_anagnorisis t20 | `unguarded` | `grounded` | 0 | grounded verdict; no detector split applied |
| `lantern-e2-real-r5` | disengagement t12 | `unguarded` | `early_pull_death` | 2 | tempo-insolvent tutor release(s): p_bearing@t3, p_chart@t7 |
| `lantern-e2-real-r6` | disengagement t12 | `unguarded` | `early_pull_death` | 2 | tempo-insolvent tutor release(s): p_bearing@t3, p_chart@t7 |
| `lantern-e2-real-r7` | disengagement t12 | `unguarded` | `early_pull_death` | 2 | tempo-insolvent tutor release(s): p_bearing@t3, p_chart@t7 |
| `lantern-e2-real-r8` | disengagement t12 | `unguarded` | `early_pull_death` | 2 | tempo-insolvent tutor release(s): p_bearing@t3, p_chart@t7 |
| `lantern-e2-real-r9` | grounded_anagnorisis t20 | `unguarded` | `grounded` | 0 | grounded verdict; no detector split applied |
| `lantern-e2-real-r10` | aporia t8 | `unguarded` | `early_pull_death` | 1 | tempo-insolvent tutor release(s): p_bearing@t3 |
| `lantern-e2-guard-r1` | disengagement t7 | `pacing` | `decay_seating_death` | 0 | 1 unrepaired dropped premise(s) at end |
| `lantern-e2-guard-r2` | grounded_anagnorisis t20 | `pacing` | `grounded` | 0 | grounded verdict; no detector split applied |
| `lantern-e2-guard-r3` | grounded_anagnorisis t20 | `pacing` | `grounded` | 0 | grounded verdict; no detector split applied |
| `lantern-e2-guard-r4` | grounded_anagnorisis t20 | `pacing` | `grounded` | 0 | grounded verdict; no detector split applied |
| `lantern-e2-guard-r5` | grounded_anagnorisis t20 | `pacing` | `grounded` | 0 | grounded verdict; no detector split applied |
| `lantern-e2-visible-r1` | grounded_anagnorisis t20 | `visible` | `grounded` | 0 | grounded verdict; no detector split applied |
| `lantern-e2-visible-r2` | grounded_anagnorisis t20 | `visible` | `grounded` | 2 | grounded verdict; no detector split applied |
| `lantern-e2-visible-r3` | grounded_anagnorisis t20 | `visible` | `grounded` | 2 | grounded verdict; no detector split applied |
| `lantern-e2-visible-r4` | grounded_anagnorisis t20 | `visible` | `grounded` | 2 | grounded verdict; no detector split applied |
| `lantern-e2-visible-r5` | grounded_anagnorisis t20 | `visible` | `grounded` | 2 | grounded verdict; no detector split applied |

