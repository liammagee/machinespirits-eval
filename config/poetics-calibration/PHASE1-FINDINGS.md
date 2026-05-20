# Phase-1 findings — structural anti-simulation gate (rupture × recontextualization)

**Status:** SEPARATE PATH (not yet in `docs/research/paper-full-2.0.md`). Per the
2026-05-20 decision, the Phase-1 discussion, numbers and design live here until
they are folded into the main paper or a derivative. Nothing in this document is a
paper claim yet.

**Arc:** `DRAMATIC-RECOGNITION-PLAN.md` §5.1–5.2, §76 (the Phase-1 quadrant gate),
§78 (no silent softening), §83 (phasing).
**Design seed / pre-registration:** `PHASE1-DESIGN.md` (written before any Phase-1
draw — the construct is pinned in advance).
**Predecessor:** `PHASE0-FINDINGS.md` (instrument gate — PASSED both critics).
**Axes (defined inline in the scorer, not a YAML rubric):** recontextualization
(primary, gating), rupture (corroborating), global coherence (reported,
non-separating). See `PHASE1-DESIGN.md` §3.
**Pre-registration:** `config/poetics-calibration/key.yaml` (`gate_phase1:` block +
held-out `reversal_turn` / `affect_decoy_turn` per item).
**Scorer:** `scripts/score-poetics-phase1.js`.
**Comparison:** `scripts/compare-poetics-critics.js`.
**Artifacts:** `exports/poetics-phase1-{codex,gpt,claude-code}.json` (gitignored,
local provenance — the per-item numbers are embedded in §3 below).

---

## 1. What Phase 1 is for

Phase 0 proved the *rubric* can rank-order known recognition over known flat. Phase
1 adds the **structural anti-simulation mechanism**: a measure that says *why* a
trap is flat — its "reversal" produces no structural reversal — on two
foreknowledge-invariant axes, without leaning on a critic's holistic read.

The load-bearing construct decision (`PHASE1-DESIGN.md` §2) is that **dramatic
surprise ≠ informational surprise**. "Surprising yet inevitable" is re-decomposed
into two structural properties:

- **rupture** (the pivot departs from the naive forward trajectory the prior turns
  set up) — *corroborating*;
- **recontextualization** (the pivot re-semanticizes the *earlier* turns) —
  **primary, and the gating axis**, because it survives the model recognising the
  canon (knowing Oedipus does not change whether the herdsman's revelation flips
  the meaning of his prior investigation; it does).

### Blinding + generator ≠ critic

The critic sees only the neutral `corpus/*.txt` (speakers relabelled `A:/B:/C:/D:`,
source/pole stripped). Ground truth in `key.yaml` (pole, `reversal_turn`,
`affect_decoy_turn`) is joined **only after** scoring. The two trap items (S1/S2)
are Claude-authored, so the clean (non-Claude) critics carry the verdict:

- **codex** (current OpenAI model via the codex CLI) — **primary clean critic**,
  supersedes the now-stale `openai/gpt-5.2`;
- **gpt-5.2** (OpenRouter) — second clean critic, retained for cross-model
  robustness (older model, not the freshest);
- **claude-code** (Max-plan CLI bridge) — adversarial **same-family cross-check**.
  claude-code scoring the Claude-authored traps at the recon floor (0) is the
  *non-flattering* direction, so the shared-author concern does not bite the
  verdict — it strengthens it.

Three critics across three model families. The evidence-gate guard (`§3.1`) is
enforced on every axis scored > 3: a verbatim quote must be present, and for
recontextualization the quote must lie in the **pre-reversal portion only**
(the foreknowledge-invariant core), else the score is clamped to ≤ 3.

---

## 2. The pre-registered gate (`key.yaml` `gate_phase1:`)

| Criterion | Pre-registered threshold |
|---|---|
| `perfect_separation` | every high item's recon > every flat item's recon (`min(high) > max(flat)`) |
| `min_recon_margin` | `mean(high) − mean(flat) ≥ 30` on the 0–100 scale |
| `trap_ceiling` (REQUIRED, gating) | `max(trap recon) < min(high recon)` — traps never reach the recognition band |

Corroboration (reported, **non-gating**): rupture should separate high > trap;
global coherence is expected **not** to separate (traps stay fluent). The §76
quadrant (rupture × coherence) is reported alongside.

**No re-specification.** Unlike Phase 0's trap ceiling (which failed literally and
was transparently re-specified), the Phase-1 `gate_phase1` thresholds were pinned
in `key.yaml` before any draw and applied **unchanged** across all three critics.
Per plan line 78, the gate is the disconfirmation channel; it was not softened
mid-arc.

---

## 3. Per-item results — recontextualization (primary axis), raw 1–5 / 0–100

| id | pole | claude-code | codex | gpt-5.2 |
|----|------|------------:|------:|--------:|
| H1 | high | 4 / 75  | 4 / 75  | 5 / 100 |
| H2 | high | 5 / 100 | 5 / 100 | 5 / 100 |
| H3 | high | 4 / 75  | 4 / 75  | 4 / 75  |
| H4 | high | **2 / 25** | 4 / 75 | 4 / 75 |
| H5 | high | 5 / 100 | 5 / 100 | 5 / 100 |
| F1 | flat | 1 / 0 | 1 / 0 | 1 / 0 |
| F2 | flat | 1 / 0 | 1 / 0 | 1 / 0 |
| F3 | flat | 1 / 0 | 1 / 0 | 1 / 0 |
| F4 | flat | 1 / 0 | 1 / 0 | 1 / 0 |
| F5 | flat | 1 / 0 | 1 / 0 | 1 / 0 |
| S1 | trap | 1 / 0 | 1 / 0 | **2 / 25** |
| S2 | trap | 1 / 0 | 1 / 0 | **2 / 25** |

**Boundary statistics (recon, primary axis):**

| | claude-code | codex | gpt-5.2 |
|---|---:|---:|---:|
| mean(high) | 75.0 | 85.0 | 90.0 |
| mean(flat) | 0 | 0 | 0 |
| mean(trap) | 0 | 0 | 25.0 |
| min(high) | **25.0 (H4)** | 75.0 | 75.0 |
| max(flat) | 0 | 0 | 0 |
| max(trap) | 0 | 0 | 25.0 |
| **trap → high gap** (min(high) − max(trap)) | **25.0** | **75.0** | **50.0** |

---

## 4. Gate verdict — PASS, triple-validated

| Criterion | claude-code | codex | gpt-5.2 |
|---|---|---|---|
| perfect separation `min(high) > max(flat)` | PASS (25 > 0) | PASS (75 > 0) | PASS (75 > 0) |
| recon margin ≥ 30 | PASS (75) | PASS (85) | PASS (90) |
| REQUIRED `max(trap) < min(high)` | PASS (0 < 25) | PASS (0 < 75) | PASS (25 < 75) |

**All three critics PASS the pre-registered gate.** Two clean non-Claude critics
(codex, gpt-5.2) and the adversarial same-family critic (claude-code) all place
genuine recognition above flat/trap on the foreknowledge-invariant primary axis,
and all keep both Claude-authored traps out of the recognition band.

---

## 5. The design vindication — rupture (corroborating) is unreliable; recontextualization (primary) holds

This is the central empirical payoff. `PHASE1-DESIGN.md` §2 bets that the
corroborating **rupture** axis is foolable (a fluent trap can depart from its own
setup rhetorically) and that the **recontextualization** axis is the robust
discriminator — which is why the gate fires on recon and only *reports* rupture.
Across three critics the rupture axis broke **three different ways**, and the gate
held every time:

| | rupture (raw / 100) | quadrant (§76, rupture × coherence) | recon (gating) |
|---|---|---|---|
| **gpt-5.2** over-credits trap **S1** | S1 = 4 / 75 | S1 → *surprising × coherent* (the **genuine** cell — mis-filed trap) | S1 recon = 25 < min(high) 75 → **gate holds** |
| **claude-code** under-credits genuine **H4** | H4 = 2 / 25 | H4 → *unsurprising × coherent* (the **flat** cell — mis-filed genuine) | H4 recon = 25 > max(trap) 0 → **gate holds** |
| **claude-code** rupture separation **fails** | min(high rupt) 25 (H4) ties max(trap rupt) 25 (S2) | — | recon: H4 25 > S2 0 → **gate holds** |
| **codex** | rupture clean (separates) | all items filed correctly | clean |

The foolable axis got fooled — in **opposite directions** (gpt inflated a trap's
rupture; claude-code deflated a genuine item's rupture) — and the instrument did
not care, because it was not gating on rupture. This is the strongest available
evidence that the §2 construct decision is correct: **gate on recontextualization,
report rupture.** The strongest single data point: even claude-code, kin to the
trap's author, scored both traps at recon = 0.

---

## 6. Inter-critic agreement (primary axis)

Computed by `scripts/compare-poetics-critics.js`:

| pair | quadratic-weighted κ | exact raw match | mean \|Δ100\| | within-high-band ρ |
|---|---:|---:|---:|---:|
| claude-code × codex | 0.94 | 11/12 | 4.2 | 0.91 |
| codex × gpt-5.2 | 0.96 | 9/12 | 6.3 | 0.67 |
| claude-code × gpt-5.2 | 0.90 | 8/12 | 10.4 | 0.76 |

All pairwise κ ≥ 0.90 on the gating axis — strong ordinal agreement.

- The all-12 Spearman ρ (~0.91–0.99) is **inflated** by the bimodal pole separation
  (high band vs zero band) — it mostly measures "both critics separate the poles."
  The discriminating measure is the within-high-band ρ and the exact-match rate.
- The within-band ρ values are driven by single one-notch differences under 5-point
  ties (e.g. codex × gpt's 0.67 is entirely H1: gpt 100 vs codex 75), not real
  ranking disagreement.
- **Coherence κ is degenerate** (negative / near-zero across pairs): both critics
  rate ≈everything coherent ({5:10–11, …} of 12), so the skewed marginal makes κ
  uninformative (the kappa paradox). Read coherence agreement off exact-match
  (6–9/12). The near-constancy *is* the prediction — coherence is the
  non-separating axis.

### The one genuine soft spot — H4 (Theaetetus)

H4 is the weakest "high" item for all three critics and drops to recon = 25 under
claude-code (vs 75 from codex/gpt). The gate still passes (25 > 0), but H4 is the
corpus's marginal peripeteia — the item most at risk of falling toward the flat
band under a stricter critic. Open question (§8): is H4 a genuinely soft reversal
(the definition merely *collapses* rather than re-semanticizing the prior turns),
or a thin annotation? Worth a look before any paper use.

---

## 7. Reversal localization (held-out, NON-GATING)

Localization uses option (a) *scan-and-self-identify* (`PHASE1-DESIGN.md` §4a). It
is weak and critic-dependent — as expected for (a):

| id | truth | claude-code | codex | gpt-5.2 |
|----|------:|------------:|------:|--------:|
| H1 | 61 | **61** ✓ | **61** ✓ | **61** ✓ |
| H2 | 55 | **55** ✓ | 54 | 19 |
| H3 | 3  | 10 | 10 | 10 |
| H4 | 8  | 12 | 12 | **8** ✓ |
| H5 | 32 | 11 | 10 | 11 |

Pairwise critic agreement on the high items is 2–3/5; all three miss H3/H5.
claude-code localizes best (H1 + H2 exact). This is concrete motivation for
option (b) **max-split** (§4b — evaluate recon at every turn-split, take the peak)
if localization is ever to be trusted; it is not built (anti-creep), and it does
not gate anything.

**Anti-simulation catch (notable):** claude-code picked S2's *affect decoy* turn
(7) as the apparent reversal — but scored recontextualization there at 0
(`reconLow = true`). It found *where* the trap pretends to turn and correctly
credited it with no recohering. The mechanism caught a trap mid-pretence.

---

## 8. Verdict

**Phase-1 gate: PASS, triple-validated** (codex, gpt-5.2, claude-code), on the
pre-registered `gate_phase1` criteria, applied unchanged across all critics.

- Perfect separation: PASS ×3.
- Recon margin ≥ 30: PASS ×3 (75 / 85 / 90).
- Required trap ceiling `max(trap) < min(high)`: PASS ×3.
- Design vindicated: the corroborating rupture axis is foolable (and was fooled,
  three ways); the primary recontextualization axis is robust and holds the gate.

The structural anti-simulation measure earns its keep: it separates genuine
recognition from flat exposition *and* from recognition-vocabulary-without-rupture
(the traps), on a foreknowledge-invariant axis, agreed across three model families.

---

## 9. Open / deferred items

- **H4 marginality:** weakest genuine item; recon 25 under claude-code. Decide
  whether it is a soft peripeteia or a thin annotation before paper use.
- **§4b max-split localization:** the preferred localizer; would replace the weak,
  critic-dependent §4a self-identify. Not built (non-gating + anti-creep).
- **gpt-5.2 staleness:** retained as a second clean critic, but codex (current
  model) is now primary. Re-draws should prefer codex + claude-code.
- **Inherited Phase-0 deferrals:** F4 provenance re-verification; the Euripides
  *Iphigenia* vs Shakespeare 5th-high-slot review (thematic-sadness confound).
- **Folding into the paper:** when this graduates from the separate path, the
  empirical claims move into `docs/research/paper-full-2.0.md` first (single-paper
  discipline); any spin-off inherits from there.

---

## 10. Pointers

- Plan: `DRAMATIC-RECOGNITION-PLAN.md` (§5.1–5.2, §76, §78, §83).
- Design seed / pre-registration: `PHASE1-DESIGN.md`; `key.yaml` (`gate_phase1:`).
- Scorer: `scripts/score-poetics-phase1.js`
  (`buildPhase1Prompt`, `applyPhase1Gates`, `evaluateGate`, `quadrant`,
  `localization`).
- Comparison: `scripts/compare-poetics-critics.js`.
- Shared plumbing (critic calls): `scripts/score-poetics-calibration.js`
  (`callModel` → `callCodex` / `callClaudeCode` / `callOpenRouter`; `MODEL_MAP`).
- Artifacts: `exports/poetics-phase1-{codex,gpt,claude-code}.json` (gitignored).
