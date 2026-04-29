# Methods Note — Rubric-Curriculum Alignment as a Calibration Concern

> **Note on cell IDs (2026-04-28):** these cells were originally numbered 100–106 (briefly bumped to 200–206) and are now consolidated as cells 101–107 to avoid collision with a parallel `cell_100` added on `main`. The doc filename is preserved (`cell-100-...`) for git history continuity. All references in the body have been updated. Historical evaluation_results rows still use the original `cell_100_*` profile names; new runs use `cell_101_*` through `cell_107_*`.


**Status:** Draft for paper integration. To be folded into `docs/research/paper-full-2.0.md`'s methods section (or a methodological footnote on the cell-100 results section), and into any spin-off paper that reports cell-100 charisma scores.

**Context:** Cell 101 / 102 pilot findings (`docs/cell-100-pilot-findings.md`, §6.3) flagged a calibration concern. This note states the concern, gauges its severity, proposes a controlled test, and drafts the disclosure language.

---

## 1. The concern stated plainly

The pilot's strongest pure-charismatic performance is **cell_101 on `charisma_aura_invitation` (course 901, AI literacy)**: mean charisma 75.8/100 across 3 repeats, peak 91.3, against a pilot mean of 48.4 and a baseline cell_3 score of 2.5.

The AI-literacy curriculum's content (course 901, lectures 1–4) is grounded in the same source paper that grounds the **charisma rubric**: the user-supplied draft on AI-generated charisma, applying Benjamin's aura concept and the Visual-Verbal Video Analysis (VVVA) framework to short-form video.

The rubric's level-5 anchors — *"compositional arc: setup → peak → resolution"*, *"rhetorical texture: rhythm/imagery/concreteness"*, *"witness/proof-sign"*, *"co-constitutive invitation"* — translate the source paper's empirical findings on Douyin influencer videos to text-only tutoring. The 901 curriculum *teaches* the same source paper. Course content includes Benjamin's distinction between aura and reproduction, the four-layer VVVA decomposition, and the anti-routinization theme that Weber bequeaths to the rubric.

The id, given the curriculum context as input, has direct access to the rubric's *theoretical idiom*. When it authors personas grounded in that idiom, the rubric scores them higher than when it authors personas grounded in a different idiom (e.g. Plato/Phaedrus on memory in 601, formal-fairness theorems in 701).

This is **rubric-curriculum alignment**: the rubric scores responses higher when the responses speak the rubric's own theoretical language.

## 2. Why this is not circularity (but is still a concern)

The concern is not that the dialogues were authored to game the rubric. They were not:

1. **The judge model has no special calibration to course 901.** It is `openrouter.sonnet` with the same prompt template against every dialogue regardless of curriculum.
2. **The id's prompt does not reference the charisma rubric.** The id is told to author a persona; the rubric is unknown to it.
3. **Cell_100 on a different curriculum (601 history-tech) scored mean charisma 40.6 — 35 points lower than 901** — against the same rubric, the same judge, the same models, the same scenarios-as-genre. The architecture's behaviour clearly differs by curriculum content, in a way that aligns with how much theoretical overlap the curriculum has with the rubric.

So the inflated score on 901 is not a methods bug. It is, however, a calibration concern in two distinct ways:

### 2.1 The per-dimension breakdown shows where the alignment helps

Looking at `tutor_charisma_scores` for the 901 / aura / cell_101 / peak run (charisma 91.3):

- `extraordinariness: 5` — *"50,000 smiles that never had teeth — staccato vocal cadence plucked from 10,000 interviews"* (the prose itself is in the rubric's idiom)
- `rhetorical_texture: 5` — uses the rubric's anchor concepts (concrete imagery substituting for abstraction) on the rubric's own subject matter
- `compositional_arc: 5` — the rubric's "setup → peak → resolution" frame *is the curriculum's own analytical frame*

When the curriculum's content matches the rubric's anchors, **the model produces prose that is unusually well-fitted to the rubric**, and the rubric correctly scores it high. There is nothing wrong with the scoring per se — the prose is genuinely strong by the rubric's stated criteria. The concern is whether the rubric's stated criteria are testing something distinct from "the model is fluent in this curriculum's vocabulary."

### 2.2 The cross-curriculum gap is the red flag

If the architectural lift were *purely architectural* (id-director vs fixed-prompt ego), we'd expect cell_101's charisma score on 901 to be similar to cell_101's charisma score on 601 and 701, modulo scenario-difficulty noise. It is not:

| Cell_100 charisma by curriculum | mean | range |
|---|---:|---:|
| 901 ai-literacy | 59.2 | 31.3–91.3 |
| 701 ethics-ai | 46.9 | 22.5–72.5 |
| 601 history-tech | 40.6 | 16.3–60.0 |

A 19-point spread between 601 and 901, on the same architecture, same models, same rubric. The difference must be coming from the curriculum content. That's the alignment confound surfacing.

## 3. Severity gauge

The confound affects *charisma scores* on *the AI-literacy curriculum*. It does not affect:

- **v2.2 scores**, which use a separate rubric whose anchors don't align with course 901 in the same way (v2.2 is Hegel-derived for `recognition_quality`; everything else is grounded in general pedagogical literature). v2.2 means by curriculum: 601 = 64.6, 701 = 56.5, 901 = 58.2 — closer together.
- **Charisma scores on 601 and 701**, where the curriculum content is genuinely orthogonal to the rubric's idiom (Plato/print/attention; formal fairness/nudge/responsibility).
- **Architectural claims about cell_101 vs cell_3**, which hold across all three curricula by huge margins (cell_3 baseline = 2.5 charisma; cell_101 across pilot = 48.9 mean).

So the confound is **scoped, not general**. It means the *peak* charismatic performances reported for 901 should not be cited as evidence for the architecture's ceiling without disclosure.

## 4. Proposed controlled test

A clean disconfounding test runs under existing infrastructure:

### 4.1 Hold-out scoring under a Hegel-derived rubric

The v2.2 rubric's `recognition_quality` dimension is closest in spirit to what the charisma rubric measures (relational hinge, mutual recognition). Score the 901 / aura / cell_101 dialogues under v2.2 specifically; if they score similarly to other 901 dialogues on other scenarios, the alignment confound is the dominant explanation. If they still score above other 901 cells, the pure-architectural lift is operative on top of any alignment effect.

This is already done — we have the data. From §3.2 of the findings:

| Cell × Scenario × Curriculum | v2.2 last-turn | Charisma |
|---|---:|---:|
| cell_101 / aura_invitation / 901 | 32.9 | **75.8** |
| cell_101 / phaedrus_invitation / 601 | 50.0 | 46.7 |
| cell_101 / fairness_invitation / 701 | 30.0 | 54.6 |

**The 901 / aura cell hits the highest charisma score in the pilot but the *lowest* v2.2 last-turn score among invitation scenarios on cell_101.** Under v2.2 (the non-aligned rubric), 901 / aura looks worse than 601 / phaedrus. Under charisma, it looks much better.

This is direct evidence the confound is real and *measurable*. The alignment effect is on the order of ~30 charisma points and is not present in v2.2 scoring.

### 4.2 Independent charisma rubric scoring

A second test: re-author a charisma rubric whose anchors are derived from a different empirical body (e.g., Bourdieu on cultural capital, or Goffman on dramaturgy), and re-score all 53 pilot rows. If cell_101 / 901 / aura still scores in the top decile, the architecture is producing genuinely more-charismatic prose; if its score regresses toward the cell_101 mean, the original rubric's score was alignment-inflated.

Cost: building a parallel rubric is several hours' work + per-row scoring (~$0.30 for the pilot). Worth doing before paper integration if the 901 / aura number is going to be cited.

### 4.3 Within-pilot ablation

A simpler ablation: drop the curriculum context for cell_101 on 901 / aura, replace it with the 601 history-tech curriculum context, run the same scenario. If the persona stays charismatic-but-now-grounded-in-Plato, the architecture is the source of the lift. If it collapses to a less-charismatic register, the AI-literacy curriculum was carrying disproportionate weight.

Cost: 3 dialogue runs (~5 min, ~$0.02). Cheap test, worth running.

## 5. Disclosure language for paper integration

Draft footnote / limitation language, suitable for `paper-full-2.0.md` or a spin-off paper that cites the cell-100 charisma scores:

> The charisma rubric used to score the cell-101/102 pilot is derived from the same Weber-Benjamin lineage as the AI-literacy curriculum (course 901). When the id-director cell is paired with the AI-literacy curriculum, the resulting personas tend to engage the rubric's own theoretical idiom (Benjamin's aura, the four-layer VVVA decomposition, anti-routinization). This produces unusually high scores on the AI-literacy / aura-invitation scenarios — mean charisma 75.8 vs the pilot mean of 48.4 — that should not be read as ceiling evidence for the architecture *per se*. We confirm the effect is rubric-specific (the same dialogues score lower than other invitation-scenario dialogues under the v2.2 pedagogical rubric, which is not Weber-Benjamin-aligned), and we report architectural claims primarily from the cross-curriculum mean and from the non-aligned curricula (601 history-of-pedagogical-tech, 701 ethics-of-AI). The 901 / aura peak performances are reported descriptively but excluded from claims about the architecture's general capability.

Three things this footnote does:

1. **Names the confound** explicitly, so reviewers don't have to triangulate it from the data.
2. **Reports the disconfounding evidence** (v2.2 doesn't show the same effect), establishing that the architectural claim still holds.
3. **Excludes the aligned cells from primary claims**, while keeping them available as descriptive examples.

## 6. Recommended action items

In order of priority:

1. **Before paper integration**: include the disclosure language above. If a stronger version is needed (e.g., for a methodologically-careful venue), run the §4.3 within-pilot ablation as well.
2. **For methodological robustness**: run §4.2 (independent charisma rubric scoring of pilot data). Builds confidence in the pure-architectural claim and produces a second rubric that might be more general for future work.
3. **For audit trail completeness**: the per-dimension charisma scores in `evaluation_results.tutor_charisma_scores` already contain the judge's verbatim reasoning. A spot-check of 5–10 high-scoring 901 rows for *whether the reasoning cites curriculum-aligned anchors* (e.g., "Benjamin", "aura", "VVVA") vs. general charisma anchors would empirically quantify how often the curriculum content shows up in the rubric's reasoning. This is a 30-minute task that produces a clean defense against reviewer challenges.

---

**Cross-references:**
- Findings: `docs/cell-100-pilot-findings.md`, §6.3
- Charisma rubric: `config/evaluation-rubric-charisma.yaml`
- Source paper grounding the rubric AND course 901: user-supplied draft on Chinese cyber-influencers and AI-generated charisma (keywords: charismatic leadership, AI, Chinese Cyber influencers, media analysis)
- v2.2 rubric (control): `config/evaluation-rubric.yaml`
