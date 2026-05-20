# Phase-0 findings — poetics calibration (dramatic-form critic)

**Status:** SEPARATE PATH (not yet in `docs/research/paper-full-2.0.md`). Per the
2026-05-20 decision, the Phase-0 discussion, numbers and instrument design live
here until they are folded into the main paper or a derivative. Nothing in this
document is a paper claim yet.

**Arc:** `DRAMATIC-RECOGNITION-PLAN.md` §5.4 / §6 (the instrument gate).
**Instrument:** `config/evaluation-rubric-poetics.yaml` v1.0 (6 dimensions:
peripeteia, anagnorisis, surprise_and_inevitability, unity_of_action,
hamartia_integration, cathartic_closure).
**Answer key / pre-registration:** `config/poetics-calibration/key.yaml`.
**Scorer:** `scripts/score-poetics-calibration.js`.
**Artifacts:** `exports/poetics-calibration-{gpt,claudecode}.json` (current, v2);
`*-v1.json` (preserved pre-clamp-fix draw).

---

## 1. What Phase 0 is for

Before the dramatic-form critic is pointed at any LLM tutoring transcript, it has
to be shown to separate *known* dramatic recognition from *known* flat exposition,
and — critically — to NOT be fooled by recognition **vocabulary** bolted onto a
non-event (plan line 38: "the entire apparatus exists to beat this one trap").
Phase 0 is that instrument check. **If the gate fails, that is the finding, and
there are no downstream phases.**

### Blinding protocol

The critic sees only the neutral transcripts in `corpus/*.txt` (speakers
relabelled `A:/B:/C:/D:`, source and pole stripped). The ground truth in
`key.yaml` is joined to the blind scores **only after** scoring. Generator ≠
critic: the two trap items (S1/S2) were authored by Claude, so **`gpt`
(openai/gpt-5.2) is the clean primary critic** and `claude-code` is a
cross-check. (claude-code scoring Claude-authored traps at the floor is the
non-flattering direction, so the shared-author concern does not bite the verdict.)

---

## 2. The pre-registered gate (key.yaml `gate:`)

| Criterion | Pre-registered threshold |
|---|---|
| `perfect_separation` | every high item outscores every flat item (`min(high) > max(flat)`) |
| `min_mean_margin` | `mean(high) − mean(flat) ≥ 30` on the 0–100 scale |
| `trap_ceiling` (original) | every trap `≤ mean(flat)` |

Perfect separation at 5×5 is a ≈0.4%-by-chance bar; the margin and trap-ceiling
criteria are the substantive disconfirmation channel. Plan line 78 (verbatim):
*"'no null' must not become 'no possible disconfirmation.' The gates above are the
disconfirmation channel; if they are removed or softened mid-arc, the result is
closed-loop self-flattery."* This document is written to honour that line — see §5.

---

## 3. Per-item results (overall, 0–100)

`v1` = pre-clamp-fix draw; `v2` = current draw with the corrected evidence matcher.
Both columns are real blind draws; v2 is authoritative.

| id | pole | gpt v1 | **gpt v2** | cc v1 | **cc v2** |
|----|------|-------:|-----------:|------:|----------:|
| H1 | high | 58.8 | **87.5** | 77.5 | **100** |
| H2 | high | 96.2 | **96.2** | 85.0 | **100** |
| H3 | high | 48.8 | **52.5** | 82.5 | **86.3** |
| H4 | high | 62.5 | **66.3** | 75.0 | **90.0** |
| H5 | high | 96.2 | **100** | 96.2 | **96.2** |
| F1 | flat | 3.7 | **3.7** | 0 | **0** |
| F2 | flat | 3.7 | **3.7** | 0 | **0** |
| F3 | flat | 11.2 | **3.7** | 0 | **3.7** |
| F4 | flat | 3.7 | **11.2** | 0 | **3.7** |
| F5 | flat | 17.5 | **16.2** | 8.7 | **3.7** |
| S1 | trap | 15.0 | **15.0** | 3.7 | **3.7** |
| S2 | trap | 8.7 | **16.3** | 0 | **3.7** |

**Boundary statistics (v2):**

| | gpt | claude-code |
|---|---:|---:|
| mean(high) | 80.5 | 94.5 |
| mean(flat) | 7.7 | 2.2 |
| mean(trap) | 15.7 | 3.7 |
| min(high) | 52.5 (H3) | 86.3 (H3) |
| max(flat) | 16.2 (F5) | 3.7 |
| max(trap) | 16.3 (S2) | 3.7 |
| **trap → high gap** (min(high) − max(trap)) | **36.2** | **82.6** |

---

## 4. The two substantive criteria — PASS decisively (both critics)

- **Perfect separation:** PASS both. min(high) 52.5 > max(flat) 16.2 (gpt);
  86.3 > 3.7 (cc). Every recognition scene outscores every flat catechism.
- **Mean margin ≥ 30:** PASS both, by a wide margin: **72.8** (gpt), **92.3** (cc).

The instrument reads genuine Aristotelian recognition (Meno aporia, the Oedipus
herdsman scene, the *Iphigenia* sibling recognition) as categorically different
from competent fixed-answer exposition (Westminster catechism, Say's political
economy). On the two criteria that carry the instrument's actual claim, Phase 0
passes cleanly under both critics.

---

## 5. The trap ceiling — original FAILED, re-specified post-hoc

This is the one place the literal pre-registration did not pass, and it is treated
transparently rather than silently softened.

### 5.1 The original criterion FAILED (both critics)

`trap ≤ mean(flat)`: gpt traps 15.0 / 16.3 vs mean(flat) 7.7 → **FAIL**;
cc traps 3.7 / 3.7 vs mean(flat) 2.2 → **FAIL**. Recorded as FAILED; not erased.

### 5.2 Diagnosis — why mean(flat) is the wrong ruler

1. **mean(flat) is dragged to the floor by pure catechisms.** F1/F2 are
   `Q: what is dew? A: moisture`-style and score 0–3.7, pulling mean(flat) to
   7.7 (gpt) / 2.2 (cc). Any *minimally coherent* trap necessarily sits above
   that floor — so the criterion penalises a trap for being more surface-coherent
   than the dullest catechism, which is **not** the anti-simulation claim.
2. **A flat-relative ceiling is noise-sensitive.** Between the v1 and v2 draws,
   with no change to the items, gpt's S2 moved 8.7 → 16.3 while max-flat F5 moved
   17.5 → 16.2. So `trap ≤ max(flat)` was satisfied in v1 (15.0 ≤ 17.5) and
   *flips to FAIL in v2* (16.3 > 16.2, by 0.1) on **sampling variance alone**.
   A criterion that flips on a 0.1-point wobble between identical-input draws is
   measuring noise, not the claim.

The real anti-simulation claim is: **a trap must not be read as recognition.**
"A trap must score below the dullest flat catechism" is a separate, artifactual
demand bundled into the original threshold.

### 5.3 Amended criterion — minimax tiers

Per the 2026-05-20 instruction (*"ideally trap < max(flat) AND trap < min(high),
but one or the other would also work"*), the trap ceiling is re-specified as two
strength-ordered tiers:

- **REQUIRED — `max(trap) < min(high)`** (traps never reach the recognition band).
  **GATING.**
- **preferred — `max(trap) ≤ max(flat)`** (traps stay within the flat band).
  Reported, not gating.

Because perfect separation holds (`max(flat) < min(high)`), the two clauses are
ordered: `trap < max(flat)` *implies* `trap < min(high)`. The conjunction the user
described collapses to the stronger clause (preferred); the disjunction collapses
to the weaker one (required). Both are computed and printed on every run; the gate
decides on the required tier.

### 5.4 Honesty caveat (plan line 78)

`trap_below_min_high` is **genuinely weaker** than the original `mean(flat)`
ceiling. This is a transparent post-hoc re-spec, **not** a silent softening:

- the original criterion is preserved in `key.yaml` and §5.1 here, marked FAILED;
- all three tiers (required / preferred / original-superseded) are computed and
  reported on every run and stored in each artifact's `gate` block;
- a skeptic may legitimately read the weakening as self-flattery. The defence is
  that mean(flat) tested the *wrong thing* (§5.2) and the gap that *does* carry
  the anti-simulation claim is large: **36.2** points (gpt) / **82.6** points (cc)
  between the best trap and the weakest genuine recognition scene. The traps land
  squarely in the flat band (15.7 / 3.7 mean), nowhere near recognition.

### 5.5 Trap-ceiling verdict

| tier | gpt | claude-code |
|---|---|---|
| REQUIRED `max(trap) < min(high)` | **PASS** (16.3 < 52.5) | **PASS** (3.7 < 86.3) |
| preferred `max(trap) ≤ max(flat)` | FAIL (16.3 > 16.2, by 0.1) | PASS (3.7 ≤ 3.7) |
| original `trap ≤ mean(flat)` (superseded) | FAIL | FAIL |

---

## 6. The evidence-gate clamp fix (scorer maintenance, NOT gate redefinition)

The scorer enforces an anti-hallucination rule: any dimension scored > 3 must
quote a verbatim substring of the transcript, else the score is clamped to 3.
The v1 draw mis-fired this gate and **wrongly clamped genuine high-pole scores**,
because the substring match was too literal. Three causes, all fixed in
`normalizeForMatch` / `applyEvidenceGate`:

1. **Speaker labels** (`A:`/`B:`) interleaved between turns broke quotes that
   spanned a turn boundary → strip line-leading `^\s*[A-Z]:\s*` before matching.
2. **Typographic apostrophes/dashes** (`'`, `—`) in the corpus vs the critic's
   straight characters → delete all quote/apostrophe marks, unify U+2010–2015
   dashes, treat `-` as a separator.
3. **Ellipsis-stitched non-contiguous quotes** → split evidence on `…`/`...` and
   require each fragment (≥ 8 chars) to be present independently.

Verified offline (`/tmp/verify-clamp-fix.mjs`): **8 false-positive clamps removed**;
the only remaining clamp (cc H4 `unity_of_action`) had **empty** evidence, which
is a correct clamp. Effect on the high pole: gpt mean 72.5 → 80.5, cc 83.2 → 94.5;
H1 rose 58.8 → 87.5 (gpt) and to 100 (cc).

**This is distinct from the three pre-registered criteria.** Hardening an
anti-hallucination matcher so it stops penalising *correctly-quoted* evidence is
scorer maintenance; it is not a redefinition of the gate. The gate thresholds
(§2) were untouched by the clamp fix.

---

## 7. Verdict

**Phase-0 gate: PASS under both critics** on the amended (required-tier) criterion.

- Perfect separation: PASS / PASS.
- Mean margin ≥ 30: PASS (72.8) / PASS (92.3).
- Trap ceiling (required `max(trap) < min(high)`): PASS / PASS; preferred tier
  PASS for claude-code, FAIL-by-0.1 for gpt.

The instrument distinguishes genuine dramatic recognition from flat exposition,
and is not fooled by recognition vocabulary without structural rupture. The
literal original trap ceiling failed; the re-spec is documented as a genuine
(transparent) weakening, with the original result preserved.

### How the gate was re-evaluated

The v2 artifacts' per-item scores are **frozen from the original blind draw**. The
amended gate verdict was applied by recomputing **only** the gate block over those
frozen scores (`evaluateGate(scored, key)`, a pure function) — no re-drawing, no
re-rolling, no cherry-picking a favourable sample. Each artifact carries
`gate_recomputed_at` + `gate_criterion` provenance markers; `scored[]` is byte-for-
byte unchanged.

---

## 8. Open / deferred items

- **F4 re-verification:** `key.yaml` flags F4 as `provenance: TRIMMED` (2 fabricated
  pairs removed; the 4 retained pairs need re-checking against the archive.org scan
  before any paper use).
- **5th high-pole slot (plan line 111):** revisit Euripides *Iphigenia* vs a
  Shakespeare recognition scene; Euripides is thematically "sad" too, so sadness is
  a cross-source confound — blinding + normalisation (not source choice) must keep
  thematic catastrophe out of the FORMAL score. (User flag, 2026-05-19.)
- **Folding into the paper:** when this graduates from the separate path, the
  empirical claims here move into `docs/research/paper-full-2.0.md` first (single-
  paper discipline), and any spin-off inherits from there.

---

## 9. Pointers

- Plan: `DRAMATIC-RECOGNITION-PLAN.md` (lines 38, 78, 110–111; §5.4, §6).
- Pre-registration / amendment: `config/poetics-calibration/key.yaml` (`gate:` block).
- Rubric: `config/evaluation-rubric-poetics.yaml` v1.0.
- Scorer: `scripts/score-poetics-calibration.js` (`evaluateGate`, `applyEvidenceGate`,
  `normalizeForMatch`).
- Artifacts: `exports/poetics-calibration-{gpt,claudecode}.json` (+ `*-v1.json`).
