# P2 pre-registration — bilateral ToM cell (cell_115)

**Date locked:** 2026-05-05
**Commit at lock time:** *to be filled at commit time, before any real-LLM run*
**Earliest run-start date:** ≥48 hours after the commit that lands this file (visible in `git log` against this file)
**Status:** Draft pending lock. Promote to "locked" by removing this banner and ensuring the cell config + stateSchema extensions referenced in §3 are committed at the same hash recorded above.

This document locks the question, conditions, primary endpoint, thresholds, stop conditions, budget, and analysis plan for the P2 (bilateral ToM) real-LLM run *before* the run executes. Same discipline as `a13-pre-registration.md`: claims after the run are evaluated against what's written here, not against post-hoc rationalisations.

Upstream sources (cite section, do not duplicate):

- Strategy and phasing — `docs/explorations/claude/comprehensive-strategy.md` §"Phase 2 — Architectural primitive prototypes"
- Gate B baseline + design re-frame — `docs/explorations/claude/a13-gate-b-results.md` §"Plain-language reading" and §"Implications for the plan"
- Hegelian primitive specification — `docs/explorations/claude/comprehensive-strategy.md` §"Hegelian primitive — Bilateral mutual-recognition state machine"
- ToM-accuracy methodology — FANToM (`docs/explorations/literature/pdfs/03-theory-of-mind/`) and Language Bottleneck Models pattern (paired text + JSON, full rewrite per turn)

---

## 1. Question

> Does adding a paired natural-language + JSON `hypothesizedLearnerState` alongside a dynamic bilateral learner (maintaining its own `hypothesizedTutorState`) produce measurable adaptive responsiveness over and above (a) recognition prompting alone and (b) the full LangGraph state-policy machine without ToM?

This is a probe, not a confirmation. The hypotheses below are predeclared with directionality; the test is whether the cell-as-built clears the predeclared deltas, not whether some new architecture turns out to "work."

---

## 2. Re-framed baseline assumption (changed by Gate B)

The A13 pre-registration treated the existing ego/superego architecture (C2) as the primary baseline. Gate B revealed two things that change this:

1. **C1 (single recognition prompt) is a stronger competitor than the plan assumed.** It scored 37.5% on strategy_shift_correctness — only 10.3pp behind the full state-policy machinery (C3). The honest contrast for any new architectural primitive is "does it beat a single recognition prompt?" — not "does it beat the existing architecture?"
2. **C3's marginal gain over C1 came specifically from sustained-pressure scenarios** (`answer_seeking`, `repair_after_misrecognition`), where externalised state anchored the tutor against learner pressure. The C2 deliberation loop *softened* under pressure (collapse on those same scenarios). This is the failure mode P2's bilateral ToM is designed to counter.

P2 therefore predeclares C1 as the primary baseline and tracks the C2-style collapse mechanism as a tertiary endpoint, not just C3 as the comparator.

---

## 3. Hypotheses

**H1 — primary.** On the 8 (corrected) adaptive trap scenarios, C5 produces a higher rate of correct strategy shift at trigger turn + 1 than:

- C5 ≥ C1 by **≥15 percentage points** (recognition-prompt-only baseline; calibrated against Gate B C3-vs-C1 gap of +10.3pp — primitive must clear by a meaningful margin to count as additive)
- C5 ≥ C3 by **≥5 percentage points** (full-state-machine baseline without ToM; modest because ToM is one primitive among several queued for P2/P3/P4 — additive, not transformative)

**H2 — secondary.** ToM accuracy is non-illusory:

- C5 `tom_accuracy` ≥ **0.6** mean across scenarios at trigger turns (FANToM threshold; below 0.4 is illusory-ToM territory and halts the run per §6)

**H3 — tertiary.** ToM specifically reduces the C2-collapse failure mode:

- C5 `sustained_pressure_capitulation_rate` ≤ **50% of C3's** rate on `answer_seeking` and `repair_after_misrecognition` scenarios
- C5 `iterated_misrecognition_rate` ≤ **50% of C3's** rate (tutor produces second misread within 2 turns of an explicit learner correction)

**H0 (null).** ToM machinery does not produce additional contingent strategy shift beyond what the externalised JSON state already provides; if H1 and H3 both fail the result is meaningful negative evidence that paired-state representation alone is sufficient and bilateral ToM is over-engineered for this scenario set.

---

## 4. Design

| Code | Profile name | Runner | Architecture | Source |
|---|---|---|---|---|
| C1 | `cell_111_a13_C1_recognition_only` | `standard` | Single-agent tutor, recognition prompt | shipped in commit `343b401` |
| C3 | `cell_110_langgraph_adaptive` | `adaptive` (architecture: `state_policy`) | Externalised JSON learner profile + policy selector + recognition generator | shipped in commit `3e483d0` |
| **C5** | `cell_115_bilateral_tom` | `adaptive` (architecture: `bilateral_tom`) | **C3** + paired natural-language + JSON `hypothesizedLearnerState`, paired `hypothesizedLearnerPerceptionOfTutor`, dynamic bilateral learner with `hypothesizedTutorState` and `hypothesizedTutorPerceptionOfLearner` | **NEW — to be implemented before run** |

C5's specific additions over C3 (load-bearing for the hypotheses):

1. `services/adaptiveTutor/stateSchema.js` — extend `learnerProfileSchema` with paired fields:
   - `summaryText: z.string()` — natural-language bottleneck (LBM pattern), full rewrite per turn
   - `hypothesizedLearnerPerceptionOfTutor: z.object({ summaryText, jsonState })` — second-order belief
   - `tomProbes: z.object({ ... })` — 4 FANToM-style answers persisted per turn for tom_accuracy scoring
2. `services/adaptiveTutor/graph.js` — new `bilateral_tom` architecture branch with `tutorTomTracker` node between `learnerProfileUpdate` and `tutorEgoInitial`
3. `services/learnerTutorInteractionEngine.js` — bilateral dynamic learner reactivated for adaptive runner via `learner_architecture: ego_superego_bilateral_tom`, with new `hypothesizedTutorState` + `hypothesizedTutorPerceptionOfLearner` in learner ego prompt context
4. `scripts/analyze-tom-accuracy.js` — NEW; scores tom_probes per turn against the dynamic learner's actual `ownState`
5. `scripts/analyze-collapse-rates.js` — NEW; computes sustained-pressure capitulation + iterated-misrecognition counts

Scripted opening turns from trap scenarios remain (preserves scenario fidelity); subsequent learner turns are dynamic (the bilateral architecture has nothing to react to without a real interlocutor).

C2 is **deliberately NOT** in the comparison set. The A13 evidence that C2 collapses on adaptive scenarios is recorded in `a13-gate-b-results.md` §"Diagnostic A"; running it again here would be retreading. C4 (validator) is **deprecated** post-Gate-B and excluded.

**Sample size.** `--runs 3` per cell × 3 cells × 8 scenarios = **72 dialogues** total. Counterfactual branches preserved on adaptive cells per A13.

**N=3 is intentionally underpowered for between-cell statistical comparison.** Same discipline as A13: if the directional signal is present but underpowered (effect-direction matches H1, p > 0.05 on a 72-dialogue sample), commit to a follow-up N=8 run with a higher ceiling under a separate pre-registration. Do not pool.

---

## 5. Scenarios

Locked to `config/adaptive-trap-scenarios.yaml` at the commit recorded above (8 scenarios). The lock-time version **must include**:

- Rewritten `false_confusion_v1` with concrete domain anchor (master–slave dialectic) — landed in commit `6716def`
- Array-form `expected_strategy_shift` for `resistance_to_insight_v1` — landed in commit `6716def`

Both are pre-Phase-2 prerequisites the Gate B memo (`a13-gate-b-results.md` §"Implications for the plan") flagged. Without them P2 inherits the same 25% architecture-invariant scenario set that confounded A13.

Scenario IDs and expected shifts (post-cleanup):

1. `false_confusion_v1` — expected `scope_test` (with new domain-anchored trigger)
2. `polite_false_mastery_v1` — expected `ask_diagnostic_question`
3. `resistance_to_insight_v1` — expected `{scope_test, name_the_disagreement, pose_counterexample}` (array form)
4. `answer_seeking_to_productive_struggle_v1` — expected `withhold_answer`
5. `metaphor_boundary_case_v1` — expected `name_the_disagreement`
6. `affective_shutdown_v1` — expected `acknowledge_and_redirect`
7. `repair_after_misrecognition_v1` — expected `repair_misrecognition`
8. `sophistication_upgrade_v1` — expected `mirror_and_extend`

Policy-action labels remain drawn from `services/adaptiveTutor/policyActions.js` (frozen at A13 lock).

---

## 6. Endpoints

### Primary — `strategy_shift_correctness`

Same operational definition as A13 (`scripts/analyze-strategy-shift.js`, post-cleanup commit `6716def` to support array-form expected shifts). Aggregated by `profile_name` and `scenario_type`. No judgment, no LLM, no rubric.

### Secondary — `tom_accuracy`

For each (cell, scenario, replication, turn) where the tutor emits a `hypothesizedLearnerState`, score the four FANToM-style probes:

- **BELIEF[DIST]:** does the tutor's `hypothesizedLearnerState.actualMisconception` match the learner's `ownState.actualMisconception`?
- **BELIEF[CHOICE]:** does the tutor's `hypothesizedLearnerState.agencySignal` match the learner's `ownState.agencySignal`?
- **ANSWERABILITY[LIST]:** does the tutor's `hypothesizedLearnerState` correctly mark turns where the learner has insufficient information to answer?
- **INFOACCESS[LIST]:** does the tutor's `hypothesizedLearnerState` correctly mark which prior turns the learner has actually integrated vs. which were lost?

Per-turn accuracy = mean of 4 probe binaries. Aggregated by cell × scenario at trigger turns.

Scored by `scripts/analyze-tom-accuracy.js` (NEW). Implementation locked at commit hash recorded above.

### Tertiary — collapse-mechanism endpoints

Both scored by `scripts/analyze-collapse-rates.js` (NEW), operationalised against the Gate B C2-collapse dialogues as ground-truth examples:

- **`sustained_pressure_capitulation_rate`** — fraction of (cell, scenario) pairs where the tutor changes policy from a trap-resistant action (`withhold_answer`, `repair_misrecognition`, `acknowledge_and_redirect`) to a softer action (`provide_hint`, `mirror_and_extend`, `request_elaboration`) after the learner repeats the trap signal at least twice.
- **`iterated_misrecognition_rate`** — fraction of (cell, scenario) pairs where the tutor emits a `mirror_and_extend` policy at turn N+1 after the learner explicitly says "no, that's not what I asked" (or equivalent corrective signal) at turn N. Detector signal-list locked at the commit above; tutor-side action detection locked to `mirror_and_extend` only (other actions can be added in a separate pre-reg if false-positives prove a problem).

---

## 7. Stop conditions

These halt the run mid-stream when triggered. They are not post-hoc adjudication options.

1. **Cost ceiling exceeded.** $30 ceiling for the small-N run, justified against Gate B C3's $3.47 for 23 rows × ~2× C5 expected per-row × 3 cells × 1.5 safety = ~$30. Enforced at `services/adaptiveTutor/budgetTracker.js`. Already-instrumented.
2. **Internal leakage > 5% in any cell.** Internal deliberation appearing in learner-facing output. Halt that condition, do not score.
3. **ToM accuracy < 0.4 in C5.** Below the FANToM illusory-ToM threshold; the secondary endpoint is unscoreable and the primitive's mechanism story is invalid. Halt and revisit ToM elicitation prompts.
4. **`expected_strategy_shift` cannot be reliably scored** — e.g., schema-validation cascade like the A13 `resistance_to_insight` JSON-parse failures exceeding 5% of attempts. Halt and re-architect rather than paper-over with judgment calls.
5. **Provider account-level credit balance below estimated run cost.** Pre-flight check against the OpenRouter `/auth/key` endpoint per the BudgetTracker memory entry. Halt before firing if estimated cost > 50% of remaining lifetime credit.

---

## 8. Budget and provenance

- **Hard ceiling:** $30 total across all three cells.
- **Provider:** OpenRouter (Anthropic Sonnet 4.6) for tutor; same for dynamic bilateral learner.
- **Provenance:** run description must reference this file path. Pre-flight credit check must succeed and be recorded in the run metadata.
- **Logs and traces:** persist to default `data/evaluations.db` + `logs/tutor-dialogues/`; no hermetic tmp dir for the real run.

---

## 9. Analysis plan

Order is fixed and predeclared. Steps 2–5 are run regardless of step 1 outcome (we want the full diagnostic picture even on a null result).

1. **Strict primary endpoint check.** Run `scripts/analyze-strategy-shift.js --run-id <runId>` for each cell. Compute C5−C1 and C5−C3 deltas. Compare to H1 thresholds.
2. **ToM accuracy.** Run `scripts/analyze-tom-accuracy.js --run-id <runId>`. Per-cell mean ± 95% bootstrap CI.
3. **Collapse mechanism.** Run `scripts/analyze-collapse-rates.js --run-id <runId>`. Per-cell rates on the two C2-collapse scenarios.
4. **Per-scenario inspection.** Read every C5 dialogue against the human-inspection rubric. Confirm zero internal leakage; flag any other concerning patterns.
5. **Pre-registration verdict.** Binary pass/fail against H1, H2, H3. Verdicts compiled in `docs/explorations/claude/p2-results.md` (analogous to the Gate B memo) before any paper-claim drafting.

---

## 10. What a positive vs. negative result means

- **All hypotheses pass:** bilateral ToM as a primitive is supported. P3 (charisma trigger) proceeds with C5 as its substrate, since charisma needs externalised second-order beliefs to detect stagnation.
- **H1 passes, H3 fails:** ToM helps strategy shift but doesn't specifically counter the collapse mechanism. ToM is real but the architectural narrative has to shift to "more state, not specifically theory of mind." Probe further before P3.
- **H1 fails, H3 passes:** ToM doesn't beat the strict baseline but does counter the collapse mechanism. Mixed signal — consider running collapse-only scenarios as a focused follow-up rather than treating P2 as a general win.
- **Both fail, H2 (ToM accuracy) ≥ 0.6:** the model can do ToM, but ToM doesn't help. This is the "Tree-of-Thoughts critique" version of the result (per `gpt-pro/01.md` synthesis §5 #2): explicit ToM machinery is conceptually pretty but mechanically inert. Strong negative evidence; pivot to P3 or P4 directly.
- **All fail, H2 < 0.4 (illusory-ToM regime):** the substrate is too weak for any ToM-dependent primitive. Phase 2 ends; pivot to Phase 4 substrate-change per Gate C of `consolidated-plan.md`.

---

## 11. Deviations log

Any decision made after the run that contradicts §§1–9 must be recorded here, with date, reason, and impact. An empty log is the goal; a non-empty log is the audit trail for the next reviewer.

(empty at lock time)
