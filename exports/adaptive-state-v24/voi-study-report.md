# Adaptive-state v2.4 Part 1b — active-sensing value-of-information study

Verdict: **`close_sensor_program_on_substrate`** (matched clause: `none_matched_conservative_default`)

> Diagnostic decomposition of the v2.3 sensor stop plus a directional active-sensing value-of-information screen. Zero model calls. Nothing in this instrument can rescue or reinterpret a stopped row, name a sensor winner, open policy optimization, authorize S2 or Phase 6B, or ground any efficacy or human-learning claim.

Zero model calls. Directional only: nothing in this report rescues, reinterprets, excludes, or promotes any
row of any stopped run; `winner: null` and `do_not_optimize_policy` remain operative; S2 remains prohibited.
A `graduate` verdict would change what may be designed, never what may be run.

## Provenance

- Fixed-schedule arm: `adaptive-state-v2-s0-exact-channel-346e472a-v23` (archive sha256 `6a0c0214e2532bf8d58849ade805d782a62ea07696281476f7b9ff1775e278ad`), checksum-verified restore
- Pilot comparator: `adaptive-state-v2-s1-canonical-pilot-bd8f47ec-v23` (archive sha256 `d47cedc5968ab7474d604b6a32c20544f1ec87cf97af509f97109bd816c6d024`), checksum-verified restore; read only, never re-scored
- Part 1a report: `exports/adaptive-state-v24/decomposition-audit-report.json` (content sha256 `17dddab391ef32573b8c6ee8a743796eb34051937c82a1a3ecd42436fd3849b6`), classification `data_starved` — the frozen sequencing rule (1a before any 1b inspection) is satisfied
- Info-optimal arm: `adaptive-state-v24-voi-schedule` sealed at `exports/adaptive-state-v24/adaptive-state-v24-voi-schedule` (dataset sha256 `1258c761c4ee6c18b5e8ec1eec7af40d4f6faa8bcce89a6168236abe4b77ff8b`, seal sha256 `6135bf3f6c6b34295a7d87b5b6c85c9bd3ba9754f6b510726f8ce2bfe617b39f`)
- Git commit: `797c25cf6f95b9f9e81642e03010d9886dd910e5` (dirty worktree)
- Model calls: 0

## Verdict clauses (frozen rule, applied as written)

- graduate_active_sensing_to_paid: not matched — VOI arm passes margins: true; fixed arm passes margins: true; scheduling flips capacity verdict: false; B1 action-information floor (>= 0.1 bits in >= 2 worlds per kernel): true
- close_sensor_program_on_substrate: not matched — VOI-arm entropy reduction at horizon 5.3984 bits vs floor 0.1 (clause does not fire); B3-fails-on-both-arms-while-oracle-passes: false
- inconclusive_data_starved: not matched — 1a label `data_starved`; all B3 contrast CIs span both cut lines: false
- note: No frozen clause matched literally (the measured configuration is one the frozen rule does not name). The verdict defaults conservatively against further sensor spend, mirroring the Part 1a ambiguity default. The default grants no graduate authority and asserts no channel-concealment claim; read the clause numbers, not the token gloss, for the boundary finding.

## B1 — per-action information gain along the sealed S0 trajectories (bits)

Expected one-step posterior-entropy reduction over latent state, exact filter, per kernel-supported action,
summarized over the scored transitions of each world x kernel (12 unique latent trajectories, 72 transitions;
realizer pairs share latent trajectories and are deduplicated).

| World | Kernel | Action | Max gain | Median gain | Transitions >= floor |
|---|---|---|---:|---:|---:|
| hethel | dag_dropout | diagnose_with_discriminating_question | 1.4413 | 0.9976 | 12/12 |
| hethel | dag_dropout | minimal_hint | 1.5601 | 0.9916 | 12/12 |
| hethel | dag_dropout | request_evidence | 1.5253 | 0.9527 | 12/12 |
| hethel | durable_state | diagnose_with_discriminating_question | 0.9586 | 0.8888 | 9/12 |
| hethel | durable_state | minimal_hint | 0.9595 | 0.9398 | 12/12 |
| hethel | durable_state | request_evidence | 0.9927 | 0.9302 | 9/12 |
| marrick | dag_dropout | diagnose_with_discriminating_question | 1.3358 | 1.3137 | 12/12 |
| marrick | dag_dropout | minimal_hint | 1.5198 | 0.9288 | 12/12 |
| marrick | dag_dropout | request_evidence | 1.5646 | 1.4356 | 12/12 |
| marrick | durable_state | diagnose_with_discriminating_question | 0.9507 | 0.8603 | 12/12 |
| marrick | durable_state | minimal_hint | 0.9982 | 0.9345 | 12/12 |
| marrick | durable_state | request_evidence | 0.9834 | 0.9080 | 12/12 |
| ravensmark | dag_dropout | diagnose_with_discriminating_question | 0.9940 | 0.0000 | 4/12 |
| ravensmark | dag_dropout | minimal_hint | 0.9711 | 0.9609 | 12/12 |
| ravensmark | dag_dropout | request_evidence | 0.9772 | 0.3183 | 6/12 |
| ravensmark | durable_state | diagnose_with_discriminating_question | 0.9191 | 0.0000 | 4/12 |
| ravensmark | durable_state | minimal_hint | 0.9879 | 0.9686 | 10/12 |
| ravensmark | durable_state | request_evidence | 0.9789 | 0.9430 | 8/12 |

## B2 — info-optimal schedule arm

- Label: `adaptive-state-v24-voi-schedule`; 24 dialogues, 144 scored transitions, 168 deterministic realizer calls, 0 model calls
- Greedy action basis counts: greedy=144
- Fallback-to-fixed-schedule events (adapter could not legally produce the greedy pick): 0
- Deterministic replay: pass

| World | Kernel | Realized greedy schedules (per repetition) |
|---|---|---|
| hethel | dag_dropout | r1: minimal_hint > minimal_hint > request_evidence > request_evidence > request_evidence > request_evidence<br>r2: diagnose_with_discriminating_question > diagnose_with_discriminating_question > diagnose_with_discriminating_question > diagnose_with_discriminating_question > diagnose_with_discriminating_question > diagnose_with_discriminating_question |
| hethel | durable_state | r1: minimal_hint > request_evidence > request_evidence > minimal_hint > minimal_hint > minimal_hint<br>r2: minimal_hint > request_evidence > request_evidence > minimal_hint > minimal_hint > minimal_hint |
| marrick | dag_dropout | r1: request_evidence > request_evidence > minimal_hint > minimal_hint > request_evidence > request_evidence<br>r2: request_evidence > request_evidence > request_evidence > request_evidence > request_evidence > request_evidence |
| marrick | durable_state | r1: diagnose_with_discriminating_question > minimal_hint > minimal_hint > minimal_hint > minimal_hint > minimal_hint<br>r2: diagnose_with_discriminating_question > diagnose_with_discriminating_question > diagnose_with_discriminating_question > diagnose_with_discriminating_question > diagnose_with_discriminating_question > diagnose_with_discriminating_question |
| ravensmark | dag_dropout | r1: minimal_hint > minimal_hint > request_evidence > request_evidence > request_evidence > request_evidence<br>r2: minimal_hint > minimal_hint > minimal_hint > minimal_hint > request_evidence > request_evidence |
| ravensmark | durable_state | r1: request_evidence > minimal_hint > minimal_hint > minimal_hint > minimal_hint > minimal_hint<br>r2: minimal_hint > minimal_hint > request_evidence > request_evidence > request_evidence > request_evidence |

## B3 — channel-capacity read per schedule (filter posterior as predictor)

### Fixed-schedule arm (sealed S0)

| Predictor | Target | Log-loss | Brier | ECE |
|---|---|---:|---:|---:|
| uniform | next_dag_event_family | 1.3863 | 0.7500 | 0.0556 |
| class_prior | next_dag_event_family | 1.2376 | 0.6729 | 0.2228 |
| schedule_only | next_dag_event_family | 1.1506 | 0.6013 | 0.1431 |
| no_state | next_dag_event_family | 1.4144 | 0.5784 | 0.2228 |
| filter_posterior | next_dag_event_family | 0.5714 | 0.3777 | 0.0851 |
| oracle | next_dag_event_family | 0.5714 | 0.3777 | 0.0851 |
| uniform | next_proof_trajectory | 1.0986 | 0.6667 | 0.0278 |
| class_prior | next_proof_trajectory | 0.9829 | 0.5927 | 0.1077 |
| schedule_only | next_proof_trajectory | 0.8711 | 0.5200 | 0.1200 |
| no_state | next_proof_trajectory | 1.0723 | 0.5349 | 0.0890 |
| filter_posterior | next_proof_trajectory | 0.4171 | 0.2882 | 0.0479 |
| oracle | next_proof_trajectory | 0.4171 | 0.2882 | 0.0479 |

| Contrast | Target | Log-loss delta [95% CI] | Brier delta [95% CI] |
|---|---|---:|---:|
| filter vs no_state (verdict-binding) | next_dag_event_family | 0.8430 [0.4993, 1.2087] | 0.2007 [0.1096, 0.2986] |
| filter vs class_prior (descriptive) | next_dag_event_family | 0.6663 [0.4940, 0.8767] | 0.2952 [0.1934, 0.4037] |
| filter vs schedule_only (descriptive) | next_dag_event_family | 0.5792 [0.3548, 0.8115] | 0.2236 [0.1029, 0.3384] |
| filter vs no_state (verdict-binding) | next_proof_trajectory | 0.6552 [0.4001, 0.9402] | 0.2467 [0.1470, 0.3804] |
| filter vs class_prior (descriptive) | next_proof_trajectory | 0.5658 [0.4523, 0.6781] | 0.3046 [0.2151, 0.3923] |
| filter vs schedule_only (descriptive) | next_proof_trajectory | 0.4540 [0.3185, 0.6106] | 0.2318 [0.1508, 0.3283] |

- Filter posterior vs kernel oracle agreement: max |dp| = 0.00e+0 (the exact filter tracks the true latent state on this arm)
- Oracle instrument (beats no_state, class prior, uniform on both metrics): pass

### Info-optimal arm (VOI)

| Predictor | Target | Log-loss | Brier | ECE |
|---|---|---:|---:|---:|
| uniform | next_dag_event_family | 1.3863 | 0.7500 | 0.0139 |
| class_prior | next_dag_event_family | 1.2889 | 0.6899 | 0.0094 |
| schedule_only | next_dag_event_family | 1.2343 | 0.6601 | 0.1084 |
| no_state | next_dag_event_family | 1.5544 | 0.7408 | 0.2275 |
| filter_posterior | next_dag_event_family | 0.7466 | 0.5071 | 0.1115 |
| oracle | next_dag_event_family | 0.7466 | 0.5071 | 0.1115 |
| uniform | next_proof_trajectory | 1.0986 | 0.6667 | 0.0972 |
| class_prior | next_proof_trajectory | 0.7775 | 0.4615 | 0.1275 |
| schedule_only | next_proof_trajectory | 0.7732 | 0.4423 | 0.1675 |
| no_state | next_proof_trajectory | 1.1344 | 0.6056 | 0.2206 |
| filter_posterior | next_proof_trajectory | 0.4084 | 0.2796 | 0.0859 |
| oracle | next_proof_trajectory | 0.4084 | 0.2796 | 0.0859 |

| Contrast | Target | Log-loss delta [95% CI] | Brier delta [95% CI] |
|---|---|---:|---:|
| filter vs no_state (verdict-binding) | next_dag_event_family | 0.8078 [0.4220, 1.2561] | 0.2337 [0.1264, 0.3551] |
| filter vs class_prior (descriptive) | next_dag_event_family | 0.5423 [0.4233, 0.6479] | 0.1828 [0.1110, 0.2439] |
| filter vs schedule_only (descriptive) | next_dag_event_family | 0.4877 [0.3400, 0.6409] | 0.1530 [0.0982, 0.2071] |
| filter vs no_state (verdict-binding) | next_proof_trajectory | 0.7260 [0.3692, 1.1372] | 0.3260 [0.1758, 0.5118] |
| filter vs class_prior (descriptive) | next_proof_trajectory | 0.3691 [0.2089, 0.5044] | 0.1819 [0.0638, 0.2844] |
| filter vs schedule_only (descriptive) | next_proof_trajectory | 0.3648 [0.2608, 0.4616] | 0.1627 [0.1009, 0.2226] |

- Filter posterior vs kernel oracle agreement: max |dp| = 0.00e+0 (the exact filter tracks the true latent state on this arm)
- Oracle instrument (beats no_state, class prior, uniform on both metrics): pass

### Arm contrast (descriptive, unpaired: VOI minus fixed, filter-vs-no_state point deltas)

| Target | Log-loss delta difference | Brier delta difference |
|---|---:|---:|
| next_dag_event_family | -0.0352 | 0.0330 |
| next_proof_trajectory | 0.0708 | 0.0793 |

## B4 — lean_dag estimator refit on the VOI arm (1x penalty, leave-one-world-out)

| Arm | Target | lean_dag vs no_state log-loss delta [95% CI] | Brier delta [95% CI] |
|---|---|---:|---:|
| fixed (sealed pilot) | next_dag_event_family | -0.5212 [-0.8944, -0.1518] | -0.0485 [-0.1499, 0.0348] |
| voi (refit) | next_dag_event_family | -0.2963 [-0.6795, 0.0055] | 0.0273 [-0.0272, 0.0866] |
| fixed (sealed pilot) | next_proof_trajectory | -0.5013 [-0.7698, -0.2279] | -0.0674 [-0.1560, 0.0235] |
| voi (refit) | next_proof_trajectory | -0.6151 [-1.0729, -0.2481] | -0.1110 [-0.1721, -0.0505] |

Scheduling alone rescues the lean estimator (voi lean_dag beats voi no_state by >= 0.05 nats and >= 0.02 Brier on both targets): **false**

## B5 — info/pedagogy trade-off (descriptive proof-progress trajectories)

| Arm | World | Kernel | Start distance | Final distance (mean) | Final harmful debt (mean) | Advance/regress/stall counts |
|---|---|---|---:|---:|---:|---|
| fixed | hethel | dag_dropout | 2.00 | 1.50 | 0.00 | 8/6/10 |
| fixed | hethel | durable_state | 2.00 | 0.50 | 0.50 | 6/2/16 |
| fixed | marrick | dag_dropout | 2.00 | 1.50 | 0.00 | 10/8/6 |
| fixed | marrick | durable_state | 2.00 | 0.00 | 0.00 | 8/0/16 |
| fixed | ravensmark | dag_dropout | 2.00 | 0.50 | 0.00 | 6/0/18 |
| fixed | ravensmark | durable_state | 2.00 | 0.50 | 1.00 | 6/4/14 |
| voi | hethel | dag_dropout | 2.00 | 1.50 | 0.00 | 4/2/18 |
| voi | hethel | durable_state | 2.00 | 0.00 | 0.00 | 8/0/16 |
| voi | marrick | dag_dropout | 2.00 | 1.50 | 0.00 | 4/2/18 |
| voi | marrick | durable_state | 2.00 | 1.50 | 0.00 | 2/0/22 |
| voi | ravensmark | dag_dropout | 2.00 | 0.50 | 0.00 | 10/4/10 |
| voi | ravensmark | durable_state | 2.00 | 0.50 | 0.00 | 6/0/18 |

## Latent-state entropy at horizon (bits)

| Arm | Mean prior-only at horizon | Mean posterior at horizon | Mean reduction | Min reduction | Max reduction |
|---|---:|---:|---:|---:|---:|
| fixed | 4.7753 | 0.0000 | 4.7753 | 2.6902 | 6.6305 |
| voi | 5.3984 | 0.0000 | 5.3984 | 3.6606 | 6.6863 |

## Reading

The exact dynamics-aware filter reproduces the kernel oracle on both arms (fixed-point check passed at every scored transition), and as a predictor its edge over each arm's own no_state baseline is 0.8430/0.6552 pooled log-loss nats on the fixed schedule and 0.8078/0.7260 on the info-optimal schedule (targets next_dag_event_family / next_proof_trajectory). The public channel is not the bottleneck under either schedule: with kernel dynamics and the per-dialogue seed, the terminal posterior over latent state sits at 0.0000 bits on the VOI arm against a predict-only prior of 5.3984 bits at horizon (5.3984 bits of reduction; fixed arm 4.7753 bits). Action choice does control how much uncertainty each turn generates (B1 max per-action gains reach 1.5646 bits, median 0.9443), and greedy info-optimal scheduling does not change the capacity verdict: both arms clear the frozen margins, so the graduate clause's flip condition fails. Scheduling alone does not rescue the lean estimator: refit at the pilot's own penalty on the VOI arm, lean_dag still fails its margins against the arm's no_state (B4), consistent with Part 1a's `data_starved` label — the v2.3 stop was estimator data-starvation, not channel concealment or schedule choice. No frozen clause matched literally (the rule does not name the measured configuration); the verdict defaults conservatively against further sensor spend to close_sensor_program_on_substrate. The boundary finding to report is transparency, not concealment: a dynamics-aware reader already extracts the full latent signal under the fixed schedule, so no schedule change adds channel capacity on this substrate — the remaining gap is estimator-side (1a label above).

Report content SHA-256: `52719e9b018514f4c4625d505cf509b361b851c784e6e8b1fb8038c98a857895`
