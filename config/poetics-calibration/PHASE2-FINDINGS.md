# Phase-2 Findings — drama-FORM instrument vs human labels (PROVISIONAL)

**Status: PROVISIONAL DRAFT, 2026-05-20. NOT folded into `paper-full-2.0.md`.**
The gate result below is decisive *as run*, but its interpretation is materially
limited by three sample-validity threats (§3). This document records the negative
*and* the reasons it is not yet a clean verdict on the instrument, and points to
the de-confounding re-test (§4). Do not cite any number here as a paper claim
until the §4 re-test settles whether the failure is the instrument's or the
sample's.

---

## 1. Result: the transfer gate FAILS

The Phase-1 instrument (classifies dramatic FORM — does a later *learner* turn
quotably re-read the learner's OWN earlier turns?) was triple-validated on
canonical literary drama. Phase 2 points it at the real object — 36 blinded LLM
tutor↔learner transcripts — and asks the one pre-registered question: does
FORM-classification **transfer** from literary to tutoring drama (§3 of
`PHASE2-DESIGN.md`)?

**It does not.** Instrument (codex critic) vs human FORM labels (one labeller,
36/36):

| statistic | value | pinned bar |
|---|---|---|
| quadratic-weighted κ | **0.044** | ≥ 0.60 |
| nominal (unweighted) κ | 0.222 | — |
| raw agreement | 17/36 (47%) | — |

**GATE: FAIL.** Per `PHASE2-DESIGN.md` §3/§6 and plan §78, a fail at the frozen
bar is the reportable finding — not a trigger to soften the bar, swap critics, or
re-define FORM.

## 2. Mechanism: the instrument over-attributes recognition

Confusion matrix (rows = codex instrument, columns = human):

| | human: recognition | flat | trap | codex total |
|---|---|---|---|---|
| **codex: recognition** | 9 | 12 | 6 | **27** |
| **codex: flat** | 0 | 7 | 0 | **7** |
| **codex: trap** | 1 | 0 | 1 | **2** |
| **human total** | 10 | 19 | 7 | 36 |

- Codex called **recognition 27×**; the human, **10×**. Of codex's 27 recognition
  calls, only 9 (33%) matched — **12 the human judged FLAT** (ordinary exchange,
  no recohering) and **6 the human judged TRAP** (insight-declaration without
  recohering).
- Codex made these calls *after clearing its own evidence gate* — every one cited
  a verbatim earlier learner turn. So the quote requirement is **necessary but not
  sufficient**: codex finds *something* quotable to call "re-read" where the human
  sees no genuine re-semanticization. It reads ordinary tutoring progression as
  structural recohering.
- The weighted κ (0.044) sits *below* the nominal κ (0.222) because the 6
  codex-recognition / human-trap cells are distance-2 on the pinned ordinal order
  `[recognition, flat, trap]` — the maximally penalised "fooled by the costume"
  confusion. The ordering pinned pre-data surfaces the instrument's worst failure
  as its largest cost, exactly as intended.

Per stratum (held-out key): base 8/18 exact (44%), recognition 9/18 exact (50%) —
the over-attribution is not localized to one condition.

This is the arc's central anti-simulation worry **demonstrated on real data**: an
LLM critic conflates the appearance of recognition with its structure.

## 3. Why this is NOT yet a clean instrument verdict — three sample-validity threats

The 36-transcript sample is narrow in ways that confound the negative. These were
surfaced by the human labeller after labelling the full set:

1. **Homogeneity → labeller fatigue.** The transcripts are highly similar; a human
   labelling all 36 reports that "everything looked the same." Fatigue degrades the
   human channel, which is the gate's ground truth — so some of the disagreement
   may be label noise from monotony, not instrument failure.
2. **Topic monoculture (all Hegel).** Every transcript is about Hegelian material.
   This narrows what "recognition" can look like and prevents any test of whether
   the instrument generalises across disciplines.
3. **The recognition form/content recursion + one dramatic shape.** Most
   transcripts presume a *stagnant-frustration → breakthrough* arc ("stuck on
   lecture X"), so the dramatic FORM is nearly fixed. Worse, because the *topic* is
   recognition, the concept being learned **is the same word as** the measurement
   criterion: a learner re-reading their understanding of "recognition" entangles
   content (talking about recognition) with form (the re-reading the instrument
   scores). Form and content cannot be separated in this sample.

Net: the gate-as-run cleanly shows codex and the human disagree, with codex
over-firing recognition. But whether that reflects (a) a genuine
instrument-transfer failure, or (b) an artifact of a monotonous, topically
confounded, single-shape sample, **cannot be decided from this sample**.

## 4. Way forward: a varied, de-confounded re-test

Re-test the instrument on a *varied* set of pedagogical dramas that breaks all
three threats — different disciplines (so the learned content is never
"recognition"), different dramatic shapes (not just stuck→breakthrough), and
different tutor/learner characters. The dramas are generated by the **real**
bilateral ego/superego agents (faithful role-play, not a single model scripting a
dialogue), via a light harness-free driver over `runInteraction`, then scored by
the same codex instrument and labelled by the same human, reusing the existing
`--sample-dir` paths of `score-poetics-phase2.js` and `label-poetics-phase2.js`.

Design principle: **seed for variance, label the emergent form** — the setups span
the outcome space; the FORM is whatever faithful role-play produces; we label what
emerges, never the intended category. A small (≤6) pilot is a **diagnostic** (does
de-confounding change the picture?), not a gate-powered re-run — κ on n=6 is noisy
and must not be over-read. If the pilot is promising, scale the generator to a
gate-powered N.

(Full plan tracked separately; not yet built.)

## 5. Pre-registration integrity

Recorded explicitly because the negative is inconvenient: we did **not** soften the
0.60 bar, swap codex for a more agreeable critic, or re-define FORM to rescue
transfer. The §4 re-test does not relax any pinned threshold — it removes a
sample-construction confound, which §7 of `PHASE2-DESIGN.md` pre-registered as an
open risk. The bar, the ordinal order, and the FORM definition are unchanged.
