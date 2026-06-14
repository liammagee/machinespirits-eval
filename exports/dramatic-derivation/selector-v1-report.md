# Selector V1 Reliability Probe

Generated: 2026-06-14. Source checkout: /Users/lmagee/Dev/machinespirits/machinespirits-eval-derivation.

## Executive Summary

Selector v0 was already falsified as an adaptive selector on the four-world matrix: always-H grounded 19/20 while v0 grounded 18/20, with Withercombe as negative transfer. I left v0 unchanged and implemented a separate --pacing-guard-selective-v1 path.

Selector v1 is intentionally conservative: route hidden for independent top-level joins; route visible only for a detected formal mirror dead-predicate decoy; under decay, fail closed to hidden when no V-positive evidence is present. This repairs the Withercombe misroute but mostly collapses to always-H on the original four-world stress matrix.

Original four worlds with v1: selector 18/20 (90%), always-H 19/20 (95%), always-V 10/20 (50%), no guard 10/20 (50%), oracle 19/20 (95%); regret vs oracle 0.05, regret vs always-H 0.05. On those same four worlds, v1 fixes Withercombe's route but loses one fresh Sealhouse hidden run, so it still does not beat always-H or oracle.

Five-world probe including Hethel: selector 23/25 (92%), always-H 22/25 (88%), always-V 14/25 (56%), no guard 12/25 (48%), oracle 23/25 (92%); regret vs oracle 0, regret vs always-H -0.04. Hethel was intended as the V-positive probe; v1 correctly routes it visible by the mirror-dead-predicate gate and grounds 5/5, while static visible grounds 4/5 and hidden grounds 3/5. That is the first useful V-positive signal, but it is one held-out world and does not yet justify claiming that adaptive selection is solved.

## Selector V1 Policy

- independent_join_hidden: if the authored proof has an independent top-level conjunction, select hidden.
- mirror_dead_predicate_visible: if the question constants are compatible mirror candidates and one branch contains an incompatible decoy predicate while the other lacks it, select visible.
- decay_fail_closed_hidden: when decay is enabled and neither stronger gate fires, select hidden.
- no_decay_default_visible: without decay and without stronger gates, select visible.

The main selector remains --pacing-guard-selective / schema dramatic-derivation.representation-selector.v0. V1 is separate at --pacing-guard-selective-v1 / schema dramatic-derivation.representation-selector.v1.

## Result Tables

| World | Arm | Selected strategy | Complete | Grounded | Verdicts | Turns | Final D | Forced/asserted gap | Overreach | Lucky leap | Selector gate(s) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Bitterwell | baseline/no guard | none | 5 | 5/5 | grounded_anagnorisis x5 | [15,15,17,17,15] | [0,0,0,0,0] | [0,0,0,0,0] | 3 [0,0,3,0,0] | 1 [0,0,1,0,0] | - |
| Bitterwell | hidden | hidden | 5 | 5/5 | grounded_anagnorisis x5 | [16,16,15,17,16] | [0,0,0,0,0] | [0,0,0,0,0] | 3 [0,2,1,0,0] | 1 [0,1,0,0,0] | - |
| Bitterwell | visible | visible | 5 | 4/5 | grounded_anagnorisis x4; aporia x1 | [16,17,16,15,13] | [0,0,0,0,3] | [0,0,0,0,-] | 2 [0,2,0,0,0] | 1 [0,1,0,0,0] | - |
| Bitterwell | selective v0 | hidden | 5 | 5/5 | grounded_anagnorisis x5 | [18,15,16,16,16] | [0,0,0,0,0] | [0,0,0,0,0] | 6 [4,0,0,0,2] | 3 [2,0,0,0,1] | forked_depth |
| Bitterwell | selective v1 | hidden | 5 | 5/5 | grounded_anagnorisis x5 | [15,17,17,17,15] | [0,0,0,0,0] | [0,0,0,0,0] | 7 [0,2,2,3,0] | 3 [0,1,1,1,0] | independent_join_hidden |
| Withercombe | baseline/no guard | none | 5 | 4/5 | grounded_anagnorisis x4; aporia x1 | [22,19,15,20,19] | [0,0,3,0,0] | [0,0,-,0,0] | 5 [3,0,0,1,1] | 3 [2,0,0,1,0] | - |
| Withercombe | hidden | hidden | 5 | 4/5 | grounded_anagnorisis x4; disengagement x1 | [22,24,20,19,20] | [0,1,0,0,0] | [0,-,0,0,0] | 26 [7,16,1,2,0] | 9 [3,6,0,0,0] | - |
| Withercombe | visible | visible | 5 | 2/5 | aporia x3; grounded_anagnorisis x2 | [16,19,19,15,15] | [3,0,0,3,3] | [-,0,0,-,-] | 0 [0,0,0,0,0] | 0 [0,0,0,0,0] | - |
| Withercombe | selective v0 | visible | 5 | 3/5 | grounded_anagnorisis x3; disengagement x1; lucky_leap_only x1 | [24,19,19,7,19] | [1,0,0,5,0] | [-,0,0,-,0] | 17 [15,0,2,0,0] | 4 [4,0,0,0,0] | linear_coupled_or_distractor |
| Withercombe | selective v1 | hidden | 5 | 4/5 | grounded_anagnorisis x4; aporia x1 | [19,19,23,19,15] | [0,0,0,0,3] | [0,0,0,0,-] | 10 [3,0,6,1,0] | 3 [0,0,3,0,0] | decay_fail_closed_hidden |
| Fengate | baseline/no guard | none | 5 | 0/5 | disengagement x5 | [21,21,21,21,21] | [1,1,1,1,1] | [-,-,-,-,-] | 1 [0,0,0,0,1] | 0 [0,0,0,0,0] | - |
| Fengate | hidden | hidden | 5 | 5/5 | grounded_anagnorisis x5 | [22,23,22,26,22] | [0,0,0,0,0] | [0,0,0,0,0] | 4 [0,1,0,3,0] | 3 [0,0,0,3,0] | - |
| Fengate | visible | visible | 5 | 1/5 | disengagement x4; grounded_anagnorisis x1 | [21,21,22,21,21] | [1,1,0,1,1] | [-,-,0,-,-] | 1 [0,0,1,0,0] | 0 [0,0,0,0,0] | - |
| Fengate | selective v0 | hidden | 5 | 5/5 | grounded_anagnorisis x5 | [22,22,22,22,22] | [0,0,0,0,0] | [0,0,0,0,0] | 1 [0,0,0,0,1] | 0 [0,0,0,0,0] | forked_depth |
| Fengate | selective v1 | hidden | 5 | 5/5 | grounded_anagnorisis x5 | [22,22,22,22,22] | [0,0,0,0,0] | [0,0,0,0,0] | 1 [0,0,0,1,0] | 0 [0,0,0,0,0] | independent_join_hidden |
| Sealhouse | baseline/no guard | none | 5 | 1/5 | disengagement x4; grounded_anagnorisis x1 | [21,23,21,21,21] | [1,0,1,1,1] | [-,0,-,-,-] | 0 [0,0,0,0,0] | 0 [0,0,0,0,0] | - |
| Sealhouse | hidden | hidden | 5 | 5/5 | grounded_anagnorisis x5 | [22,22,22,22,22] | [0,0,0,0,0] | [0,0,0,0,0] | 0 [0,0,0,0,0] | 0 [0,0,0,0,0] | - |
| Sealhouse | visible | visible | 5 | 3/5 | grounded_anagnorisis x3; disengagement x2 | [24,22,26,21,22] | [0,0,1,1,0] | [0,0,-,-,0] | 0 [0,0,0,0,0] | 1 [0,0,1,0,0] | - |
| Sealhouse | selective v0 | hidden | 5 | 5/5 | grounded_anagnorisis x5 | [22,22,22,22,22] | [0,0,0,0,0] | [0,0,0,0,0] | 0 [0,0,0,0,0] | 0 [0,0,0,0,0] | forked_depth |
| Sealhouse | selective v1 | hidden | 5 | 4/5 | grounded_anagnorisis x4; disengagement x1 | [22,22,22,11,22] | [0,0,0,4,0] | [0,0,0,-,0] | 0 [0,0,0,0,0] | 0 [0,0,0,0,0] | independent_join_hidden |
| Hethel | baseline/no guard | none | 5 | 2/5 | aporia x2; grounded_anagnorisis x2; disengagement x1 | [20,8,20,11,7] | [0,5,0,4,5] | [0,-,0,-,-] | 25 [6,4,8,5,2] | 0 [0,0,0,0,0] | - |
| Hethel | hidden | hidden | 5 | 3/5 | grounded_anagnorisis x3; disengagement x2 | [7,7,20,20,20] | [5,5,0,0,0] | [-,-,0,0,0] | 12 [2,1,1,2,6] | 0 [0,0,0,0,0] | - |
| Hethel | visible | visible | 5 | 4/5 | grounded_anagnorisis x4; aporia x1 | [20,20,20,20,13] | [0,0,0,0,3] | [0,0,0,0,-] | 22 [1,4,6,6,5] | 0 [0,0,0,0,0] | - |
| Hethel | selective v1 | visible | 5 | 5/5 | grounded_anagnorisis x5 | [20,20,20,20,20] | [0,0,0,0,0] | [0,0,0,0,0] | 21 [5,4,3,5,4] | 0 [0,0,0,0,0] | mirror_dead_predicate_visible |

## Regret Comparison

### V0 On Original Four Worlds

V0: selector 18/20 (90%), always-H 19/20 (95%), always-V 10/20 (50%), no guard 10/20 (50%), oracle 19/20 (95%); regret vs oracle 0.05, regret vs always-H 0.05.

| World | Selector route | Gate(s) | Selector | No guard | Always-H | Always-V | Oracle static | Regret vs oracle | Regret vs H | Negative transfer |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Bitterwell | hidden | forked_depth | 100% | 100% | 100% | 80% | baseline/hidden 100% | 0 | 0 | none |
| Withercombe | visible | linear_coupled_or_distractor | 60% | 80% | 80% | 40% | baseline/hidden 80% | 0.2 | 0.2 | vs H; vs no guard |
| Fengate | hidden | forked_depth | 100% | 0% | 100% | 20% | hidden 100% | 0 | 0 | none |
| Sealhouse | hidden | forked_depth | 100% | 20% | 100% | 60% | hidden 100% | 0 | 0 | none |

### V1 On Original Four Worlds

V1 comparable matrix: selector 18/20 (90%), always-H 19/20 (95%), always-V 10/20 (50%), no guard 10/20 (50%), oracle 19/20 (95%); regret vs oracle 0.05, regret vs always-H 0.05.

| World | Selector route | Gate(s) | Selector | No guard | Always-H | Always-V | Oracle static | Regret vs oracle | Regret vs H | Negative transfer |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Bitterwell | hidden | independent_join_hidden | 100% | 100% | 100% | 80% | baseline/hidden 100% | 0 | 0 | none |
| Withercombe | hidden | decay_fail_closed_hidden | 80% | 80% | 80% | 40% | baseline/hidden 80% | 0 | 0 | none |
| Fengate | hidden | independent_join_hidden | 100% | 0% | 100% | 20% | hidden 100% | 0 | 0 | none |
| Sealhouse | hidden | independent_join_hidden | 80% | 20% | 100% | 60% | hidden 100% | 0.2 | 0.2 | vs H |

### V1 Including Hethel Probe

V1 five-world probe: selector 23/25 (92%), always-H 22/25 (88%), always-V 14/25 (56%), no guard 12/25 (48%), oracle 23/25 (92%); regret vs oracle 0, regret vs always-H -0.04.

| World | Selector route | Gate(s) | Selector | No guard | Always-H | Always-V | Oracle static | Regret vs oracle | Regret vs H | Negative transfer |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Bitterwell | hidden | independent_join_hidden | 100% | 100% | 100% | 80% | baseline/hidden 100% | 0 | 0 | none |
| Withercombe | hidden | decay_fail_closed_hidden | 80% | 80% | 80% | 40% | baseline/hidden 80% | 0 | 0 | none |
| Fengate | hidden | independent_join_hidden | 100% | 0% | 100% | 20% | hidden 100% | 0 | 0 | none |
| Sealhouse | hidden | independent_join_hidden | 80% | 20% | 100% | 60% | hidden 100% | 0.2 | 0.2 | vs H |
| Hethel | visible | mirror_dead_predicate_visible | 100% | 40% | 60% | 80% | visible 80% | -0.2 | -0.4 | none |

## Failure Classification

| Label | World | Arm | Selected | Verdict | Final D | Overreach | Lucky | Class | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| bitterwell-selector-visible-r5 | Bitterwell | visible | visible | aporia | 3 | 0 | 0 | implementation artifact | visible arm stalls with residual D under act/decay pressure; consistent with false-block/uptake boundary rather than pure proof impossibility. |
| withercombe-selector-visible-r1 | Withercombe | visible | visible | aporia | 3 | 0 | 0 | implementation artifact | visible arm stalls with residual D under act/decay pressure; consistent with false-block/uptake boundary rather than pure proof impossibility. |
| withercombe-selector-visible-r4 | Withercombe | visible | visible | aporia | 3 | 0 | 0 | implementation artifact | visible arm stalls with residual D under act/decay pressure; consistent with false-block/uptake boundary rather than pure proof impossibility. |
| withercombe-selector-visible-r5 | Withercombe | visible | visible | aporia | 3 | 0 | 0 | implementation artifact | visible arm stalls with residual D under act/decay pressure; consistent with false-block/uptake boundary rather than pure proof impossibility. |
| withercombe-selector-selective-r1 | Withercombe | selective v0 | visible | lucky_leap_only | 1 | 15 | 4 | route failure | v0 chose visible on a decay-sensitive residue/stuff branch; hidden/static baseline outperformed it. |
| withercombe-selector-selective-r4 | Withercombe | selective v0 | visible | disengagement | 5 | 0 | 0 | route failure | v0 chose visible on a decay-sensitive residue/stuff branch; hidden/static baseline outperformed it. |
| withercombe-selector-v1-selective-r5 | Withercombe | selective v1 | hidden | aporia | 3 | 0 | 0 | guard failure | chosen representation did not drive forced grounded assertion within cap. |
| fengate-selector-visible-r1 | Fengate | visible | visible | disengagement | 1 | 0 | 0 | guard failure or world instability | run disengaged before grounding under the chosen guard; no crash artifact. |
| fengate-selector-visible-r2 | Fengate | visible | visible | disengagement | 1 | 0 | 0 | guard failure or world instability | run disengaged before grounding under the chosen guard; no crash artifact. |
| fengate-selector-visible-r4 | Fengate | visible | visible | disengagement | 1 | 0 | 0 | guard failure or world instability | run disengaged before grounding under the chosen guard; no crash artifact. |
| fengate-selector-visible-r5 | Fengate | visible | visible | disengagement | 1 | 0 | 0 | guard failure or world instability | run disengaged before grounding under the chosen guard; no crash artifact. |
| sealhouse-selector-visible-r3 | Sealhouse | visible | visible | disengagement | 1 | 0 | 1 | implementation artifact | unforced assertion/lucky leap contaminates the outcome; count as failure but not route evidence. |
| sealhouse-selector-visible-r4 | Sealhouse | visible | visible | disengagement | 1 | 0 | 0 | guard failure or world instability | run disengaged before grounding under the chosen guard; no crash artifact. |
| sealhouse-selector-v1-selective-r4 | Sealhouse | selective v1 | hidden | disengagement | 4 | 0 | 0 | guard failure or world instability | run disengaged before grounding under the chosen guard; no crash artifact. |
| hethel-selector-v1-visible-r5 | Hethel | visible | visible | aporia | 3 | 5 | 0 | implementation artifact | visible arm stalls with residual D under act/decay pressure; consistent with false-block/uptake boundary rather than pure proof impossibility. |

Failure counts: implementation artifact=6, route failure=2, guard failure=1, guard failure or world instability=6.

## Interpretation

The v1 result supports a narrower conclusion than adaptive selector works. The H/V channel distinction remains real: visible is weak on Fengate and partially weak on Sealhouse, while hidden protects proof continuity on deep or decayed branches. V1 improves the policy by treating decay as a reason to preserve proof continuity unless there is specific evidence for visible representation, but the four-world stress comparison still leaves it behind always-H because of one Sealhouse hidden-route failure.

Withercombe is the decisive repair: v0 selected visible and produced negative transfer against no guard and hidden; v1 selects hidden via decay_fail_closed_hidden and grounds 4/5, matching hidden/no-guard rates from the v0 matrix. This looks less like a new representation taxonomy and more like correcting an overconfident visible default.

Hethel is the unresolved part in the useful direction. V1 found the intended V-positive contour and routed visible; in first-pass runs, v1 grounded 5/5, static visible grounded 4/5, and hidden grounded 3/5. This is evidence that V-positive contours can exist, but it is not enough by itself to overturn the broader result that hidden is the safest default under decay.

## Recommended Next Selector Policy

Use v1 only as an experimental selector, not as the default claim surface. The defensible next policy is:

1. Keep v0 results frozen as the failed selector baseline.
2. Treat --pacing-guard-selective-v1 as hidden unless V-positive evidence is explicit, with the mirror-dead-predicate gate as the first V-positive candidate.
3. Do not claim adaptive success until V-positive held-out evidence repeats beyond Hethel and v1 avoids fresh negative transfer on the H-positive worlds.
4. Prefer a smaller next probe over more taxonomy: add or modify exactly one V-positive contour where hidden should actively obstruct learning, then compare hidden/visible/v1 first-pass.

## Caveats And Artifacts

- Paid stack: DERIVATION_PROVIDER=codex DERIVATION_LEARNER_PROVIDER=claude DERIVATION_LEARNER_MODEL=sonnet DERIVATION_CLI_TIMEOUT_MS=900000 DERIVATION_LLM=real DERIVATION_TRACE=0.
- Common flags: --real --superego --acts {"minActTurns":3,"maxActTurns":8} --decay {"rate":0.75,"graceTurns":1,"maxConcurrent":2,"startTurn":1,"mutateShare":1.0,"seed":1,"pool":"staged"} --confront --repair-clause --release-authority --plot --throughline --critic-feedback off --critic off.
- New V1 labels and logs: exports/dramatic-derivation/selector-v1-run-logs/.
- Loop artifacts: exports/dramatic-derivation/loop/<label>/diagnosis.json, result.json, transcript.md.
- Launcher note: an initial shell launcher attempt hit a local wait -n compatibility problem after starting a burst. I did not kill surviving work. The completed survivor hethel-selector-v1-hidden-r2 was recorded and skipped by the corrected Node queue as skipped_existing_complete. Other incomplete starts were crash-recovered by rerunning the exact same labels once; the manifest records 39 ok rows with crash_recovery=yes and one skipped_existing_complete survivor.
- Artifact check: all 40 planned V1 labels have diagnosis.json, result.json, and transcript.md; no missing final artifacts.
- Existing v0/static comparison source: exports/dramatic-derivation/selector-reliability-summary.json and underlying loop artifacts.
