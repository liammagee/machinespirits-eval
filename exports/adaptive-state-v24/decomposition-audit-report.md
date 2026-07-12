# Adaptive-state v2.4 Part 1a — decomposition audit of the v2.3 sensor stop

Classification: **`data_starved`**

> Diagnostic decomposition of the v2.3 sensor stop plus a directional active-sensing value-of-information screen. Zero model calls. Nothing in this instrument can rescue or reinterpret a stopped row, name a sensor winner, open policy optimization, authorize S2 or Phase 6B, or ground any efficacy or human-learning claim.

Zero model calls. Diagnostic and directional only: nothing in this report rescues, reinterprets, excludes, or
promotes any row of any stopped run; `winner: null` and `do_not_optimize_policy` remain operative; S2 remains
prohibited. Delta convention throughout: pilot sign convention (delta = no_state loss − candidate loss, in
pooled log-loss nats unless marked Brier); negative = worse than no_state.

## Provenance

- S0 fixed-schedule arm: `adaptive-state-v2-s0-exact-channel-346e472a-v23` (archive sha256 `6a0c0214e2532bf8d58849ade805d782a62ea07696281476f7b9ff1775e278ad`), checksum-verified restore
- Pilot comparator: `adaptive-state-v2-s1-canonical-pilot-bd8f47ec-v23` (archive sha256 `d47cedc5968ab7474d604b6a32c20544f1ec87cf97af509f97109bd816c6d024`), checksum-verified restore; its rows are compared against, never re-scored
- Git commit: `797c25cf6f95b9f9e81642e03010d9886dd910e5` (dirty worktree)
- Reuse check: refits at 1.0x lambda reproduce the pilot's sealed predictions to max |Δp| = 0.00e+0

## A1 — schedule floor (pooled, leave-one-world-out)

Prediction from (world, turn index, action family) alone, with the pilot's fixed head. Pilot comparator rows
are read from the restored pilot archive, not refit.

| Head | Target | Log-loss | Brier |
|---|---|---:|---:|
| uniform | next_dag_event_family | 1.3863 | 0.7500 |
| class_prior | next_dag_event_family | 1.2376 | 0.6729 |
| no_state | next_dag_event_family | 1.4144 | 0.5784 |
| schedule_only | next_dag_event_family | 1.1506 | 0.6013 |
| oracle | next_dag_event_family | 0.5714 | 0.3777 |
| uniform | next_proof_trajectory | 1.0986 | 0.6667 |
| class_prior | next_proof_trajectory | 0.9829 | 0.5927 |
| no_state | next_proof_trajectory | 1.0723 | 0.5349 |
| schedule_only | next_proof_trajectory | 0.8711 | 0.5200 |
| oracle | next_proof_trajectory | 0.4171 | 0.2882 |

| Contrast | Target | Log-loss delta [95% CI] | Brier delta [95% CI] |
|---|---|---:|---:|
| schedule_only vs no_state | next_dag_event_family | 0.2638 [0.0101, 0.5665] | -0.0229 [-0.1375, 0.0722] |
| schedule_only vs class_prior | next_dag_event_family | 0.0870 [-0.1391, 0.2720] | 0.0716 [-0.0674, 0.1794] |
| schedule_only vs no_state | next_proof_trajectory | 0.2012 [0.0189, 0.4387] | 0.0149 [-0.0945, 0.1359] |
| schedule_only vs class_prior | next_proof_trajectory | 0.1118 [-0.0708, 0.2609] | 0.0727 [-0.0541, 0.1669] |

## A2 — regularization sweep (pooled log-loss delta vs the pilot no_state, nats)

### next_dag_event_family

| Rung | 0.25x | 1x | 4x | 16x | 64x |
|---|---:|---:|---:|---:|---:|
| lean_dag | -0.9192 | -0.5212 | -0.1138 | 0.1487 | 0.2673 |
| dag_trajectory | -1.6623 | -0.9491 | -0.3217 | 0.0672 | 0.2674 |
| field_trajectory | -1.8913 | -1.0594 | -0.4370 | -0.0125 | 0.2402 |

### next_proof_trajectory

| Rung | 0.25x | 1x | 4x | 16x | 64x |
|---|---:|---:|---:|---:|---:|
| lean_dag | -1.3775 | -0.5013 | -0.0555 | 0.1224 | 0.1622 |
| dag_trajectory | -1.3399 | -0.6937 | -0.1929 | 0.0631 | 0.1530 |
| field_trajectory | -1.8608 | -1.0266 | -0.3296 | 0.0146 | 0.1359 |

## A3 — world encoding (per-world log-loss delta vs the pilot no_state, nats)

### next_dag_event_family

| Rung @ lambda | hethel | marrick | ravensmark |
|---|---:|---:|---:|
| lean_dag @ 0.25x | -0.0298 | -0.9346 | -1.7931 |
| lean_dag @ 1x | 0.0432 | -0.6806 | -0.9262 |
| lean_dag @ 4x | 0.0689 | -0.4379 | 0.0275 |
| lean_dag @ 16x | 0.0441 | -0.2944 | 0.6964 |
| lean_dag @ 64x | -0.0075 | -0.3105 | 1.1199 |
| dag_trajectory @ 0.25x | -1.4362 | -1.9808 | -1.5700 |
| dag_trajectory @ 1x | -0.8441 | -1.3806 | -0.6227 |
| dag_trajectory @ 4x | -0.3116 | -0.8186 | 0.1650 |
| dag_trajectory @ 16x | -0.0736 | -0.4151 | 0.6903 |
| dag_trajectory @ 64x | -0.0228 | -0.2373 | 1.0624 |
| field_trajectory @ 0.25x | -0.9553 | -2.2000 | -2.5187 |
| field_trajectory @ 1x | -0.5965 | -1.5588 | -1.0231 |
| field_trajectory @ 4x | -0.2766 | -0.9376 | -0.0967 |
| field_trajectory @ 16x | -0.0943 | -0.4644 | 0.5212 |
| field_trajectory @ 64x | -0.0295 | -0.2399 | 0.9901 |

### next_proof_trajectory

| Rung @ lambda | hethel | marrick | ravensmark |
|---|---:|---:|---:|
| lean_dag @ 0.25x | 0.0884 | -1.0056 | -3.2153 |
| lean_dag @ 1x | 0.0998 | -0.6892 | -0.9145 |
| lean_dag @ 4x | 0.0749 | -0.4108 | 0.1693 |
| lean_dag @ 16x | 0.0014 | -0.2299 | 0.5958 |
| lean_dag @ 64x | -0.0940 | -0.1796 | 0.7602 |
| dag_trajectory @ 0.25x | -1.3160 | -1.4798 | -1.2241 |
| dag_trajectory @ 1x | -0.7725 | -0.9959 | -0.3129 |
| dag_trajectory @ 4x | -0.3050 | -0.6049 | 0.3313 |
| dag_trajectory @ 16x | -0.1179 | -0.3361 | 0.6432 |
| dag_trajectory @ 64x | -0.1141 | -0.2036 | 0.7766 |
| field_trajectory @ 0.25x | -0.7857 | -1.9973 | -2.7996 |
| field_trajectory @ 1x | -0.4773 | -1.4019 | -1.2007 |
| field_trajectory @ 4x | -0.2136 | -0.8167 | 0.0414 |
| field_trajectory @ 16x | -0.0939 | -0.4081 | 0.5459 |
| field_trajectory @ 64x | -0.0974 | -0.2293 | 0.7344 |

### Per-world context

| World | no_state log-loss (pilot) | schedule_only delta vs no_state (both targets) | dominant labels |
|---|---:|---|---|
| hethel | 1.0366 / 0.8077 | 0.0841 / 0.0152 | none 26/48; stall 26/48 |
| marrick | 1.1901 / 0.8056 | -0.1071 / -0.0097 | adopt 18/48; stall 22/48 |
| ravensmark | 2.0165 / 1.6036 | 0.8144 / 0.5983 | none 34/48; stall 32/48 |

## A4 — per-kernel split (pooled-within-generator log-loss delta vs the pilot no_state, nats)

### next_dag_event_family

| Rung @ lambda | dag_dropout | durable_state |
|---|---:|---:|
| lean_dag @ 0.25x | -0.5947 | -1.2436 |
| lean_dag @ 1x | -0.2398 | -0.8026 |
| lean_dag @ 4x | 0.1228 | -0.3505 |
| lean_dag @ 16x | 0.2911 | 0.0064 |
| lean_dag @ 64x | 0.3024 | 0.2322 |
| dag_trajectory @ 0.25x | -1.3667 | -1.9580 |
| dag_trajectory @ 1x | -0.7044 | -1.1938 |
| dag_trajectory @ 4x | -0.1290 | -0.5145 |
| dag_trajectory @ 16x | 0.1755 | -0.0411 |
| dag_trajectory @ 64x | 0.2931 | 0.2417 |
| field_trajectory @ 0.25x | -1.5707 | -2.2119 |
| field_trajectory @ 1x | -0.8366 | -1.2823 |
| field_trajectory @ 4x | -0.2479 | -0.6260 |
| field_trajectory @ 16x | 0.1113 | -0.1363 |
| field_trajectory @ 64x | 0.2821 | 0.1983 |

### next_proof_trajectory

| Rung @ lambda | dag_dropout | durable_state |
|---|---:|---:|
| lean_dag @ 0.25x | -1.3461 | -1.4089 |
| lean_dag @ 1x | -0.3953 | -0.6073 |
| lean_dag @ 4x | 0.0896 | -0.2007 |
| lean_dag @ 16x | 0.2453 | -0.0004 |
| lean_dag @ 64x | 0.2331 | 0.0913 |
| dag_trajectory @ 0.25x | -1.2723 | -1.4076 |
| dag_trajectory @ 1x | -0.6160 | -0.7715 |
| dag_trajectory @ 4x | -0.1001 | -0.2857 |
| dag_trajectory @ 16x | 0.1476 | -0.0214 |
| dag_trajectory @ 64x | 0.2095 | 0.0965 |
| field_trajectory @ 0.25x | -1.8255 | -1.8962 |
| field_trajectory @ 1x | -0.9874 | -1.0659 |
| field_trajectory @ 4x | -0.2733 | -0.3860 |
| field_trajectory @ 16x | 0.0852 | -0.0559 |
| field_trajectory @ 64x | 0.1876 | 0.0842 |

## Classification

- Rule margins (pooled log-loss nats): negligible |delta| < 0.02; world driver delta <= -0.1; useful delta >= 0.05
- Precedence: data_starved > world_confounded > representation_carries_nothing; every ambiguity defaults to `representation_carries_nothing`
- Matched clause: 1
- Label: **`data_starved`**

## Why

The schedule floor explains the entire no_state reference: predicting from (world, turn index, action family) alone with the same frozen head beats the pilot's no_state rows by 0.2638/0.2012 pooled log-loss nats on next_dag_event_family / next_proof_trajectory (Brier -0.0229/0.0149), and the pilot's no_state itself carries 0.1768/0.0895 nats more log-loss than the training-fold class prior under leave-one-world-out — so the baseline every rung was measured against was an overfit schedule proxy, not a floor of learner-state knowledge. Regularization alone eliminates the pilot's negative — clause 1 of the frozen rule: field_trajectory at 16x lambda lands inside the 0.02-nat negligible band on both targets (-0.0125/0.0146), and the rung deltas swing from between -1.0594 and -0.5013 nats at the pilot's 1x penalty to as high as +0.2674 (dag_trajectory at 64x on next_dag_event_family). What regularization does not recover is state signal: the no_state head refit at the same lambdas gains just as much (0.2818/0.1999 nats at its best grid point), and no rung ever beats the matched-lambda no_state anywhere on the grid (largest matched-lambda margin -0.0144 nats, dag_trajectory at 64x on next_dag_event_family) — the pilot-lambda deficits were the fixed head data-starving its wider one-hot feature sets on 96-row training folds, and shrinkage converges every head toward the same schedule-plus-prior solution rather than exposing latent-state content. The world decomposition names the driver behind both stories: the pilot's no_state collapses on held-out ravensmark (log-loss 2.0165/1.6036 there vs 1.0366/0.8077 on hethel and 1.1901/0.8056 on marrick), because its task features encode world identity numerically (ravensmark's item_difficulty 1.000 lies far outside the training worlds' 0.333-0.400 range) and its labels are the most skewed (none 34/48, stall 32/48); the schedule floor's pooled win is mostly that ravensmark repair (0.8144/0.5983 nats there). Hethel's pilot-only lean_dag gain (0.0432/0.0998) is the mirror image: hethel is the fold whose no_state baseline held up best, so a small lean-DAG edge was only visible there — per-world deltas against the fixed 1x reference mostly measure the reference's fold pathology, not state content. The per-kernel split shows the same signed failure under both generators at the pilot lambda (every rung negative on durable_state and dag_dropout alike), so no single kernel manufactured the v2.3 stop. Under the frozen precedence the label is data_starved; its only downstream authority is as the precondition for the VOI study's inconclusive_data_starved verdict and for reopening design discussion (not runs) on tutor-stub-transition-reward-model. It does not rescue the v2.3 stop: at every tested capacity the rungs still show no predictive signal beyond the fixed schedule and the world-skewed priors.

Report content SHA-256: `17dddab391ef32573b8c6ee8a743796eb34051937c82a1a3ecd42436fd3849b6`
