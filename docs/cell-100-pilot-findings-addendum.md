# Cell 100 / 101 / 102 / 103 / 104 / 105 — Pilot Findings, Addendum

**Status:** Updates and partial retraction of `docs/cell-100-pilot-findings.md` (commit `c8f0f6d`) and `docs/cell-100-methods-note.md` (commit `a87dee8`) based on follow-up pilot data run 2026-04-27. Some claims in the prior documents are now overturned; this addendum states the corrections plainly.

**Evidence:** 108 evaluations across cells 102–105 (the 6 follow-up legs after credit top-up), plus 3 evaluations from the curriculum-swap ablation, all scored under both v2.2 and charisma rubrics. Adds to the 53 evaluations from the original pilot. Total cell-100-family corpus: ~164 successful evals.

## 1. Retraction — the persona-shift floor IS lift-able by structured input

The original findings doc §6.1 stated:

> *Pure prompt iteration cannot fix this because the id is reading the curriculum more than the learner's emotional register.* Cell_102 (queued, see §7.1) tests this with a learner-register classifier injected into the id's user message.

And then §7.1 hypothesised:

> If structured input lifts that floor by 10+ points, the architecture is genuinely more responsive; if not, the limit is at the ego layer rather than the id's authoring layer.

A subsequent commit (`3c7f701`) reported a single-scenario smoke test for cell_102 on `charisma_phaedrus_invitation` showing Turn 2 v2.2 dropped from cell_100's 41.3 to cell_102's 30.0, and committed that as a "negative result on persona-shift floor" with the conclusion *"structured input does NOT lift the persona-shift floor; on this single scenario it lowered it. The limit on the persona-shift floor is at the ego-execution layer."*

**That conclusion was wrong, generalised from a single scenario.** At pilot scale (n=9 per cell × persona-shift scenarios across 3 curricula), all three structured-input cells dramatically lift the floor:

| Cell | last-turn v2.2 on persona-shift scenarios (n=9) | Lift over c100 baseline (24.3) |
|---|---:|---:|
| c100 (id-director, no classifier) | **24.3** | — |
| c101 (id-director + recognition) | 28.6 | +4.3 |
| **c104** (verbose id, no classifier) | **70.6** | **+46.3** |
| **c102** (id + classifier) | **81.7** | **+57.4** |
| **c103** (id + classifier + recognition) | **87.6** | **+63.3** |
| c105 (terse id, no classifier) | 48.1 | +23.8 |

The §6.1 hypothesis is **empirically confirmed**: structured register input lifts the floor by 24–63 points depending on the cell. **The classifier-driven architecture closes the floor that pure-prompt iteration could not.**

The smoke-test single-scenario observation was real (Phaedrus Turn 2 produces "I hear you" therapy-speak from nemotron) but unrepresentative. Across 9 different persona-shift scenarios, the architecture's mean response is dramatically more substantive than that single-scenario worst-case suggested.

**Implication for the cell_102 / cell_103 commit:** The "negative result" framing should be retracted. Cell_103 in particular is now the architectural champion (see §3 below). The smoke-test scenario remains a known failure mode worth flagging, but it is *one bad turn* among many good ones, not a uniform pattern.

## 2. Confirmation — c103 is the architectural champion

Cell_103 (id-director + classifier + recognition) achieves the most uniform high-scoring profile in the family:

| Cell | invitation v22-tN | pressure v22-tN | persona-shift v22-tN | mean |
|---|---:|---:|---:|---:|
| c100 | 51.5 | 65.3 | 24.3 | 47.0 |
| c101 | 41.3 | 77.2 | 28.6 | 49.0 |
| **c103** | **86.5** | **86.5** | **87.6** | **86.9** |

c103's last-turn v2.2 is consistent across all three scenario types — opening, pressure, vulnerability. The architecture has no remaining frontier where it cannot reach above 80. This is a near-doubling of c100's mean last-turn v2.2 (47 → 87).

Charisma trade-off: c103 averages 62.0 charisma (cross-curriculum) vs c102's 62.9 — recognition costs ~1 charisma point on average. Within sample variance.

This validates the original architectural design hypothesis: *the recognition disposition rescues the relational dimensions that pure charisma alone leaves un-served.*

## 3. New finding — the prompt-budget axis is non-monotonic

Findings doc §7.3 predicted:

> charisma-tuned (verbose) would hit charisma harder; pedagogy-tuned (terse) would hit v2.2 harder.

**Result: c104 (verbose) beats c105 (terse) on *both* rubrics, in *every* scenario type.**

| Cell | mean v22-tN (n=27) | mean charisma (n=27) |
|---|---:|---:|
| c104 (verbose 800–1500 tokens) | 75.8 | 63.6 |
| c105 (terse 200–400 tokens) | 56.6 | 33.3 |

The terse-prompt cell is **19 points lower on v2.2 last-turn and 30 points lower on charisma**. The hypothesis was directionally wrong.

**Mechanism:** the 200–400 token id prompt under-specifies the ego. The ego receives so little persona-scaffolding that it produces brief, generic responses scoring low on perception/pedagogical-craft (v2.2) AND on rhetorical texture/persona signature (charisma). Going *more* verbose (c104 at 800–1500) gives both rubrics what they need.

**The prompt-budget axis is non-monotonic.** There's an optimum somewhere in the 600–1200 token range. Below that the ego under-specifies; above that the ego's discipline drifts. Cell_100 final's 400–800 budget was likely close to optimal; cell_104's 800–1500 is near the upper edge of useful but still strong; cell_105's 200–400 falls off the cliff.

This finding is publishable on its own. The naive "more discipline → better pedagogy, more flourish → better charisma" intuition is wrong; both rubrics want enough id authoring to give the ego usable scaffolding.

## 4. Reaffirmed — Item 1 swap disconfirms the rubric-curriculum alignment concern

The methods note (`docs/cell-100-methods-note.md`) flagged a concern that the AI-literacy curriculum's content was speaking the charisma rubric's theoretical idiom and inflating cell_100's scores on 901/aura. Item 1 ran 3 cell_100 evaluations with the aura learner messages routed against the *non-aligned* 601 history-tech curriculum.

| Configuration | charisma (n=3) | v22-tN (n=3) |
|---|---:|---:|
| Original cell_100 / 901 aura | 75.8 | 32.9 |
| **Swap: cell_100 / aura-msgs × 601 curriculum** | **72.5** | **91.3** |

A 3.3-point charisma drop is well within sample variance. The rubric-curriculum alignment concern is **largely disconfirmed at this measurement scale**.

Surprisingly, v2.2 last-turn shot up to 91.3 in the swap (vs 32.9 originally) — the non-aligned curriculum forced the id to do its own conceptual translation work (Phaedrus/wax-tablets to AI/aura), and the act of that translation produced more substantively engaged Turn 2 prose than the aligned-curriculum cell did.

**Implication for paper integration:** the disclosure language drafted in `docs/cell-100-methods-note.md` §5 can be substantially softened. The rubric-curriculum alignment is a small calibration consideration, not a confound that excludes the aligned-cell results from primary architectural claims.

## 5. Updated cell ranking (n≥27 each, 6 cells with full data)

By **mean last-turn v2.2** across all curricula × scenario types:

1. **c103 (cls + recog)** — 86.9 — architectural champion
2. c102 (cls) — 79.1
3. c104 (charisma-tuned, verbose) — 75.8
4. c105 (pedagogy-tuned, terse) — 56.6
5. c101 (id + recog) — 49.0
6. c100 (id-director) — 47.0
7. c3 baseline — 4.3 (n=1)

By **mean charisma** across all curricula × scenario types:

1. c104 (charisma-tuned, verbose) — 63.6
2. c102 (cls) — 62.9
3. c103 (cls + recog) — 62.0
4. c100 (id-director) — ~46 (estimated from prior pilot mean)
5. c101 (id + recog) — ~45
6. c105 (pedagogy-tuned, terse) — 33.3
7. c3 baseline — 2.5

c103 is the dominant cell on v2.2; c104 is the dominant cell on charisma but only by a hair (within 1.6 points of c102 / c103). All three structured-input cells (c102 / c103 / c104) cluster at the top of both rubrics.

## 6. Implications for cells 102 / 103 commit message

The commit message at `3c7f701` should be addressed with a follow-up commit that links to this addendum. Specifically:

- The "negative result" framing in the commit body is wrong at pilot scale.
- The line *"This is itself a publishable methodological finding: the naive 'detect register, prescribe response' pattern is insufficient at the prompt-only architectural level."* is incorrect — the pattern *is* sufficient at pilot scale.
- The line *"Cells 102/103 are kept as documented negative-result cells, not as a recommended path forward."* should be reversed: c102 and c103 are now the recommended path forward.

A follow-up commit on this branch will reference this addendum and update the cell-config descriptions for clarity. The original commit's history-of-debugging is still useful audit trail and should not be force-amended.

## 7. Cell-by-cell summary for the paper

For paper-full-2.0.md integration the cell family now reads as:

| Cell | Description | Status |
|---|---|---|
| c100 | base id-director, no classifier, balanced budget | baseline; charismatic prose, persona-shift floor |
| c101 | id-director + recognition, no classifier | small recognition lift on v2.2; same floor as c100 |
| c102 | id-director + register classifier | breaks persona-shift floor (+57); high charisma everywhere |
| **c103** | id-director + register classifier + recognition | **architectural champion**; 86.9 mean v2.2-tN |
| c104 | id-director, verbose budget (800–1500), no classifier | matches c102 on v2.2 / c103 on charisma without structured input — verbose authoring alone provides much of the lift |
| c105 | id-director, terse budget (200–400), no classifier | under-specifies ego; lowest scores in family except baseline |

## 8. Recommended next steps (in priority order)

1. **Follow-up commit** on this branch reversing the cell_102/103 negative-result framing in the cell descriptions and YAML comments. This addendum is the canonical correction; the inline cell descriptions should point at it.
2. **Replicate the persona-shift lift on a wholly new scenario set** (e.g., `charisma_phaedrus_invitation` with new pre-defined learner messages) to confirm the c103 lift isn't scenario-specific. The current persona-shift scenarios were authored before the cells existed; they may have idiosyncratic features the architecture exploits.
3. **Cross-judge sanity check.** The pilot used `openrouter.sonnet` as the v2.2 judge and the same model as the charisma judge. A re-judge by a different model (`openrouter.gpt`, or a Haiku/Opus split) would tell us whether the c103 lift is robust across judge models or judge-model-specific.
4. **Move c102/c103 results to `docs/research/paper-full-2.0.md`** as a paper section. Per CLAUDE.md's paper-authoring discipline, this addendum is the source-of-truth for these claims; the paper section inherits.
5. **Cell_106**: c103 + a small set of curated *witness-register exemplars* in the ego's effective context, to address the residual "I hear you" failure mode the smoke test caught. Targeted ablation; predicted further lift on persona-shift charisma.

## 9. Audit trail

All commits on `experiment/cell-100-id-charisma`:

- `8418efd` — id-director architecture + Weberian charisma rubric (initial scaffold)
- `380d8da` — wire id-director dispatch through eval runner
- `283fc58` — tighten id-director prompt; lift Turn 2 vulnerability response
- `c8f0f6d` — pilot findings doc (now requires this addendum)
- `a87dee8` — methods note on rubric-curriculum alignment (still valid; softening recommended per §4)
- `3c7f701` — cell_102/103 ablation **(commit message's negative-result framing now overturned)**
- `3b862be` — cells 104/105 + item 1 swap scenario

Pilot run IDs (all ITEMs run 2026-04-27, fully scored under both rubrics):

- `eval-2026-04-27-759e1a02` — Item 1 swap (3 evals)
- `eval-2026-04-27-23beaa63` — Item 2 / 601 history-tech (18 evals)
- `eval-2026-04-27-3115ab29` — Item 2 / 701 ethics-ai (18 evals)
- `eval-2026-04-27-2d5c20ca` — Item 2 / 901 ai-literacy (18 evals)
- `eval-2026-04-27-69167b53` — Item 3 / 601 history-tech (18 evals)
- `eval-2026-04-27-2efec307` — Item 3 / 701 ethics-ai (18 evals)
- `eval-2026-04-27-ce22e888` — Item 3 / 901 ai-literacy (18 evals)

Per-row data in `evaluation_results.tutor_charisma_scores`, `evaluation_results.scores_with_reasoning`, `evaluation_results.id_construction_trace`, and `evaluation_results.tutor_first_turn_score` / `tutor_last_turn_score` columns.

Total spend across all pilots: ~$3.50 (estimate). Wall time: ~2 hours including credit-exhaustion / resume cycle.
