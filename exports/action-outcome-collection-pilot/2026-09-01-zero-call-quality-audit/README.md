# Action-outcome collection pilot: zero-call quality audit

Study: `tutor-stub-action-outcome-collection-pilot-v1`. As of: 2026-09-01T22:55:19.200Z. Model calls: 0.

**Verdict: registered_feasibility_gates_failed. The pilot does not license a held-out controller study.**

The collection machinery worked: all 23 available trace files were readable, no source was quarantined, every closed assignment validated, and all 30 condition-matched assignments were visibly delivered. The evidence substrate did not meet the registered feasibility standard.

The target condition produced 30 seeded closed assignments, below the registered minimum of 48, across 13 dialogues rather than 16. Family coverage also failed: `fade_transfer` had no condition-matched case, `explain_model` had 3, `minimal_support` 5, `request_self_explanation` 6, and `diagnose_elicit` 16.

All 30 saved auxiliary outcomes were `inconclusive`. Binary memory admission requires a human consensus label to agree with a saved binary auxiliary label, so even perfect coder agreement cannot produce any usable binary record from this frozen corpus. Human review could still diagnose the instrument descriptively, but it cannot rescue the registered verdict.

This is a feasibility failure. It does not show that the controller would fail, that the action families are equivalent, or that any family improves learning.

## Extraction

| Quantity | Result |
| --- | ---: |
| Planned / complete / technical-failure dialogues | 24 / 22 / 2 |
| Completed / planned turns | 181 / 192 |
| Typed decisions / closed next-turn opportunities | 181 / 158 |
| Seeded closed assignments | 130 |
| Condition-matched seeded closed assignments | 30 |
| Contributing dialogues / worlds | 13 / 4 |
| Visible deliveries | 30 |
| Maximum possible binary records | 0 |

Wilson 95% intervals:

- assignable closed-turn prevalence: 82.3% (75.6%–87.4%)
- registered-condition prevalence among closed turns: 19.0% (13.6%–25.8%)
- visible delivery among matched assignments: 100.0% (88.6%–100.0%)
- auxiliary inconclusive outcomes among matched assignments: 100.0% (88.6%–100.0%)

## Condition-matched family coverage

| Family | Cases | Visible | Dialogues | Worlds | Auxiliary outcomes |
| --- | ---: | ---: | ---: | ---: | --- |
| diagnose_elicit | 16 | 16 | 11 | 4 | {"inconclusive":16} |
| minimal_support | 5 | 5 | 5 | 4 | {"inconclusive":5} |
| explain_model | 3 | 3 | 3 | 2 | {"inconclusive":3} |
| request_self_explanation | 6 | 6 | 5 | 3 | {"inconclusive":6} |
| fade_transfer | 0 | 0 | 0 | 0 | {} |

The 30 matched cases divide into 16 cases where only `diagnose_elicit` was eligible and 14 cases where `explain_model`, `minimal_support`, and `request_self_explanation` were jointly eligible. `fade_transfer` never entered a matched eligible set.

## Registered gates

| Section | Gate | Status | Observed | Required |
| --- | --- | --- | --- | --- |
| execution | minimumCompleteDialogues | PASS | 22 | 20 |
| execution | minimumCompleteDialoguesPerCollectionWorld | PASS | {"world_022_foxtrot_jukebox":4,"world_026_skyway_bakery":6,"world_028_larkspur_fridge":6,"world_029_riverside_clinic":6} | 4 |
| execution | allAttemptAccountingBalances | FAIL | {"balanced":false,"unbalancedJobs":["aocp1_foxtrot_jukebox_r01"]} | true |
| execution | noUnregisteredOrDuplicateJob | PASS | {"unregisteredJobs":[],"duplicateJobs":[],"missingJobs":[]} | true |
| exchangeabilityAndCoverage | minimumConditionMatchedSeededClosedAssignments | FAIL | 30 | 48 |
| exchangeabilityAndCoverage | minimumContributingDialogues | FAIL | 13 | 16 |
| exchangeabilityAndCoverage | minimumContributingCollectionWorlds | PASS | 4 | 4 |
| exchangeabilityAndCoverage | everyMoveFamilyAssignedAndDelivered | FAIL | {"diagnose_elicit":16,"minimal_support":5,"explain_model":3,"request_self_explanation":6,"fade_transfer":0} | true |
| exchangeabilityAndCoverage | minimumDeliveredCasesPerMoveFamily | FAIL | {"diagnose_elicit":16,"minimal_support":5,"explain_model":3,"request_self_explanation":6,"fade_transfer":0} | 6 |
| exchangeabilityAndCoverage | minimumIndependentDialoguesPerMoveFamily | FAIL | {"diagnose_elicit":11,"minimal_support":5,"explain_model":3,"request_self_explanation":5,"fade_transfer":0} | 4 |
| exchangeabilityAndCoverage | minimumCollectionWorldsPerMoveFamily | FAIL | {"diagnose_elicit":4,"minimal_support":4,"explain_model":2,"request_self_explanation":3,"fade_transfer":0} | 3 |
| exchangeabilityAndCoverage | minimumVisibleDeliveryRateAmongConditionMatchedAssignments | PASS | 1 | 0.900 |
| review | bothOriginalCoderSubmissionsComplete | PENDING | pending | true |
| review | minimumJointDeliveryAndOutcomeExactAgreement | PENDING | pending | 0.800 |
| review | maximumMeasurementIndeterminateRate | PENDING | pending | 0.200 |
| review | minimumFinalUsableBinaryRecords | FAIL | {"current":0,"maximumPossibleFromFrozenAuxiliaryOutcomes":0} | 30 |
| review | minimumFinalUsableBinaryRecordsPerMoveFamily | FAIL | {"current":{"diagnose_elicit":0,"minimal_support":0,"explain_model":0,"request_self_explanation":0,"fade_transfer":0},"maximumPossible":{"diagnose_elicit":0,"minimal_support":0,"explain_model":0,"request_self_explanation":0,"fade_transfer":0}} | 4 |

Pending coder gates remain unmeasured. The binary-yield gates already fail because the frozen auxiliary outcomes place an upper bound of zero on admissible binary records.

## Big-picture implication

The project should stop treating this corpus as a candidate controller memory table. The next useful design task is to repair the measurement and eligibility contract prospectively: make every intended family genuinely reachable under the registered condition, and ensure the immediate outcome instrument can produce discriminating binary evidence when the public learner response warrants it. The registered no-top-up rule means the current pilot closes as failed rather than being enlarged or re-thresholded.

This pilot can establish only the operational feasibility and descriptive yield of prospective seeded eligible-family collection, plus descriptive immediate next-turn uptake associations for the maintained simulated bored learner on the four named collection worlds. It cannot establish learning, durable change, transfer, action-family superiority, a causal family effect outside the realized eligible sets, memory-controller benefit, human-learner benefit, or any result on the two reserved evaluation worlds.

Machine-readable provenance, source hashes, rates, family/world summaries, and every gate disposition are in `audit.json`. No transcript text is copied into either audit artifact.
