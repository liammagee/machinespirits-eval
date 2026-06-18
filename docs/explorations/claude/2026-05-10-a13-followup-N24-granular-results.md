# A13 follow-up — N=24 replication, bilateral_tom + named_patterns probes, granular-metric extension

**Date:** 2026-05-07
**Pre-registration:** none — this work is entirely exploratory and post-hoc relative to the locked Gate B pre-registration (`a13-pre-registration.md`).
**Companion docs:** `a13-pre-registration.md` (locked design), `a13-gate-b-results.md` (Gate B confirmatory results, 2026-05-05)
**Run IDs (combined N=24 per cell):**
- cell_111_a13_C1_recognition_only: `eval-2026-05-07-91cdfc9a`, `eval-2026-05-07-bbc7c2fb`
- cell_115_bilateral_tom: `eval-2026-05-07-355cce31`, `eval-2026-05-07-5969bdc8`
- cell_116_recognition_named_patterns: `eval-2026-05-07-704d5d6e`, `eval-2026-05-06-ec1cf5f8`
- cell_117_bilateral_tom_named_patterns: 4 runs (post-test-mishap recovery; rows reduced to N=24)

**Exports:** `exports/4arm-N24-granular-v2.json`, `exports/4arm-N24-cell{111,115,116,117}.json`
**Analyzer:** `scripts/analyze-strategy-shift.js` (extended with shift_window, family_match, confusion_matrix, cf_family_divergence)

---

## TL;DR

The Gate B pre-registration tested four conditions (C1–C4) and produced a split decision (C3 vs C2: pass; C3 vs C1: fail; C4: regression). This follow-up adds three exploratory cells (cell_115 bilateral_tom, cell_116 recognition + named_patterns ego prompt, cell_117 bilateral_tom + named_patterns) replicated to N=24 per cell against a re-run cell_111 baseline, and extends `analyze-strategy-shift.js` with three granular metrics (shift-window, family-match, family-confusion-matrix, family-level counterfactual-divergence).

The strict pre-registered metric tells one story; the exploratory granular metrics tell a more specific one. Read in order:

1. **Strict label-match (pre-registered):** bilateral_tom imposes a clean ~25pp `strategy_shift_correctness` cost vs cell_111 (62.5% → 37.5%). Layering named_patterns on top of bilateral_tom recovers 0pp at the strict label level (cell_117 = 37.5% = cell_115). A previously-claimed "partial additivity" reading from N=8 (cell_115=25%, cell_117=37.5%) is **falsified** at N=24.
2. **Family-match (exploratory):** bilateral_tom's failure mode is *not* trigger-blindness. The architecture lands the right pedagogical family at trigger+1 in 70.8% of cases (vs 95.8% for cell_111); named_patterns lifts this to 79.2%. So the architecture recognizes the *type* of pedagogical situation about right but mispicks the specific action within the right family.
3. **Counterfactual family-divergence (exploratory):** cf_label divergence is 87–92% on bilateral_tom cells but cf_family divergence is only 75%. The 12–17pp gap is the architectural fingerprint of "type-prior locking": under perturbation, the architecture changes which cousin within a family it picks much more often than it changes which family. The state machine is highly state-sensitive at the cousin level, more state-invariant at the family level.
4. **Family confusion matrix (exploratory):** named_patterns isn't a generic "improve bilateral_tom" prompt — it swaps biases. It rescues `repair_after_misrecognition` (4/6 → 6/6 family-correct) and `affective_shutdown` (already 6/6) but breaks `polite_false_mastery` and `metaphor_boundary_case` (1/3 → 0/3 family-correct on diagnostic). Its mechanism appears to be affective-attention amplification, which helps when affective signals are real and hurts when they're masking something cognitive.

A model-substitution caveat applies. Gate B used `openrouter/nemotron`; this follow-up used `claude-code/sonnet` (Max-plan subscription routing). The cell_111 baseline moved from 37.5% (Gate B) to 62.5% (this follow-up). Cross-comparison is not strictly valid; the N=24 contrasts in this memo are within-model and do not back-port to the Gate B decision rule.

---

## 1. Replication design (N=24 per cell)

Three follow-up cells were registered and run at N=24:

| Cell | Architecture | Built on | Pre-registered? |
|---|---|---|---|
| cell_111 (re-run) | recognition prompt, single-LLM-call adaptive runner | Gate B C1 | Yes (Gate B) — re-run under different model |
| cell_115 | externalized state + bilateral ToM (separate model of learner) | (new) | No |
| cell_116 | recognition + named_patterns ego prompt (no bilateral ToM) | (new) | No |
| cell_117 | bilateral ToM + named_patterns ego prompt | (new) | No |

`named_patterns` is an ego-prompt rewrite that names the 14-mode hybrid taxonomy and 6 named phenomena explicitly in-prompt, asking the ego to identify the operative pattern before responding. `bilateral_tom` extends the adaptive runner with a separate model of the learner's mental state, updated each turn from the learner's message. Both cells use the standard 14-action policy enum (`services/adaptiveTutor/policyActions.js`).

---

## 2. Strict label-match: the pre-registered story

| Cell | n | strategy_shift% | shift_count |
|---|---|---|---|
| cell_111 (recognition_only) | 24 | **62.5%** | 15/24 |
| cell_116 (recognition + named) | 24 | **50.0%** | 12/24 |
| cell_115 (bilateral_tom) | 24 | **37.5%** | 9/24 |
| cell_117 (bilateral_tom + named) | 24 | **37.5%** | 9/24 |

Reading these as a 2×2 with factor A = bilateral_tom (off/on) and factor B = named_patterns (off/on):

- Main effect of bilateral_tom (cell_115 vs cell_111; cell_117 vs cell_116): **−18.7pp average**. Bilateral_tom imposes a substantial cost on strict shift correctness.
- Main effect of named_patterns (cell_116 vs cell_111; cell_117 vs cell_115): **−6.3pp average**. Named_patterns alone slightly hurts strict correctness; combined with bilateral_tom, no further effect.
- Interaction (cell_117 − cell_115) − (cell_116 − cell_111) = (37.5 − 37.5) − (50 − 62.5) = **+12.5pp**. The N=24 binary metric resolves to ~4pp/sample, so this interaction is plausibly meaningful but not conclusive at this sample size. It captures that named_patterns "saves" bilateral_tom from being further degraded — but only because bilateral_tom is already at the floor relative to where named_patterns would push the recognition-only baseline.

**This is the falsification of the N=8 partial-additivity reading.** At N=8, cell_115 = 25% and cell_117 = 37.5%, suggesting +12.5pp recovery from named_patterns. At N=24, both cells land on exactly 9/24 = 37.5%. The earlier reading was within one sample's worth of noise.

---

## 3. Granular metrics: the more specific story

### 3.1 Shift-window (turns trigger+1, +2, +3)

| Cell | shift% (trigger+1) | window% (any of trigger+1..+3) |
|---|---|---|
| cell_111 | 62.5% | 62.5% |
| cell_115 | 37.5% | 37.5% |
| cell_116 | 50.0% | 50.0% |
| cell_117 | 37.5% | 37.5% |

For every cell, `window%` equals `shift%` exactly. Pivot landing diagnostics confirm: 100% of canonical pivots land at trigger+1, 0% at trigger+2 or +3. This rules out "the architecture pivots, just slowly" as a possible explanation for the bilateral_tom shift cost. When the architecture doesn't make the canonical pivot at trigger+1, it doesn't make it at all in the remaining dialogue; it picks a different action and stays with it.

This is itself a clean null result, though one not pre-registered: the architectures don't *delay* canonical pivots, they *substitute* them.

### 3.2 Family-match

The 14-action policy taxonomy clusters into four pedagogical families derived from `config/adaptive-policy-actions.yaml` (`trigger_conditions` and `contraindications` co-cluster):

| Family | Actions |
|---|---|
| substantive_engagement | mirror_and_extend, scope_test, name_the_disagreement, pose_counterexample, invite_objection |
| diagnostic | ask_diagnostic_question, request_elaboration, summarize_and_check |
| scaffolding | give_worked_example, lower_cognitive_load, provide_hint, withhold_answer |
| repair_affective | repair_misrecognition, acknowledge_and_redirect |

`family_match` at trigger+1 is true when the actual policy shares a family with any accepted expected policy. This generalises the existing accepted-set logic (which already accepts {scope_test, name_the_disagreement, pose_counterexample} for `resistance_to_insight` — all in `substantive_engagement`) to all eight scenarios.

| Cell | shift% | family% | family − shift gap |
|---|---|---|---|
| cell_111 | 62.5% | **95.8%** | +33.3pp |
| cell_116 | 50.0% | **87.5%** | +37.5pp |
| cell_115 | 37.5% | **70.8%** | +33.3pp |
| cell_117 | 37.5% | **79.2%** | +41.7pp |

Two readings. First, the gap between family and label correctness is large (33–42pp) for every cell. Most "wrong" picks across all four cells are in the right pedagogical family — the architectures are substantially better at recognizing the *type* of situation than at picking the specific action.

Second, **the cell_115 vs cell_117 strict tie at 37.5% breaks at the family level.** Cell_117 leads cell_115 by 8.3pp on family-match (19/24 vs 17/24 — two extra correct-family picks). So named_patterns *does* something for bilateral_tom, just not at the strict-label resolution. This is the granular finding the binary metric hid.

### 3.3 Family confusion matrix

Diagonal-rate per cell × expected family (correct-family pick rate):

| Expected family → | cell_111 | cell_116 | cell_115 | cell_117 |
|---|---|---|---|---|
| substantive_engagement (n=12) | 11/12 (92%) | **12/12 (100%)** | 11/12 (92%) | 11/12 (92%) |
| diagnostic (n=3) | **3/3 (100%)** | 1/3 (33%) | 1/3 (33%) | **0/3 (0%)** |
| scaffolding (n=3) | **3/3 (100%)** | 2/3 (67%) | 1/3 (33%) | 2/3 (67%) |
| repair_affective (n=6) | **6/6 (100%)** | **6/6 (100%)** | 4/6 (67%) | **6/6 (100%)** |

Three readings.

**cell_111 (recognition_only) has effectively no family-level confusion.** Single off-diagonal pick (one substantive scenario gets a diagnostic answer); otherwise perfect.

**cell_115 (bilateral_tom) has a "default to substantive_engagement" bias.** Off-diagonal: 2 of 3 scaffolding scenarios and 2 of 6 repair scenarios land in `substantive_engagement`. When the bilateral_tom state machine is uncertain about family, it falls back to "engage the substance" — which is the wrong call for affective shutdowns and for "just give me the answer" pulls.

**cell_117 (bilateral_tom + named_patterns) swaps biases rather than recovering bilateral_tom.** Compare 115 vs 117 column-by-column: substantive unchanged (11→11), diagnostic worse (1→0), scaffolding slightly better (1→2), repair_affective dramatically better (4→6). Net family-correct change: +1 (scaffolding) + 2 (repair) − 1 (diagnostic) = +2/24 = +8.3pp, matching the headline family-match gap.

The mechanism behind cell_117's bias-swap: in 2 of 3 diagnostic scenarios where `ask_diagnostic_question` was expected, named_patterns drove the architecture to answer with `acknowledge_and_redirect` (repair_affective). Combined with the perfect repair_affective recovery, this is consistent with named_patterns acting as an **affective-attention amplifier** — boosting the architecture's tendency to read affective signals as load-bearing. This rescues `repair_after_misrecognition` and `affective_shutdown` (where affective signals are real) and breaks `polite_false_mastery` (where the polite "thank you" is a *fake* affective signal masking unaddressed cognitive uncertainty).

This characterisation is hypothesis-generating, not confirmatory. Confirmation would require pre-registering scenarios that distinguish real from fake affective signals and predicting the named_patterns × signal-authenticity interaction explicitly.

### 3.4 Counterfactual family-divergence

Cell_111 and cell_116 do not run counterfactual replay (no externalised state to perturb). For the bilateral_tom cells:

| Cell | cf_label_div% | cf_family_div% | gap (label − family) |
|---|---|---|---|
| cell_115 | 91.7% (22/24) | 75.0% (18/24) | **−16.7pp** |
| cell_117 | 87.5% (14/16) | 75.0% (12/16) | **−12.5pp** |

Under counterfactual perturbation (e.g., flipping the hidden `actual_sophistication` from `advanced` to `novice`), both bilateral_tom cells change their specific action label 87–92% of the time but only change their family 75% of the time. The 12–17pp gap is the architectural fingerprint of **type-prior locking**: the state machine is highly state-sensitive at the cousin level, more state-invariant at the family level.

A reusable derived metric: **type-prior locking score = 1 − (cf_family_div / cf_label_div)**. For bilateral_tom: 1 − 75/91.7 = 0.182. For bilateral_tom + named_patterns: 1 − 75/87.5 = 0.143. Higher values mean the architecture's family choice is more state-invariant than its action choice — i.e., the architecture has stronger type priors that the state cannot override.

---

## 4. Refined characterisation of bilateral_tom's failure mode

Combining the four exploratory metrics:

> **bilateral_tom has type-recognition resolution but not within-type discrimination resolution.** The architecture recognizes the pedagogical family of a situation about as well as simpler architectures do (modulo a default-to-substantive bias when uncertain). What it lacks is the within-family precision to distinguish, e.g., `scope_test` from `name_the_disagreement`, or `ask_diagnostic_question` from `acknowledge_and_redirect`. Under counterfactual perturbation, the architecture is highly responsive at the cousin level but anchored at the family level.

This re-frames the Gate B "split decision" finding. Gate B asked whether bilateral_tom-style architecture beats simpler baselines on strict label correctness; the answer was "modestly yes, vs C2; no vs C1." This follow-up adds: the strict-label cost is concentrated in within-family confusion (the architecture knows it's a substantive-engagement situation but picks a sibling), not in family-blindness. That's a substantively different (and arguably more interesting) failure mode than "the architecture can't see the trigger."

---

## 5. Methodological notes

### 5.1 Pre-registration discipline

The strict label-match findings are the pre-registered confirmatory measure (Gate B locked it; the N=24 follow-up replicates it under the new model). The granular metrics in §3 are exploratory and post-hoc. Specifically:

- shift-window, family-match, and family-confusion-matrix were not in the locked analysis plan
- cf_family_divergence was not in the locked secondary endpoints (`cf_div`/`counterfactual_divergence` was; the family-level analog is novel)
- The model substitution from `nemotron` (Gate B) to `claude-code/sonnet` (this follow-up) is a cross-class change; per Gate B pre-reg §9 it requires either a fresh pre-registration or treating cross-Gate-B comparisons as descriptive only

Any cell_115/117 → bilateral_tom architectural claim built on the granular metrics in this memo must be marked exploratory in the paper. Confirmation requires a follow-up pre-registration that locks the granular metrics in advance, names the model class, and predeclares within-family discrimination scenarios.

### 5.2 Strict binary metrics conflate failure modes

The strict `strategy_shift_correctness` metric is a single bit per (cell, scenario, replication) triple. It conflates three distinct failure modes:
1. Wrong family entirely (e.g., `acknowledge_and_redirect` when `scope_test` was expected)
2. Right family, wrong cousin (e.g., `name_the_disagreement` when `scope_test` was expected)
3. Late but correct (canonical pivot lands at trigger+2 or +3)

The granular metrics in §3 separate these. Mode 3 turned out to be empirically empty (shift-window is 0pp gain across all cells). Modes 1 and 2 are revealed by the family-match metric and confusion matrix. The cell_115 vs cell_117 strict tie at 37.5% would have been a legitimate "no-effect" reading without §3.2 — which is exactly the inference the granular extension was built to enable.

For future state-machine experiments, recommend pre-registering both the strict label match (as conservative primary) and the family-match (as exploratory secondary). Don't promote family-match to primary post-hoc — that would convert this exploratory reading into a confirmation that doesn't bear the weight.

---

## 6. Implications for Phase 2 (P2)

The Gate B memo recommended:
- Drop C4 (validator) — confirmed regression
- Phase 2 baseline should include C1, not just C2/C3
- Pre-register against corrected scenario set
- Lock thresholds against C1 as primary baseline

This follow-up adds three further recommendations:

1. **Within-family discrimination scenarios.** The current 8-scenario set heavily weights substantive_engagement (5/8 expected pivots). Within-family confusion is the bilateral_tom failure mode that strict-label scoring cannot see. Pre-register at least 2 new scenarios where two same-family actions are clearly distinguished pedagogically (e.g., one where `scope_test` is right and `name_the_disagreement` is wrong with overt cues for the distinction).

2. **Pre-register family-match alongside strict label-match.** Treat strict as conservative primary (the existing Gate B endpoint); treat family-match as planned secondary. The cell_115 vs cell_117 family-match gap (8.3pp) is the kind of small effect that a pre-registered family secondary could legitimately confirm.

3. **State-schema ablation.** Bilateral_tom's "type-prior locking" (cf_label vs cf_family gap) suggests the externalised state schema carries family-recognition signal but lacks the within-family resolution needed for cousin-level state-driven selection. A staged ablation (sophistication-only / sophistication+confidence / full state) would identify which schema dimensions carry which signal — and whether richer state can close the within-family gap.

---

## 7. Open items

- [ ] If Phase 2 P2 pre-registration is drafted, include this memo's recommendations §6 (1)–(3) explicitly so the conditional pre-registration is reviewable.
- [ ] Decide whether to add a §A13 section to `paper-full-2.0.md` now (with §3 marked exploratory) or fold the granular finding into Phase 2's confirmatory write-up. The strict-label N=24 replication is on the canonical path either way — the model-substitution caveat applies in both cases.
- [ ] Consider extending `analyze-strategy-shift.js` further: cousin-distance metric (within-family ordering by trigger_conditions overlap), state-update-coherence per turn, action-selection-entropy under fixed state. None are pre-registered; all would inform Phase 2 design.
