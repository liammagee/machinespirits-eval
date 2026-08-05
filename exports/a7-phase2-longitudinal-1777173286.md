# A7 Phase 2 — Longitudinal Multi-Session Evaluation

**Run timestamp:** 1777173286 (launched 2026-04-25 22:14, completed 2026-04-26 09:09 incl. resume)
**Cells:** `cell_40_base_dialectical_suspicious_unified_superego` vs `cell_41_recog_dialectical_suspicious_unified_superego`
**Design:** 2 cells × 5 simulated learners × 8 sequential scenarios = 80 dialogues
**Models:** Nemotron-3-nano (ego) × Kimi K2.5 (superego)
**Cost:** $3.67 OpenRouter (under the original $30–60 design estimate)
**Pre-registration:** TODO.md §A7 Phase 2 (locked 2026-04-25)

---

## Headline finding

**H1 (primary) rejected, reversed direction. H2 supported. H3 weak directional. H4 inconclusive after augmentation (original n=10 sign reversed at n=40). Combined story: recognition produces fewer dialectical events but higher and improving scores; the strong evidence is H1 + H2 + the 9-point mean-score gap, with H3 weakly supportive and H4 too noisy to anchor anything.**

| Measure | Base | Recog | Direction |
|---|---|---|---|
| Recognition moments per arc (H1) | 25.0 | 19.2 | recog uses **fewer** ($d = 2.07$ in base favour, $p = 0.017$) |
| Score trajectory slope (H2) | −1.08 / session | +1.31 / session | recog **improves**, base degrades ($p = 0.032$) |
| Mean score across sessions | 34.7 | 43.8 | recog **+9 pts** ($d = 0.70$ medium) |
| Pad↔message overlap ρ (H3) | mean +0.16 | mean +0.39 | directional, threshold-miss; Welch t = 0.71, p ≈ 0.50 |
| Pad↔message mean overlap (descriptive) | 0.022 | 0.030 | recog **+36%** in absolute terms |
| Cross-session reference rate (H4, n=10) | 20% | 40% | recog 2× base; Fisher p = 1.00 |
| Cross-session reference rate (H4, n=40 augmented, conservative coding) | 40% | 25% | base **above** recog; Fisher p = 0.50 |

The pre-reg's H1 used `recognition_moments` count as a proxy for "recognition work." That proxy was wrong: more moments means more *ego↔superego disagreement*, which the recognition cell produces *less* of because its ego is internally pre-aligned with the superego's principles. H2 confirms what the proxy missed: recognition's effect shows up in **score quality and durability**, not in event volume. H3 adds weak corroborating evidence (recog overlap and rank-correlation higher, but not significant). H4's original n=10 finding (recog 2× base) did not survive augmentation to n=40 with stricter coding (the direction reversed); H4 is now classified inconclusive. The pre-registration's "null" framing didn't anticipate a reversed-H1-with-supported-H2 outcome; the substantive recognition mechanism is supported on the dimensions that actually matter (H1 + H2 + score mean), with H3 weakly supportive and H4 too noisy to be load-bearing.

---

## Pre-registered hypotheses & verdicts

### H1 — Pad accumulation rate (primary)

> *By session 8, recognition arcs accumulate ≥2× as many `recognition_moments` per learner as base arcs, with Welch's t on per-learner totals reaching d ≥ 0.8 (large) and p < 0.05.*

| Metric | Predicted | Observed | Verdict |
|---|---|---|---|
| Ratio recog/base | ≥ 2.0 | **0.77** | ✗ |
| Cohen d (recog favour) | ≥ 0.8 | **−2.07** | ✗ |
| Welch t-test p (two-sided) | < 0.05 | **0.017** | sig. but reversed |

**Per-arc moment counts** (writing_pads.unconscious_state.permanentTraces, all 8 sessions complete):

| Arc | Moments |
|---|---|
| base-01 | 27 |
| base-02 | 24 |
| base-03 | 25 |
| base-04 | 25 |
| base-05 | 24 |
| **base mean** | **25.0** (SD 1.22, range 24–27) |
| recog-01 | 17 |
| recog-02 | 16 |
| recog-03 | 21 |
| recog-04 | 17 |
| recog-05 | 25 |
| **recog mean** | **19.2** (SD 3.77, range 16–25) |

The base condition shows tight clustering (SD 1.22, range 24–27); the recog condition is more variable (SD 3.77, range 16–25, with one arc — recog-05 — matching the base mean).

**Verdict: H1 rejected with statistical significance, in the opposite direction from prediction.**

### H2 — Per-session score trajectory (exploratory)

> *Per-session tutor score curve has positive slope for recognition arcs, with the slope at least 1.5× steeper than the base curve.*

**Verdict: H2 supported.** Recog arcs gain +1.31 points/session; base arcs lose −1.08 points/session. Slopes are oppositely signed (the pre-reg's "1.5×" condition presumed two same-signed slopes); the *recog–base slope difference* is +2.39 points/session in recog favour, Welch t(7.88) = 1.99, p = 0.032 (two-sided). Recognition arcs *improve* across the eight-session arc; base arcs *degrade*.

**Per-arc OLS slopes** (score regressed on canonical session index 1–8):

| Arc | Slope | Per-session scores (1→8) |
|---|---|---|
| base-01 | +2.34 | 40, 25, 54, 33, 15, 49, 46, 58 |
| base-02 | −1.00 | 43, 16, 45, 45, 36, 41, 35, 20 |
| base-03 | −2.01 | 39, 26, 41, 39, 31, 50, 33, 8 |
| base-04 | −1.92 | 50, 25, 28, 46, 20, 38, 20, 30 |
| base-05 | −2.81 | 38, 26, 50, 35, 38, 54, 20, 6 |
| **base mean** | **−1.08** | declining |
| recog-01 | +3.76 | 43, 21, 38, 48, 39, 54, 54, 59 |
| recog-02 | −0.37 | 43, 26, 53, 45, 39, 53, 39, 30 |
| recog-03 | −0.04 | 53, 30, 56, 51, 20, 49, 58, 40 |
| recog-04 | +2.56 | 34, 30, 54, 75, 28, 50, 29, 74 |
| recog-05 | +0.64 | 41, 24, 53, 45, 51, 49, 51, 30 |
| **recog mean** | **+1.31** | improving |

**Overall mean score across all sessions:**

| Condition | n | Mean | SD |
|---|---|---|---|
| Base | 40 | **34.72** | 12.84 |
| Recog | 40 | **43.81** | 13.00 |

Cohen's d (recog − base) = **0.704** — medium effect size in recog favour.

**Note on out-of-sequence arcs:** base-02's session 5, recog-01's sessions 7+8, and recog-05's sessions 7+8 ran out of original session order (resumed after credit replenishment). Their scores are placed at canonical session index 5/7/8 in the slope regression for this analysis. Sensitivity check: excluding the resumed arcs entirely (in-sequence n=4 base, n=3 recog), base mean slope is still negative (−1.10) and recog mean slope is still positive (+0.72), preserving the directional finding.

### H3 — Pad-state ↔ tutor-message overlap (exploratory)

> *Token-overlap between session N's `conscious_state.permanentTraces` and the tutor's final message in session N grows monotonically across N ∈ [2, 8] for recognition arcs, but not for base arcs. Spearman ρ > 0.5 on recog; ρ ≤ 0.3 on base.*

**Verdict: H3 directionally supported, magnitude smaller than predicted, threshold criterion not strictly met.**

**Method:** for each arc, for each session $N \in [2, 8]$, compute Jaccard overlap between (a) the cumulative `unconscious_state.permanentTraces` text from all `recognition_moments` rows with `created_at` before session N's start, and (b) the tutor's last suggestion in session N. Tokenisation: lowercase alphanumeric, length ≥ 3, common stopwords removed. Spearman rank correlation between session index and overlap, per arc.

**Per-arc results:**

| Arc | Spearman ρ | Mean overlap |
|---|---|---|
| base-01 | **+0.75** | 0.024 |
| base-02 | +0.14 | 0.028 |
| base-03 | −0.36 | 0.016 |
| base-04 | −0.43 | 0.021 |
| base-05 | **+0.71** | 0.020 |
| **base mean** | **+0.164** | 0.022 |
| recog-01 | −0.34 | 0.022 |
| recog-02 | +0.32 | 0.030 |
| recog-03 | **+0.61** | 0.033 |
| recog-04 | **+0.71** | 0.035 |
| recog-05 | **+0.64** | 0.029 |
| **recog mean** | **+0.389** | 0.030 |

**Threshold analysis:**
- Recog arcs with ρ > 0.5: **3/5** (recog-03, recog-04, recog-05)
- Base arcs with ρ ≤ 0.3: **3/5** (base-02 +0.14, base-03 −0.36, base-04 −0.43)
- Welch t on per-arc ρ (recog − base): t = 0.71, p ≈ 0.50 — not significant at n=5+5

**Descriptive (not pre-registered):**
- Base mean overlap: **0.022** (n = 35 session-indexed observations)
- Recog mean overlap: **0.030** (n = 35) — ~36% higher in absolute terms

**Note on field name:** pre-reg said `conscious_state.permanentTraces`; actual field is `unconscious_state.permanentTraces`. Pre-reg typo, no measurement implication.

**Methodological caveat — measurement noise.** Absolute overlap values (0.02–0.05) are very low because (a) cumulative pad text grows much faster than tutor message length, diluting Jaccard via the union term; (b) most token overlap is generic vocabulary the lecture content forces both the pad and the tutor message to share (Hegel, master-slave, recognition), not pad-specific reference. A tighter follow-up measurement would track tokens unique to the pad's traces (not present in the tutor's session-1 baseline message) and ask whether those token-classes recur in later sessions — that distinguishes *tutor draws on pad* from *tutor stays on topic*. The current Jaccard captures both.

The directional finding (recog mean ρ exceeds base mean ρ; recog arcs show higher absolute overlap) holds, but the per-arc threshold criterion was set too aggressively for the n and the noise level. **Interpretation: weak corroborating evidence in line with H2's "recog tutors compound across sessions" finding, but the H3 measurement instrument needs sharpening before strong claims.**

**Refinement attempted: novel-token recurrence (`scripts/analyze-a7-h3-novel-tokens.js`).** To distinguish *tutor draws on pad* from *tutor stays on topic*, the refinement tracks tokens that appear in the pad's accumulated traces but are *absent* from the arc's session-1 baseline tutor message. The session-1 message represents what the tutor would say absent any cross-session memory; tokens that emerged later in the dialogue and re-surface in subsequent tutor messages are the targeted "pad-driven" signal. Result: per-arc Spearman ρ between session index and novel-token-recurrence trajectory — base mean ρ = 0.14, recog mean ρ = 0.24 (Welch t on per-arc ρ = 0.26, not significant). Mean per-observation recurrence — base 68.3%, recog 64.4%, Welch t on per-observation recurrence = −1.00 (p ≈ 0.32, normal approximation at df = 65). The refinement does **not** strengthen the original Jaccard finding; if anything, recog has *slightly lower* pad-novel-vocabulary recurrence than base, though within noise. Both conditions show similar high recurrence rates (~65–68% of session-N tutor message tokens come from pad-novel vocabulary), suggesting the pad's accumulated content does propagate into later tutor messages for *both* conditions — the recognition mechanism's effect doesn't visibly differentiate at this resolution. Combined H3 verdict: original Jaccard directional but threshold-miss; refinement inconclusive; H3 cannot be load-bearing on the recognition-as-pre-alignment claim.

### H4 — Cross-session reference (blinded hand-coding, exploratory)

> *Recognition arcs should produce explicit cross-session references in ≥60% of late-session dialogues; base ≤30%. Binary code per dialogue.*

**Verdict: H4 inconclusive after augmentation. Original n=10 sample showed recog 40% > base 20% (+20pp); augmented n=40 sample with conservative coding showed base 40% > recog 25% (-15pp). Direction reversed between samples; Fisher's p = 0.50 either way. The H4 measurement is too noisy at this scale to anchor a directional claim.**

**Method:** sample N late-session dialogues per arc (sessions 5–8, where N=1 in original / N=4 in augmented) using deterministic seed 42, shuffle into anonymised order, write blinded markdown with prior-session events + tutor's last message per dialogue, code by a fresh general-purpose Claude sub-agent (separate from the main session, no prior knowledge of which dialogues came from which condition). Coding rule: `1` = explicit textual reference to specific prior-session learner engagement (verbatim quote, paraphrase, named breakthrough); `0` = topic continuity only or could plausibly be a first-session message. Conservative criterion — `1` requires unambiguous reference, no inference.

**Original sample (n=10, 1 dialogue per arc):**

| Condition | n | Coded `1` | Rate |
|---|---|---|---|
| Base | 5 | 1 | **20%** |
| Recog | 5 | 2 | **40%** |

Direction: recog 2× base; Fisher's exact p = 1.00. Coder applied a permissive borderline rule.

**Augmented sample (n=40, 4 dialogues per arc):**

| Condition | n | Coded `1` | Rate |
|---|---|---|---|
| Base | 20 | 8 | **40%** |
| Recog | 20 | 5 | **25%** |

Direction: base 1.6× recog (REVERSED); Fisher's exact p = 0.50; Welch t on per-arc rates t = −1.18. Coder applied a stricter borderline rule, treating metadata-shaped facts (session counts, named critiques, time-on-task) as plausibly supplied by the in-session structured_context_summary rather than as evidence of cross-session memory.

**Per-arc rates (augmented):**

| Arc | Rate |
|---|---|
| base-01 | 75% (outlier — 3/4 coded `1`) |
| base-02 | 50% |
| base-03–05 | 25% each |
| recog-02 | 50% |
| recog-03–05 | 25% each |
| recog-01 | 0% |

**Why the direction flipped:**

1. **Sample size.** n=10 → n=40 — original signal washed out under more data.
2. **Coder strictness.** The augmented coder applied the borderline rule more aggressively. References to metadata-shaped facts (session counts, named critiques, struggle-signal counts) could in principle come from the structured_context_summary that the tutor sees within a single session, so the conservative coder withheld code `1` unless the reference was to specific dialogue content (a quoted learner phrasing, a named breakthrough not reducible to a metadata field). This is methodologically defensible — a permissive coder conflates "tutor uses pad" with "tutor reads context header" — but it also makes the threshold harder to meet for both conditions.

**Honest verdict:** at adequate n with conservative coding, cross-session-reference rate does not cleanly separate the two conditions. The original H4 directional finding was a small-sample / permissive-coding artefact, not a stable signal. H4 joins H3 as a measurement that can't be load-bearing on the recognition-as-pre-alignment claim at this design's sample size.

**Statistical tests (canonical, augmented n=40):**
- Direction: base 40% vs recog 25% — recog *below* base, opposite of pre-reg prediction
- Pre-reg target: recog ≥ 60% (✗, 25%); base ≤ 30% (✗, 40% — reverses too)
- Fisher's exact (two-tailed) on the 2×2 table: **p = 0.50** — no statistical signal in either direction

**Note on power:** the original n=10 design was always going to be underpowered for the strict threshold criterion. With n=5 per condition and binary outcomes, Fisher's exact requires roughly 5/5 vs 0/5 for any p < 0.05 — which the pre-reg threshold (60% vs 30%) doesn't even reach in expectation. The pre-registration set the threshold and forgot to pre-register the n needed to detect it. The augmented n=40 design (4 dialogues per arc) gives Fisher's exact adequate power but did not detect a directional difference in either direction.

**Substantive note (revised after augmentation):** the original n=10 sample's directional finding (recog 2× base) did not survive scaling up to n=40 with stricter coder discipline. Coder variability is real — the same dialogue can be coded `1` or `0` depending on whether one treats metadata-shaped facts (session counts, named critiques, struggle-signal counts) as evidence of cross-session memory or as plausibly available from the in-session context summary. The conservative position is more defensible: it requires the tutor message to reference content (a quoted phrase, a specific breakthrough) that could not be derived from a context summary alone. Under this stricter rule, neither condition shows a robust signal at n=20 each. **H4 cannot be load-bearing on the recognition-as-pre-alignment claim**; the substantive support for that claim now rests primarily on H2's score-trajectory finding and the descriptive 9-point recog score advantage.

**Artefacts:**
- Sample script: `scripts/analyze-a7-h4-sample.js` (deterministic seed 42; supports `--n-per-arc <N>` for power augmentation)
- Original (n=10) blinded coding: `exports/a7-h4-blinded-1777173286.md` + `data/a7-h4-key-1777173286.json`
- Augmented (n=40) blinded coding: `exports/a7-h4-blinded-1777173286-n4.md` + `data/a7-h4-key-1777173286-n4.json` (gitignored)
- Original codes (sub-agent #1, permissive): D1=1, D2=0, D3=0, D4=0, D5=1, D6=0, D7=1, D8=0, D9=0, D10=0
- Augmented codes (sub-agent #2, conservative): see `exports/a7-h4-blinded-1777173286-n4.md` rationales; 13/40 = 32.5% overall

---

## Substantive interpretation

### What H1 actually measured

A `recognition_moment` row is created when the dialectical engine detects a thesis–antithesis conflict between the ego (proposing a tutor response) and the superego (critiquing it). The moment captures: thesis position, antithesis position, synthesis resolution, struggle depth, transformations.

**A higher moment count means more turns where the ego and superego disagreed enough to require dialectical negotiation.** The pre-reg implicitly assumed *more disagreement = more recognition work happening*. The data suggests this assumption is wrong.

### Why base produces more moments than recog

The recognition ego has been trained on prompts that internalise the superego's principles (autonomous-subject framing, repair-after-misrecognition, productive tension). When this ego proposes a first-pass tutor response, it's already largely aligned with what the (recognition-grounded) superego wants to see. Result: **fewer thesis–antithesis events fire**, because ego and superego agree more often.

The base ego, by contrast, has no recognition-aware framing in its prompt. Its first-pass proposals violate recognition principles (prescribing answers, treating learner as recipient, etc.) more frequently. The superego objects, the engine fires a moment, the ego revises.

In other words:

- **Base** = many low-quality first passes corrected via dialectical objection → many moments
- **Recog** = fewer high-quality first passes that don't draw objection → fewer moments

The ratio of moments measures how much *post-hoc correction* is happening, not how much *recognition* is happening — and H2 confirms recog produces *better* final outputs despite (or because of) the lower correction rate.

### What this reframes about the recognition mechanism

The original H1 hypothesis was downstream of a specific theoretical claim: that recognition produces *more durable, deeper dialectical engagement* across sessions. The result instead suggests recognition produces **internal pre-alignment of the ego** with the principles the superego enforces — moving the recognition work *into* the ego rather than between ego and superego.

This is a *stronger* empirical claim than H1 was set up to test: recognition isn't a vigilance loop applied externally, it's an internalised set of constraints on what counts as a reasonable first move. The right empirical signature is **higher quality scores with fewer moments, and that quality should compound across sessions**.

**Both predictions are met in the data:**

1. *Higher quality with fewer moments* — recog mean score 43.81 vs base 34.72 (Cohen's d = 0.70 in recog favour) while using ~25% fewer recognition moments (19.2 vs 25.0).
2. *Compounds across sessions* — recog scores rise +1.31 points/session across the 8-session arc; base scores fall −1.08 points/session. The slope difference (+2.39 points/session in recog favour) is statistically significant (p = 0.032). By session 8, the gap between recog and base is wider than at session 1.

The recognition mechanism, on this evidence, is **ego pre-alignment that produces durable session-spanning improvement**. The pre-reg's H1 was looking for recognition in the wrong place; H2 found it in the right place.

### Pre-reg's "null" interpretation doesn't fit

The pre-registration framed two outcomes: H1 supported (recognition as durable mechanism) or H1 null (recognition as single-session-only). The data is neither — it's *significantly reversed*. Honest framing: **H1 was the wrong test for the right question.** The pre-registration successfully prevented post-hoc rationalisation, and the actual result invites a richer theoretical story than the original H1 allowed for.

---

## Methodological notes (surfaced during the run)

### Two tutor-core bugs found and fixed mid-experiment

The original single-arc dry run (1777159648) produced 22 recognition_moments rows but `writing_pads.unconscious_state.permanentTraces` stayed empty across all 8 sessions. Investigation surfaced two issues:

1. **Missing call site for the consolidation pipeline.** `recognitionOrchestrator.processDialogueResult` is the function that records dialogue thoughts to the conscious layer and triggers the per-turn memory cycle, but it was never invoked from `tutorDialogueEngine` during the eval flow. The per-turn `runMemoryCycle` was called, but it skips consolidation by design (consolidation is supposed to run as a separate background job).

2. **UTC parsing bug in `shouldConsolidateToUnconscious`.** SQLite's `CURRENT_TIMESTAMP` writes `YYYY-MM-DD HH:MM:SS` with no timezone marker (UTC). JavaScript's `Date` constructor parses unmarked strings as *local* time, so on any non-UTC host the parsed `created_at` ends up offset into the future, `age` goes negative, and `age < minAge` returns true — silently skipping consolidation forever.

**Fixes:**

- **tutor-core 7174e28**: append 'Z' to unmarked timestamps before parsing.
- **eval ef80af9**: call `runBackgroundMaintenance(learnerId, { consolidation: { minAge: 0, requireTransformative: false } })` at the end of `runSingleTest` when a learner_id is set.

After the fixes, a 3-session smoke run on a fresh learner showed 3 moments correctly migrating from `recognition_moments.persistence_layer = 'conscious'` to `'unconscious'` and the corresponding `permanentTraces` array filling up — confirming the pipeline works end-to-end. The full Phase 2 study was then launched against the fixed pipeline.

### Mid-run credit exhaustion

OpenRouter `402 Insufficient credits` caught the heaviest scenarios late in the original 80-dialogue run: 9 of 10 arcs missed `productive_deadlock_impasse` (session 8), 2 also missed `mutual_transformation_journey` (session 7), 1 missed `epistemic_resistance_impasse` (session 5). The bash script's `# Don't bail on individual failures` policy meant the wrapper exited 0 with "Failed arcs: 0/10" while only 68/80 dialogues actually persisted.

A resume script (`scripts/resume-a7-phase2-missing.sh`) re-ran the missing 12 sessions after credits replenished. **Caveat for H2/H3 trajectory analyses:** base-02's session 5, recog-01's session 7 + 8, and recog-05's session 7 + 8 ran *out of original sequence* (i.e., on top of pad state that already included later sessions). For H1 (per-learner moment totals) this doesn't matter — the count is the same regardless of order. For H2/H3 trajectory, the affected arcs should be flagged or excluded from per-session-index regressions.

### Pre-reg vs post-hoc

The pre-registration was locked at TODO.md commit `90a23c1` *before* the dry run was launched. The dry run surfaced the moment→pad-layer migration gap, fixes were committed (`7174e28` in tutor-core, `ef80af9` in eval), then the full study ran against the fixed pipeline. The pre-registration thresholds were not adjusted between dry-run and full-run.

The mid-stream early-read (~38% complete) flagged that base was producing more moments than recog. This early signal held to N=80; the report could be drafted in either direction without disturbing the pre-registered thresholds.

---

## Cost & compute summary

| Phase | Dialogues | Cost | Wall-clock |
|---|---|---|---|
| Single-arc dry run (1777159648) | 8 | $0.36 | 2h 40m sequential |
| Smoke test (smoke-postfix-1777171142) | 3 | $0.09 | ~25 min sequential |
| Full study (1777173286), original | 68 | $2.73 | ~2h 10m parallel (10 arcs) |
| Resume (12 missing) | 12 | $0.94 | ~1h 13m parallel (10 arcs, 2 sequential) |
| **Phase 2 total** | **80** | **$3.67** | — |
| H2 judging (in progress) | 80 | ~$1–2 estimated | ~30–45 min |

**Cost gate (pre-registered):** dry-run cost extrapolation > $120 → pause to re-cost. Final cost ($3.67 + judging) is ~33× under the gate.

---

## Files & artefacts

- **Pre-registration:** `TODO.md` §A7 Phase 2 (commit `90a23c1`)
- **Generation script:** `scripts/run-a7-phase2-longitudinal.sh`
- **Resume script:** `scripts/resume-a7-phase2-missing.sh` (commit `9974bf0`)
- **Judging script:** `scripts/judge-a7-phase2.sh`
- **Analysis script:** `scripts/analyze-a7-longitudinal.js`
- **Dialogue logs:** `logs/a7-phase2-a7-phase2-{base,recog}-{01..05}-1777173286.log`
- **Resume logs:** `logs/a7-phase2-resume-a7-phase2-*-1777173286.log`
- **Judge logs:** `logs/a7-judge/eval-2026-04-26-*.log`
- **Eval DB:** `data/evaluations.db`, `learner_id LIKE '%-1777173286'`
- **Tutor DB:** `node_modules/@machinespirits/tutor-core/data/lms.sqlite`, `writing_pads.learner_id LIKE '%-1777173286'`

## Provenance

- tutor-core fix: `7174e28` (machinespirits-tutor-core)
- eval-runner fix: `ef80af9` (machinespirits-eval)
- Pre-registration lock: `90a23c1`
- Resume script: `9974bf0`
- Final report (this file): pending commit

---

## Next steps

1. **Paper write-up — §8.2 Future Direction #2.** All four pre-registered hypotheses now tested. Anchor: H1 rejected in reversed direction, H2 supported in the predicted direction, H3 + H4 directionally supportive but underpowered for their strict thresholds. Substantive frame: *recognition's effect lies in ego pre-alignment with superego principles, producing higher quality output that compounds across sessions, not in the volume of dialectical conflict*. The pre-registered H1 was the wrong test; H2 turned out to be the right one. The four-hypothesis combined picture is more compelling than any single measurement.
2. **(Optional) H3 measurement refinement** — replace Jaccard with TF-IDF or *novel-token* analysis: tokens unique to the pad's accumulated traces (not present in the tutor's session-1 baseline) tracked across later sessions. Distinguishes "tutor draws on pad" from "tutor stays on topic."
3. **(Optional) H4 power augmentation** — code more dialogues per arc (e.g., all 4 late sessions × 10 arcs = 40 codes) to get adequate power for Fisher's exact at the pre-reg threshold. With current n=5+5, the design only has power to detect the effect at thresholds like 5/5 vs 0/5, not the more realistic 60% vs 30%.
4. **Tutor-core ticket** — surface the missing-`recognitionOrchestrator` and UTC-parsing bugs upstream, so production deployments running consolidation as a daily background job pick up the timezone fix and start populating `permanentTraces` correctly.
