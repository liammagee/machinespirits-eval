# Phase-2 follow-up pre-registration — three experiments

**Date locked:** 2026-05-07
**Commit at lock time:** `cddb619` (branch `experiment/langgraph-adaptive`)
**Earliest run-start date:** 2026-05-09 (≥48 hours after lock; visible in `git log` against this file)
**Status:** Predeclared. Anything decided after a run that contradicts this document for the corresponding experiment must be flagged in the §"Deviations log" of *this* file before being analysed.

This document locks three experiments simultaneously. They share a substrate (the adaptive runner, sonnet via the claude-code CLI bridge, the policy-action enum) and they share an analytic family (variants on `strategy_shift_correctness`), so locking them as one document avoids the temptation to retro-couple their results post-hoc. A claim of the form "P2 wins on metric X but only because P3 also held" must be a planned secondary analysis, not a discovered one.

The N=24 follow-up to A13 (see `docs/explorations/claude/a13-followup-N24-granular-results.md`) is the immediate upstream. Its main finding — bilateral_tom and recognition-only tie at 37.5% on strict label match but bilateral_tom leads by 8.3pp on family-match — is the falsifiable hypothesis the three experiments below test, in three different ways.

Upstream sources (do not duplicate; cite section):
- A13 pre-reg: `docs/explorations/claude/a13-pre-registration.md`
- A13 Gate B results: `docs/explorations/claude/a13-gate-b-results.md`
- N=24 follow-up: `docs/explorations/claude/a13-followup-N24-granular-results.md`
- Within-family scenarios design: `config/adaptive-trap-scenarios-v2.yaml` (header)
- Ablation design: `docs/explorations/claude/state-schema-ablation-design.md`
- Crossover design: `docs/explorations/claude/bilateral-tom-id-director-crossover-design.md`

---

## P2.1 — Within-family discrimination (v2 scenarios on existing cells)

### Question

Do the architectures that show family-match advantage at v1 (cell_115 bilateral_tom, cell_117 bilateral_tom_named_patterns) actually do within-family discrimination, or does their family-match win collapse when scenarios are constructed so all valid policy actions belong to the same family?

### Hypotheses

**H1.1 — primary.** On the 6 v2 within-family scenarios, bilateral_tom cells (115, 117) outperform recognition-only cells (111, 116) on `strict_shift_correctness` by **≥10 percentage points**.

**H1.2 — secondary.** `family_match_rate` should be uniformly high across all four cells on v2 (since by construction every valid cousin is same-family). Predicted: ≥80% for all cells. If any cell drops below 70% on family-match, that cell's v1 family-match advantage was scenario-specific, not architectural.

**H1.3 — null / falsifying.** If bilateral_tom and recognition-only differ by <5pp on `strict_shift_correctness` on v2, the family-match advantage at v1 was a confound (likely scenario-distribution-driven) and the architectures do not in fact resolve within-family distinctions. Result: bilateral_tom's positive findings at v1 are downgraded from "discrimination" to "type-recognition only" — the project's claim space narrows.

### Conditions

| Code | Profile name | Architecture | Source for scenarios |
|---|---|---|---|
| P2.1-A | `cell_111_a13_C1_recognition_only` | recognition_only | `config/adaptive-trap-scenarios-v2.yaml` |
| P2.1-B | `cell_115_bilateral_tom` | bilateral_tom | `config/adaptive-trap-scenarios-v2.yaml` |
| P2.1-C | `cell_116_recognition_named_patterns` | recognition_named_patterns | `config/adaptive-trap-scenarios-v2.yaml` |
| P2.1-D | `cell_117_bilateral_tom_named_patterns` | bilateral_tom_named_patterns | `config/adaptive-trap-scenarios-v2.yaml` |

The four cells are unmodified — only the scenario source differs. This is achieved either via a runtime override or by registering paired cell variants (`cell_111_v2`, etc.). Implementation choice is non-substantive; it does not affect the lock.

### Sample size

24 runs/cell × 6 scenarios = **144 dialogues per cell**, **576 dialogues total**. Counterfactual branches add roughly 1.5× call count for cells 115/117 (which have `counterfactual.enabled: true`).

Locked-not-adjustable parameters:
- N = 24 per cell. Not adjustable post-hoc.
- Scenario set = the 6 scenarios in `adaptive-trap-scenarios-v2.yaml` at SHA `cddb619`. If a scenario is added or modified after this lock, the lock is invalidated and a new pre-reg is required.
- Provider/model = claude-code/sonnet for all four cells (matches v1 follow-up; controls for the model-substitution caveat).
- Hyperparameters = temperature 0.6, max_tokens 1500. Matches existing cell config.

### Primary endpoint

`strict_shift_correctness` per cell, computed by `scripts/analyze-strategy-shift.js` against the v2 expected_strategy_shift values.

### Secondary endpoints

- `family_match_rate` per cell.
- Per-scenario breakdown (which v2 scenarios discriminate cells, which don't).
- Confusion matrix (which wrong-cousin error each cell makes when it misses).
- `counterfactual_family_divergence` (cells 115, 117 only).

### Falsifying outcomes

  * **H1.1 falsified** if bilateral_tom cells (115, 117) and recognition-only cells (111, 116) differ by <5pp on `strict_shift_correctness`. Interpretation: the family-match advantage at v1 was a confound; bilateral_tom's externalised state does not in fact resolve within-family distinctions.
  * **H1.2 falsified** for any cell that drops below 70% family-match on v2 despite being above 70% on v1. Interpretation: that cell's family-match was a scenario-distribution artefact.
  * **No interpretation pass for H1.1 partial wins.** A 5–10pp gap is reported as inconclusive, not as a partial win. We do not split between "supportive" and "ambivalent" — a gap below 10pp is reported as "did not meet the predicted threshold."

### Stop conditions

If any of these fire, halt the run and report:
- Total cost on the four-cell run exceeds **$200** (combined across cells, including rubric scoring).
- Any cell has >20% generation failures (suggestions persisted as `[]`).
- Schema drift detected (`config_hash_drift` from `services/evalSignature.js`) — would indicate the v2 YAML has been edited mid-run.

### No-exception clauses

  * The N=24 sample is locked. Pooling P2.1's N=24 with a hypothetical follow-up N is forbidden by this lock — a follow-up would require its own pre-reg.
  * The 6 v2 scenarios are the *complete* scenario set for this experiment. Subsetting to a "best 4" or "most discriminating 3" post-hoc is forbidden.
  * The `strict_shift_correctness` metric is the primary endpoint. Reporting `family_match_rate` as the headline because strict didn't reach threshold is forbidden — family_match is secondary by lock.

---

## P2.2 — State-schema ablation (cells 118-120)

### Question

Which dimensions of `learnerProfile` carry the strategy-shift signal? Specifically: does stripping `agencySignal`, `misconceptions`, or both leave `strict_shift_correctness` intact, or does each dimension contribute independently?

### Hypotheses

**H2.1 — primary, hierarchical.** Predicted ordering on `strict_shift_correctness`:

  cell_110 (full state_policy) ≥ cell_119 (no misconceptions) ≥ cell_120 (no agency) ≥ cell_118 (minimal).

Predicted gaps under H2.1:
- cell_110 − cell_118 ≥ **15pp** (full vs minimal — most aggressive ablation)
- cell_120 − cell_118 ≥ **5pp** (agency stripped vs both stripped)
- cell_119 − cell_118 ≥ **5pp** (misconceptions stripped vs both stripped)

**H2.2 — secondary, family-specific.** cell_120 (no agency) drops on repair_affective family scenarios (especially `affective_shutdown_v1`) by ≥15pp vs cell_110, but holds within ±5pp on substantive_engagement scenarios.

**H2.3 — null / falsifying (H2 from the design memo).** If cell_118 and cell_110 differ by <5pp on `strict_shift_correctness`, the structured profile beyond `confidence + lastEvidence` is cosmetic — the externalised state machine's measured advantage over recognition-only (cell_111) is doing its work through a single scalar plus dialogue text. Important null because it would mean the project's "externalised cognition" claim space narrows substantially.

### Conditions

| Code | Profile name | Architecture | Profile fields the LLM sees |
|---|---|---|---|
| P2.2-base | `cell_110_langgraph_adaptive` | state_policy | full (existing baseline; reuse N=24 data) |
| P2.2-A | `cell_118_state_policy_minimal_profile` | state_policy_minimal_profile | `confidence`, `lastEvidence` |
| P2.2-B | `cell_119_state_policy_no_misconceptions` | state_policy_no_misconceptions | `confidence`, `agencySignal`, `zpdEstimate`, `lastEvidence` |
| P2.2-C | `cell_120_state_policy_no_agency_signal` | state_policy_no_agency_signal | `confidence`, `misconceptions`, `zpdEstimate`, `lastEvidence` |

Baseline (cell_110) data is reused from the N=24 follow-up. The new three cells run fresh against the v1 scenario set (`config/adaptive-trap-scenarios.yaml`, the same set cell_110 ran against).

### Sample size

24 runs × 8 scenarios = **192 dialogues per new cell**, **576 dialogues total** for the three new cells. cell_110 baseline = 192 (already in DB).

Locked-not-adjustable parameters:
- N = 24 per cell, matching the cell_110 baseline.
- Scenario set = the 8 v1 scenarios at SHA `cddb619`. Same set cell_110 was run against.
- Provider/model = claude-code/sonnet (matches cell_110 baseline).
- Profile projection rules = exactly the field lists in the table above. Adding or removing a field changes the experiment and invalidates the lock.

### Primary endpoint

`strict_shift_correctness` per cell. The four-way contrast is the primary analysis.

### Secondary endpoints

- Per-family breakdown (substantive_engagement / diagnostic / scaffolding / repair_affective).
- Per-scenario breakdown.
- `family_match_rate`.
- Cost per turn (does ablation actually reduce cost? Predicted: minimal change since LLM call counts are identical).

### Falsifying outcomes

  * **H2.1 falsified** if cell_110 and cell_118 differ by <5pp on `strict_shift_correctness`. Interpretation: the structured profile is cosmetic; confidence + dialogue text carries everything.
  * **H2.2 falsified** if cell_120 drops on substantive_engagement by ≥10pp. Interpretation: agencySignal does more than affect-tracking, weakening the family-specific story.
  * **Mixed outcomes are reported as such.** If the predicted ordering holds for some cells but not others (e.g., cell_119 ≥ cell_120 reversed), that's reported as "partial support; the agency-vs-misconceptions axis is non-monotonic," not patched into a new ordering.

### Stop conditions

- Combined cost > **$140** across the three new cells (matches design-memo estimate ~$120 plus 15% buffer).
- Any cell >20% generation failures.
- Mock-mode smoke fails on any of the three new architectures (must be resolved before paid run launches).

### No-exception clauses

  * No re-running cell_118-120 with a different field projection if the predicted ordering doesn't hold. The projection rules are the experiment.
  * No retroactively adding cells (e.g., "what about confidence + agency only?"). A new question requires a new pre-reg.

---

## P2.3 — Bilateral_tom × id-director crossover (cells 121-122)

### Question

Does composing two orthogonal externalisations — bilateral_tom (tutor's view of learner) and id-director (tutor's authored self) — produce additive gains over either alone, or do they cancel?

### Hypotheses

**H3.1 — strategy shift.** On the v1 scenario set, the crossover (cell_121 Variant A) outperforms cell_115 (bilateral_tom alone) on `strict_shift_correctness` by **≥10 percentage points**. cell_122 (Variant B) outperforms cell_115 by **≥5 percentage points** (Variant B's revision pass may dilute persona effects).

**H3.2 — charisma.** On the Weber-derived 8-dim charisma rubric (`config/evaluation-rubric-charisma.yaml`), the crossover (cell_121) outperforms cell_106 (id-director, charisma-tuned, the strongest existing id-director cell) by **≥0.3 on the 8-dim mean** (0-5 scale per dimension).

**H3.3 — v2.2 tutor accuracy.** On the v2.2 tutor rubric (8-dim including `content_accuracy`), the crossover (cell_121) outperforms cell_106 — i.e., the bilateral_tom learner-state anchoring keeps id-director's persona authoring from drifting on accuracy.

**H3.4 — null / falsifying.** If cell_121 ≤ cell_115 on `strict_shift_correctness` AND cell_121 ≤ cell_106 on charisma, the architectures cancel rather than compose. Important null because it falsifies the prior expectation that orthogonal externalisations compose additively.

### Conditions

| Code | Profile name | Architecture |
|---|---|---|
| P2.3-bilateral-baseline | `cell_115_bilateral_tom` | bilateral_tom (existing N=24 reused) |
| P2.3-id-baseline | `cell_106_*` | id-director, charisma-tuned (existing data reused) |
| P2.3-A | `cell_121_bilateral_tom_id_director_v1` | bilateral_tom_id_director_v1 (single-pass ego) |
| P2.3-B | `cell_122_bilateral_tom_id_director_v2` | bilateral_tom_id_director_v2 (full ego/superego/revision) |

cell_115 and cell_106 baselines are reused from existing data. The two new cells run fresh against the v1 scenario set.

### Sample size

24 runs × 8 scenarios = **192 dialogues per new cell**, **384 dialogues total** for the two new cells. Baselines: existing.

Locked-not-adjustable parameters:
- N = 24 per cell.
- Scenario set = v1 scenarios at SHA `cddb619`.
- Provider/model = claude-code/sonnet for both new cells.
- Architecture topologies = exactly as specified in `bilateral-tom-id-director-crossover-design.md` §"Two implementation variants". Variant A and Variant B are non-interchangeable; the lock distinguishes them.

### Primary endpoints

Three primary endpoints, each scored independently:
1. `strict_shift_correctness` (v1 trap scenarios)
2. Charisma 8-dim mean (Weber-derived rubric)
3. v2.2 tutor 8-dim mean

The three endpoints are scored in parallel; cell_121 must clear *all three* hypothesised gaps for H3 to be unambiguously supported. Clearing 1-2 of 3 is reported as partial support, with the specific pattern called out (e.g., "wins on charisma and accuracy, ties on strategy shift").

### Falsifying outcomes

  * **H3.1 falsified** if cell_121 ≤ cell_115 on `strict_shift_correctness`. Interpretation depends on H3.2/H3.3 outcomes:
    * H3.1 fails AND H3.2 wins: "id-director persona conflicts with policy-action discipline."
    * H3.1 fails AND H3.2 fails: "architectures cancel" (the H3.4 null).
  * **H3.2 falsified** if cell_121 ≤ cell_106 on charisma. Interpretation: bilateral_tom's LBM bottleneck representation is too analytic for charisma to survive.
  * **H3.4 (combined null)** is the most informative falsifying outcome — orthogonal externalisations are commonly assumed to compose additively, and a clean null falsifies that for this case.

### Stop conditions

- Combined cost > **$280** (design-memo estimate ~$250 plus 12% buffer).
- Either cell >20% generation failures.
- Mock-mode smoke fails for either new architecture.
- The optional `<bilateral_tom_context>` directive section in `prompts/tutor-id-director.md` is not added before launch (per design memo §Open items — required prerequisite).

### No-exception clauses

  * No swapping Variant A for Variant B mid-experiment ("we'll just run the cheaper one"). Both variants are part of the lock; running only one and skipping the other invalidates the cross-variant comparison.
  * No re-running with adjusted prompt directives if results don't match predictions.
  * No interpreting H3 outcomes against the v2 within-family scenarios (P2.1's scenario set). v2 scenarios are not part of P2.3's lock and must not be used to "rescue" a P2.3 null.

---

## Cross-experiment notes

### Sequencing

The three experiments are independent and can be run in any order. Recommended sequencing for budget discipline:
1. **P2.1 first** — uses existing cells, no new code. Cheapest; resolves the within-family question that motivates the rest.
2. **P2.2 second** — requires implementing 3 architectures (small change to graph.js). Resolves the structured-state-machine question.
3. **P2.3 last** — most complex implementation; results are most useful in light of P2.1 + P2.2.

If P2.1 produces a clean null (H1.1 falsified), the case for P2.2 and P2.3 weakens — both rest on the assumption that the externalised state machine is doing within-family work. A P2.1 null is grounds for re-evaluating whether to proceed with P2.2/P2.3.

### Cumulative budget

| Experiment | Estimated cost (LLM + rubric scoring) |
|---|---|
| P2.1 (4 cells × N=24, v2 scenarios) | ~$200 |
| P2.2 (3 new cells × N=24, v1 scenarios) | ~$120 |
| P2.3 (2 new cells × N=24, multi-rubric) | ~$250 |
| **Total** | **~$570** |

Stop conditions on each experiment are independent. Hitting any single experiment's cost ceiling does not authorise pulling from another's budget.

### Provenance

All three experiments use `services/evalSignature.js`'s `config_hash` and `dialogue_content_hash` checks. Schema drift mid-run halts the run.

### Deviations log

Deviations from this lock must be recorded here, with a reason and a date. An empty log means none. The presence of a deviation does not necessarily invalidate the experiment but does require explicit acknowledgement in any reporting.

(empty)

---

## Confirmation that this lock is binding

Before any of these experiments runs, this file must:
1. Be committed (visible in `git log`).
2. Have a SHA that the run-launch command can reference.
3. Be older than 48 hours from run start (compare commit-date to run-launch wall-clock; per A13 pre-reg precedent).

The 48-hour cooling period exists to prevent same-day "lock + run + rationalise" cycles. It is non-negotiable.

When each experiment runs, the launch should record:
- `pre_registration_commit`: this file's SHA at run start.
- `pre_registration_lock_date`: 2026-05-07.
- `pre_registration_section`: `P2.1`, `P2.2`, or `P2.3`.

These should land on the `evaluation_runs.metadata` JSON column.
