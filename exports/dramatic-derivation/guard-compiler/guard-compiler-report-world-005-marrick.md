# Guard compiler replay report: The Light Shillings

Static P1a slice only: WorldIR + GuardSpec compilation and dry replay over archived arms. No live runtime behavior, model calls, database writes, or new k-fans.

## WorldIR summary

- World: `world_005_marrick`
- Premises: 9
- Release entries: 9
- Proof paths: 1
- Secret proof root rule: `R5_strike`
- Secret top-level branches: 2
- Independent top-level join: yes

| branch | root predicate | base premises |
|---|---|---|
| `secret_branch_1` | `castBlankFor` | `p_alloy`, `p_caster`, `p_crucible` |
| `secret_branch_2` | `cutDieFor` | `p_flaw`, `p_graver`, `p_holder` |

## GuardSpec summary

- Hidden pacing premises: 4
- Visible projection status: `uncertified_topology_risk`
- Proof-debt tutor view: `premiseId`, `surface`, `sinceTurn`

| premise | scheduled | safe turns | unsafe turns |
|---|---:|---|---|
| `p_alloy` | t4 | t3, t4, t5, t6 | t2:aporia |
| `p_crucible` | t8 | t6, t7, t8, t9 | t10:aporia |
| `p_flaw` | t14 | t13, t14, t15 | t12:disengagement, t16:aporia |
| `p_graver` | t18 | t17, t18, t19 | t16:disengagement, t20:disengagement |

## Archived replay

| guard state | grounded | early_pull_death | decay_seating_death | n |
|---|---:|---:|---:|---:|
| `unguarded` | 0 | 2 | 3 | 5 |
| `pacing` | 5 | 0 | 0 | 5 |
| `visible` | 0 | 5 | 0 | 5 |

## Played-release safety replay

| guard state | arms | played releases | unsafe played releases | guard interventions |
|---|---:|---:|---:|---:|
| `unguarded` | 5 | 16 | 2 | 0 |
| `pacing` | 5 | 20 | 0 | 0 |
| `visible` | 5 | 20 | 7 | 9 |

## Arm details

| arm | verdict | guard | failure mode | unsafe releases | key evidence |
|---|---|---|---|---:|---|
| `marrick-real-r1` | disengagement t21 | `unguarded` | `early_pull_death` | 1 | tempo-insolvent tutor release(s): p_graver@t16 |
| `marrick-real-r2` | disengagement t21 | `unguarded` | `early_pull_death` | 1 | tempo-insolvent tutor release(s): p_graver@t16 |
| `marrick-real-r3` | aporia t12 | `unguarded` | `decay_seating_death` | 0 | 2 unrepaired dropped premise(s) at end; 0 lucky leap(s), 1 overreach event(s); terminal learner text names dropped premise(s): m_caster, p_crucible |
| `marrick-real-r4` | aporia t8 | `unguarded` | `decay_seating_death` | 0 | 2 unrepaired dropped premise(s) at end |
| `marrick-real-r5` | disengagement t21 | `unguarded` | `decay_seating_death` | 0 | 2 unrepaired dropped premise(s) at end; 0 lucky leap(s), 1 overreach event(s); terminal learner text names dropped premise(s): p_caster |
| `marrick-guard-r1` | grounded_anagnorisis t22 | `pacing` | `grounded` | 0 | grounded verdict; no detector split applied |
| `marrick-guard-r2` | grounded_anagnorisis t22 | `pacing` | `grounded` | 0 | grounded verdict; no detector split applied |
| `marrick-guard-r3` | grounded_anagnorisis t22 | `pacing` | `grounded` | 0 | grounded verdict; no detector split applied |
| `marrick-guard-r4` | grounded_anagnorisis t22 | `pacing` | `grounded` | 0 | grounded verdict; no detector split applied |
| `marrick-guard-r5` | grounded_anagnorisis t22 | `pacing` | `grounded` | 0 | grounded verdict; no detector split applied |
| `marrick-visible-r1` | disengagement t21 | `visible` | `early_pull_death` | 2 | tempo-insolvent tutor release(s): p_flaw@t12, p_graver@t16 |
| `marrick-visible-r2` | disengagement t21 | `visible` | `early_pull_death` | 2 | tempo-insolvent tutor release(s): p_flaw@t12, p_graver@t16 |
| `marrick-visible-r3` | disengagement t21 | `visible` | `early_pull_death` | 1 | tempo-insolvent tutor release(s): p_graver@t16 |
| `marrick-visible-r4` | disengagement t21 | `visible` | `early_pull_death` | 1 | tempo-insolvent tutor release(s): p_graver@t16 |
| `marrick-visible-r5` | disengagement t21 | `visible` | `early_pull_death` | 1 | tempo-insolvent tutor release(s): p_graver@t16 |

