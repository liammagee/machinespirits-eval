# D5. Rubric v3.0 PCA-Informed Consolidation — Design

**Date**: 2026-04-22
**Status**: Design. Not blocking for Paper 2.0 (cross-version contamination rules forbid retroactive rescoring anyway). Target: Paper 3.0 infrastructure or standalone methods paper.
**Companion**: TODO.md §D5. Upstream critique: 2026-04-22 paper review, item #6.
**Paper refs**: §8.6 "Rubric Evolution"

---

## 1. Why this extension exists

Paper 2.0 §8.6 honestly reports a PCA on 1,584 per-turn observations under the v2.2 tutor rubric:

- **PC1 = 80.7%** of variance. Kaiser criterion yields **exactly one factor** with eigenvalue > 1.
- **Sampling adequacy**: KMO = 0.938 (excellent).
- **Mean inter-dimension $r$ = 0.776** (range 0.589-0.921).
- Replicates across conditions (PC1: 80.2% base, 75.6% recognition) and models (77.3% DeepSeek, 68.0% Haiku).
- Forced two-factor varimax rotation separates `content_accuracy` (loading 0.923 on Factor 2) from the seven pedagogical dimensions (loadings 0.68-0.85 on Factor 1).

**The uncomfortable implication**: the 8 v2.2 tutor dimensions (`pedagogical_strategy_planning`, `content_accuracy`, `adaptive_responsiveness`, `conceptual_progression`, `affective_resonance`, `question_quality`, `deliberation_depth`, `clarity_structure` — or whatever the current 8 are) measure essentially **one underlying construct** plus a separable `content_accuracy` modifier. The v2.2 redesign consolidated 14 → 8 dimensions following GuideEval P→O→E decomposition, but even the reduced 8 are not empirically distinct.

### What this breaks

1. **"Recognition narrows the dimension profile"** (§6.1) — partially tautological. If dimensions co-vary at $r = 0.78$, a rise in one implies a rise in most; within-response SD across 8 correlated indicators is equivalent to compressing the single underlying factor's floor-to-ceiling range. We softened this in v3.0.43 (§F2) but the deeper issue — the rubric measures what it intends to measure along only 1-2 axes — is not fixed, only acknowledged.

2. **Dimension-targeted optimisation** (§7.8) — targeting `adaptive_responsiveness` or `conceptual_progression` as optimisation objectives moves the single underlying quality factor, not independent skills. The §7.8 paragraph already acknowledges this. But continuing to operate an 8-dimension rubric for every future run spends ~8× the judge tokens per row without gaining 8× the resolution.

3. **Scoring cost** — each scored row pays for 8 dimension × $(score + reasoning)$ outputs. With judge costs at \$0.01-0.05 per row, the 8-dim structure multiplies judging spend by ~8× compared to a single pedagogical-quality score.

4. **Construct-validity claims** — every time the paper describes a result in terms of "8 tutor dimensions," it's implicitly asserting that the dimensions are distinct constructs. PCA says they aren't.

### What a rubric v3.0 would do

Either:
1. **Empirical consolidation**: score two factors directly — `overall_pedagogical_quality` (with richer rubric criteria folded into the single score) and `content_accuracy` (binary or 1-5). Fewer tokens, fewer degrees of freedom, stronger internal consistency. **OR**
2. **Discriminant-validity demonstration**: design scenarios where the 8 dimensions should *predictably diverge* (e.g., a scenario where `conceptual_progression` must rise while `affective_resonance` should legitimately fall). If no such scenarios exist (or none reproducibly produce the predicted divergence), the 8-dim structure is over-specified and (1) is warranted.

These paths are not mutually exclusive: (2) could be run as an empirical check before committing to (1).

---

## 2. Scope: this is Paper 3.0 or a methods paper, not Paper 2.0

CLAUDE.md is explicit: *"Do NOT retroactively score historical data under a newer rubric version — this creates cross-version contamination that invalidates within-run comparisons."* A v3.0 rubric would not be applied to Paper 2.0's 1,296 scored rows; it would be the scoring regime for forward work.

**Implication**: D5 does not block Paper 2.0 submission, revision, or acceptance. It is a design-debt item for the next paper or a standalone methods contribution.

**Two legitimate framings for D5**:

### 2.1 Framing A: quiet infrastructure upgrade for Paper 3.0
- Build v3.0 rubric spec.
- Apply to A10/A11/A12 follow-up runs (after D5 is ready and paper 2.0 is locked).
- Document the rubric consolidation decision in a revision-history entry but do not make a central claim of it.

### 2.2 Framing B: standalone methods paper — "LLM-as-Judge rubric dimensionality"
- Use Paper 2.0's PCA as a motivating example.
- Recruit 2-3 other public evaluation datasets (GuideEval, ICAP, MERLOT), compute PCA on each.
- Argue: published LLM evaluation rubrics systematically over-specify construct structure; a 1-2-factor scoring regime is empirically justified.
- Short paper (4-6 pages), "LLM-as-Judge evaluation" venue (NeurIPS workshop, EMNLP, COLM).

Framing B is substantially more work but more publishable than the quiet infrastructure upgrade. No decision required now; D5 is open enough to go either way.

---

## 3. Design sketch for v3.0 rubric

### 3.1 Single-factor empirical consolidation

**Proposed structure**: two scored components per tutor turn.

| Component | Scale | Prompt excerpt |
|---|---|---|
| `overall_pedagogical_quality` | 1-10 (integer) | "Consider the tutor's response overall. Does it engage with the learner's specific contribution, maintain productive tension, offer appropriate scaffolding, and support the learner's active sense-making rather than substitute for it? Score on a 1-10 scale where 1 = inert/generic, 10 = precisely calibrated to the learner's state with clear pedagogical intent." |
| `content_accuracy` | 1-5 (integer) | "Is the tutor's factual/domain content correct? 5 = fully correct, 1 = contains major errors. If not domain-applicable (pure pedagogical/emotional turn), score 5 by default." |

**Why 10-point for quality**: PC1 at 80.7% means the single factor spans a wide dynamic range; an integer 1-5 would have ceiling effects once recognition + autotuning raises scores to 4.5+. A 10-point scale preserves headroom.

**What's lost**: the apparent ability to say "recognition specifically improves `adaptive_responsiveness` but not `deliberation_depth`." But §8.6 already says this was illusory — such apparent differences were drawing on the single factor × per-dimension-prompt-framing variance. Saying the true thing plainly is a feature.

**What's retained**: cross-judge validation, holistic and per-turn scoring, trajectory analysis (slopes on the single factor). 90% of paper analytic apparatus survives intact.

**Token savings**: per row, judge outputs ~200 tokens instead of ~1,500 (8 dimension × ~180 tokens each + consolidation). ~7-8× cost reduction per judge call.

### 3.2 Discriminant-validity test (optional pre-step)

Author a small test suite of scenarios where pedagogical dimensions should predictably diverge:

| Scenario type | Predicted dimensional pattern |
|---|---|
| Tutor gives a correct but emotionally cold response to a distressed learner | `content_accuracy` high, `affective_resonance` low. Correlation should drop here. |
| Tutor gives an emotionally warm response containing a factual error | `affective_resonance` high, `content_accuracy` low |
| Tutor delivers a perfect ZPD-appropriate response but doesn't ask questions | `conceptual_progression` high, `question_quality` low |
| Tutor asks great questions without scaffolding concepts | `question_quality` high, `conceptual_progression` low |

Author 4-6 such "divergence scenarios," score under v2.2, check whether the 8 dimensions indeed separate *on these scenarios* at $r < 0.5$ while retaining the high-correlation pattern elsewhere.

**Interpretation**:
- Yes (dimensions separate on divergence scenarios): the 8-dim rubric has latent discriminant validity; the Paper 2.0 corpus is scenario-restricted such that divergence rarely triggers. Defer v3.0 consolidation.
- No (dimensions stay correlated even on divergence scenarios): rubric is genuinely over-specified; commit to v3.0 consolidation.

---

## 4. Effort + timeline

| Task | Effort | Dependencies |
|---|---|---|
| Author v3.0 rubric YAML (two factors, scoring prompts) | 1-2 days | — |
| Synthetic calibration for v3.0 (r check against known targets) | 1 day | v3.0 YAML |
| Author 4-6 discriminant-validity scenarios (optional) | 2-3 days | — |
| Pilot run: v3.0 on 20-30 existing rows, compare to v2.2 | 1 day | credit top-up |
| Decision: v3.0 ready-to-use OR needs further iteration | 0 days (read the pilot) | pilot data |
| Migrate `scripts/eval-cli.js evaluate` and `rejudge` to accept `--rubric-version 3.0` flag | 1-2 days | v3.0 ready |
| Update CLAUDE.md with v3.0 notes | 0.5 day | v3.0 live |
| **Total** | **5-8 days engineer time** | |

Much cheaper than any of A10/A11/A12 in API cost (no new generation runs needed; only rescoring a small pilot set). Main cost is engineering time.

---

## 5. What to decide before starting

1. **Framing A (infrastructure) or Framing B (methods paper)?** Determines downstream work allocation but not the v3.0 rubric itself.
2. **Should content_accuracy be binary (correct/incorrect) or 1-5?** 1-5 preserves a gradient for partial correctness (e.g., mostly-right with a minor conflation).
3. **Single integer score or score + reasoning?** The paper's §5.2.6 rubric version tracking suggests keeping reasoning for auditability. Would add tokens but preserve qualitative trace.
4. **Weight of content_accuracy in an overall score?** v2.2 weights content_accuracy at ~15%; v3.0 consolidation could either retain that or score the two factors independently and report both.

These are decisions for a dedicated D5 work session, not for now.

---

## 6. Cross-references

- Paper §8.6 "Rubric Evolution" — contains the PCA result motivating this work
- Paper §7.8 (§7.8.1 explicit interpretive caveat) — already flags that dimension-targeted optimisation is shifting the single factor
- `notes/paper-2-0/rubric-version-comparison-infra.md` — existing `--rubric-version` flag design for v2.x lineage; v3.0 extends the same mechanism
- `config/rubrics/v2.2/tutor.yaml` (and `v2.1/`, `v2.0/`, `v1.0/`) — the v3.0 file would live in `config/rubrics/v3.0/`
- `scripts/calibrate-rubric.js` — synthetic calibration script, needed for v3.0 r-check
- CLAUDE.md "Rubric version columns" — documents the cross-version contamination rule that forbids v3.0 application to Paper 2.0 data

---

## 7. Non-goals

- **Do not** apply v3.0 to Paper 2.0 data. Cross-version contamination is forbidden.
- **Do not** include D5 as a blocker for Paper 2.0 submission or revision. The PCA disclosure in §8.6 + the v3.0.43 tightening of §6.1 language is sufficient honest-reporting for this paper.
- **Do not** treat the v2.2 consolidation as a failure. It was a 14 → 8 reduction, empirically motivated, synthetically calibrated at $r = +0.996$. It just revealed — via PCA — that even 8 is over-specified.

---

## 8. Decision closeout (2026-06-24)

**Decision**: shelve/defer D5 implementation for the current Paper 2.0 cycle. The linked note is recovered, the design remains valid as future infrastructure, but no `config/rubrics/v3.0/` implementation or calibration run should be started now.

**Rationale**:

1. Paper 2.0 already handles the empirical problem honestly. Section 8.6 reports the PCA result, says the v2.2 rubric is functionally over-specified, and cautions that future iterations should either consolidate or demonstrate discriminant validity.
2. Retroactive v3.0 rescoring would violate the project's rubric-versioning rule. Paper 2.0 analyses must remain on v2.2 and should not mix a new score epoch into existing claims.
3. The remaining work is engineering and methods-paper scope, not a current claim blocker: authoring v3.0 YAML, adding evaluator routing, running calibration, and optionally designing divergence scenarios is a 5-8 engineer-day future slice.
4. The discriminant-validity path is useful only if someone wants to defend the eight v2.2 pedagogical subdimensions as independently meaningful. The present paper no longer needs that defence; it already interprets them as a single tutor-quality factor plus content accuracy.

**Future follow-up, if reopened**: create a new workplan item for a prospective Paper 3.0 measurement epoch. The acceptance criteria should be: add `config/rubrics/v3.0/tutor.yaml` with direct `overall_pedagogical_quality` and `content_accuracy` fields; preserve v2.2 as the Paper 2.0 epoch; run synthetic calibration plus a small same-response comparison against v2.2 for calibration only; and only run the optional divergence-suite test if the goal is to preserve or reject the eight-dimension interpretive structure.

**Closed item boundary**: D5's current workplan requirement is the decision closeout, not full v3.0 implementation. Closing this item does not kill v3.0 permanently; it records that v3.0 is future infrastructure/methods work, not a Paper 2.0 blocker.

**Verification**: `EVAL_DB_PATH=/Users/lmagee/.machinespirits-data/evaluations.db node scripts/analyze-rubric-pca.js --json` reproduces the PCA evidence path on 2026-06-24: 1,584 observations, 8 dimensions, PC1 share 0.8068, Kaiser count 1, mean inter-dimension r 0.7764, KMO 0.9383, with `content_accuracy` loading primarily on Factor 2 in the forced two-factor rotation.
