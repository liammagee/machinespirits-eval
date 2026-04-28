# Cell 200 / 201 — Id-Director Pilot Findings

> **Note on cell IDs (2026-04-28):** these cells were originally numbered 100–106 but have been bumped by +100 to cells 200–206 to avoid collision with a parallel `cell_100` added on `main`. The doc filename is preserved (`cell-100-...`) for git history continuity. All references in the body have been updated. Historical evaluation_results rows still use the original `cell_100_*` profile names; new runs use `cell_200_*`.


**Branch:** `experiment/cell-100-id-charisma`
**Pilot wall time:** ~50 min (53 evaluations × 3 LLM calls + 53 v2.2 scoring + 53 charisma scoring)
**Total spend:** ~$0.50
**Date:** 2026-04-26
**Status:** First-pass empirical results. Subject to revision pending replication and additional curricula. Not yet a paper claim — see `docs/cell-100-methods-note.md` for confounds to address before paper integration.

## 1. Design recap

Cell 200 inverts the existing dialectical multi-agent topology. Where cells 3–4, 7–8, 22–33, 82–83, 86–89, 99 use *durable ego + transient superego critic*, cell 200 uses **transient ego + durable id author**. Each turn a back-stage "id" agent reads the dialogue history and authors the ego's complete system prompt from scratch; the ego is instantiated for that turn only against the just-authored prompt, produces the learner-visible message, and is discarded.

Cell 201 adds `recognition_mode: true`, which threads a Hegelian-recognition disposition into the id's prompt-authoring instructions. The ego and id remain otherwise identical.

The architectural test: can a tutor that re-authors its own persona every turn sustain charismatic pedagogy in Weber's sense — *anti-routinizing*, with each encounter feeling like its own occasion — in a way that a fixed-prompt tutor structurally cannot?

Cells 200 and 201 are scored under two rubrics in parallel:

- **Tutor v2.2** (existing 8-dimension pedagogical-quality rubric)
- **Charisma v1.0** (new 8-dimension rubric derived from Weber's *Wirtschaft und Gesellschaft* §III + the user-supplied draft on Chinese cyber-influencers and AI-generated charisma; see `config/evaluation-rubric-charisma.yaml` for the 8 dimensions, anchors, and theoretical lineage)

The pilot ran both cells against three curricula × three scenarios × three repeats = 54 dialogues, all scored under both rubrics.

## 2. Pilot configuration

| | |
|---|---|
| Cells | `cell_200_id_director_charisma` (base), `cell_201_recog_id_director_charisma` (recognition) |
| Curricula | 601 *Tools That Teach Us* (history of pedagogical tech), 701 *Ethics of AI Systems*, 901 *AI Literacy* |
| Scenarios per curriculum | 3 charisma-probing 3-turn arcs: pure invitation, pressure test, persona-shift trigger |
| Repeats | 3 per (cell × curriculum × scenario) cell |
| Total planned | 54 |
| Total successful | 53 (one row failed with `Unexpected end of JSON input` from the id agent — 98% success rate) |
| Models | Ego: `openrouter.nemotron`. Id (re-uses superego slot): `openrouter.kimi-k2.5`. Both rubrics: `openrouter.sonnet` judge. |

## 3. Headline results

### 3.1 Aggregate scores

| Curriculum | n | Turn 0 v2.2 | Last-turn v2.2 | Charisma |
|---|---:|---:|---:|---:|
| 601 history-tech | 18 | 77.0 | 54.3 | 43.5 |
| 701 ethics-ai | 17 | 76.5 | 38.7 | 49.2 |
| 901 ai-literacy | 18 | 78.1 | 43.7 | 52.6 |
| **Pilot mean** | **53** | **77.2** | **45.6** | **48.4** |
| Smoke baseline (cell_3) | 1 | 37.5 | 0.0 | 2.5 |

**Lift over baseline:** Turn 0 v2.2 +39.7, last-turn v2.2 +45.6, charisma +45.9. The single-scenario smoke result (cell_200 charisma 51.2 vs cell_3 charisma 2.5) holds under pilot conditions.

### 3.2 Cell × curriculum cross-tab

| Curriculum | Cell | Turn 0 v2.2 | Last-turn v2.2 | Charisma |
|---|---|---:|---:|---:|
| 601 | cell_200 | 80.6 | 48.5 | 40.6 |
| 601 | cell_201 | 73.5 | **60.0** | 46.4 |
| 701 | cell_200 | 74.2 | 36.3 | 46.9 |
| 701 | cell_201 | 78.8 | 41.0 | 51.3 |
| 901 | cell_200 | 77.2 | 39.3 | **59.2** |
| 901 | cell_201 | 78.9 | 48.2 | 46.0 |

**Cell_101 wins last-turn v2.2 in every curriculum** (mean +7.6 over cell_200). The recognition disposition does the work the design predicted: when learners shift to vulnerable, sceptical, or operational registers, the recognition-bearing id authors a more responsive ego.

**Cell_100 wins last-turn charisma in 1 of 3 curricula** (901 ai-literacy) but with the highest individual peak: mean 59.2, max 91.3. The AI-literacy curriculum (the source paper's home territory) gives the pure-charisma cell the most domain to flex in. See §6.3 below for the methods caveat this raises.

### 3.3 Per-scenario type — the persona-shift floor

Scenarios were authored to probe three distinct registers; mean last-turn v2.2 across all curricula and cells, by scenario type:

| Scenario type | Mean last-turn v2.2 | Mean charisma |
|---|---:|---:|
| pressure (sceptical pushback) | **70.4** | 51.6 |
| invitation (open question) | 40.4 | 56.6 |
| persona-shift (vulnerability disclosure) | **26.5** | 33.3 |

**Persona-shift is uniformly hardest, in every curriculum, for both cells.** This is the architecture's frontier. It is not a bug — it is a finding the rubric was designed to surface.

Specifically, the architecture's strengths and limits are now empirically documented:

- The id-director **opens strongly** (Turn 0 averages 77.2 across the pilot — substantially above the v2.2 baseline of 37.5).
- It **defends well under pressure** (sceptical-pushback scenarios mean 70.4 last-turn).
- It **systematically underperforms on vulnerability disclosure** (persona-shift scenarios mean 26.5 last-turn — only ~9 points above absolute baseline cell_3).

## 4. Mechanism findings

### 4.1 Recognition rescues the relational dimensions

The pre-pilot smoke comparison (cell_200 vs cell_201 on `charisma_phaedrus_invitation`) showed cell_201 *underperforming* cell_200 on the vulnerability turn (Turn 2 = 23.7 vs 41.3 v2.2). Inspection of the dialogue logs revealed why: the recognition-mode branch in the id's prompt collapsed persona variation, repeating "fellow-traveller" as the archetype across all three turns.

A targeted prompt iteration (commit `283fc58`) added the directive *"Recognition is a disposition, not a persona"* and four register-shift signatures with corresponding persona responses. The pilot validated this fix at scale: cell_201 wins last-turn v2.2 in 3 of 3 curricula, and the recognition-charisma cell now produces visibly varied personas across turns (audit via `id_construction_trace` column in `evaluation_results`).

The recognition disposition's contribution is **specifically relational** — it lifts last-turn v2.2 (where the vulnerability turn lives) but not opening-turn v2.2 (where both cells are already strong). This is the design hypothesis confirmed: charisma alone hits ceiling on rhetoric and floor on vulnerability; charisma + recognition trades a few rhetorical points for substantial relational lift.

### 4.2 The prompt-budget axis trades charisma against pedagogical engagement

A second prompt iteration (same commit) tightened the id's `generated_prompt` length budget from 600–1200 tokens to 400–800 tokens, and required every generated_prompt to specify a single observable "this turn" move rather than a free-form persona description. Cell_100 results (single-scenario smoke):

| Cell_100 variant | Last-turn v2.2 | Charisma |
|---|---:|---:|
| Verbose prompts (pre-iteration) | 41.3 | 51.2 |
| Tightened prompts (post-iteration) | **68.8** | 46.2 |

Tightening lifted v2.2 last-turn by **+27.5** points (the targeted improvement) at a cost of **−5** charisma points. This is not a free trade. The two rubrics have orthogonal preferences at the prompt-budget margin:

- **Verbose id prompts** → richer rhetorical luxury, varied imagery, image-led persona descriptions → favoured by the charisma rubric (which rewards rhetorical_texture, extraordinariness, compositional_arc).
- **Tight id prompts with explicit "this turn" moves** → more disciplined ego output, more substantive engagement with the learner's actual question → favoured by v2.2 (which rewards perception_quality, pedagogical_craft, recognition_quality).

This is a meaningful axis for future cells: a charisma-tuned-id variant and a pedagogy-tuned-id variant are now identifiable as distinct points in prompt-design space. See §7 for queued ablations.

### 4.3 The id authors / the ego executes — and the layers can decouple

A subtle finding from manual inspection of the dialogue logs: when the id is given the register-tracking directive, it *names* register-aware persona shifts in its `persona_delta` field (e.g., Turn 2 *"philosophical ironist, conspiratorial urgency, fellow-prisoner stance"*). But the ego, given a verbose persona prompt, sometimes **doesn't carry that named register through**. The persona names a relational stance; the ego produces curriculum-grounded prose anyway.

The tightened-prompt iteration partially fixed this by giving the ego less room to drift. But the underlying decoupling — id describes vs ego enacts — is the cleanest target for the next architectural variant. See §7.2.

## 5. Standout individual runs

- **cell_201 / 601 / charisma_print_pressure**: last-turn v2.2 = 92.9 (n=3). Pilot peak. The pressure scenario (engineering-background learner challenges the print-revolution claim as sentimental humanistic argumentation) plays exactly to the recognition-disposition's strengths: defend the lecture's claim under sceptical pushback while honouring the learner's autonomous critique.
- **cell_200 / 901 / charisma_aura_invitation**: charisma = 75.8 (n=3) with one run hitting **91.3**. Near-ceiling charismatic performance. The Benjamin-aura material lets the id author personas in the source paper's own theoretical register. Caveat: this is the methodologically-vulnerable case; see §6.3.
- **All cells / persona-shift scenarios across all curricula**: last-turn v2.2 range 19.2–30.4. The vulnerability turn is the architecture's frontier, not curriculum-specific.

## 6. Open questions

### 6.1 Persona-shift floor is structural, not prompt-fixable

Both cells, both rubrics, all three curricula, all three persona-shift scenarios produced last-turn v2.2 scores in the 20–35 range. Three rounds of prompt iteration on the id's directives (register-tracking, recognition-as-disposition, length-budget + explicit-move) lifted Turn 0 and Turn 1 substantially but did not move the persona-shift floor.

**Hypothesis:** the id is reading the *curriculum* more than the *learner's emotional register*. Pure prompt iteration cannot fix this because the id's input already includes the learner's last message — what's missing is *structured information* about the register-shift. Cell_102 (queued, see §7.1) tests this with a learner-register classifier injected into the id's user message.

### 6.2 Recognition-charisma trade-off is real but partially reconcilable

Cell_101 mean charisma (47.9 across curricula) is 2.4 points below cell_200's mean (48.9), but cell_201 mean last-turn v2.2 (49.7) is 7.6 points above cell_200's (41.4). The trade-off is real and small on charisma, substantial on v2.2. For pedagogically-oriented evaluation, recognition + charisma is the better cell. For the rubric's own theoretical question (what does AI charisma look like in text?), pure charisma may surface stronger exemplars.

### 6.3 The 901 / aura-invitation finding deserves methodological caution

Cell_100's charisma score on `charisma_aura_invitation` (course 901) was the pilot's strongest pure-charismatic performance: mean 75.8, peak 91.3. This is the AI-literacy curriculum, whose course content is grounded in **the same source paper that grounds the charisma rubric**. The paper's analytical framework (Benjamin's aura, the four-layer VVVA decomposition, the multimodal-to-text translation that anchors level 5 of every charisma dimension) is *precisely the material the id has access to via the curriculum context*.

This isn't circularity — the dialogues weren't authored to game the rubric, the judge model has no special calibration to this curriculum, and the same cell on 601 history-tech scored 40.6 mean charisma against the same rubric. But it is **rubric-curriculum alignment**: when the curriculum content speaks the rubric's theoretical idiom, the rubric scores responses higher than when it doesn't.

For paper integration: this finding should be flagged as a calibration consideration. See `docs/cell-100-methods-note.md` for the methods footnote draft.

### 6.4 The single failure (1/54 = 1.9%) is operationally tolerable but worth investigating

`cell_200 / charisma_nudge_pressure / 701` row 28461 failed with `Unexpected end of JSON input` from the id agent. With `jsonrepair` as a safety net and `max_tokens: 12000`, this should have parsed or fallen back. The most likely cause is the id model truncating mid-string within `generated_prompt` such that even jsonrepair couldn't infer closure. A larger token budget (16000) or a retry-on-fallback-status policy would close this gap.

## 7. Queued architectural variants

### 7.1 cell_202 — id-director with learner-register classifier

**Motivation:** The persona-shift floor (§6.1) is the strongest negative finding in the pilot. The hypothesis is that prompt iteration alone cannot bridge the gap between the id reading the curriculum and the id tracking the learner's emotional register.

**Design:** Add a small classifier step before the id authors. The classifier reads the learner's most recent message and emits a structured register tag (e.g., `{"register": "vulnerable_disclosure", "confidence": 0.8, "evidence": "..."}`). The classifier's output is injected into the id's user message as a new `<learner_register>` field. The id's prompt is updated to consume this field — when `register == "vulnerable_disclosure"` is signalled with high confidence, the id is required to author a witnessing/quieter persona, not a curriculum-led one.

**Test:** Same pilot structure as cells 200/201. Compare cell_202 last-turn v2.2 on persona-shift scenarios to cell_200 baseline (~26.5 floor). If structured input lifts that floor by 10+ points, the architecture is genuinely more responsive; if not, the limit is at the ego layer rather than the id's authoring layer.

### 7.2 cell_203 — id-author / ego-execute coupling check

**Motivation:** §4.3 found that the id can name a register-aware persona shift while the ego still produces curriculum-grounded prose. The named persona is descriptive; the executed prose is determined by the actual ego prompt.

**Design:** Add a coupling-check step after the id authors. Read the id's `generated_prompt`; verify that it explicitly includes a "this turn" directive that names an observable move; reject (and re-author) if not. Borrows from cell_99's coupling-targeted superego pattern but applied to the id-ego coupling instead.

### 7.3 Charisma-tuned vs pedagogy-tuned id variants

**Motivation:** §4.2 identified the prompt-budget axis as a real trade-off between rubrics.

**Design:** Two cells — `cell_204_charisma_tuned_id` (verbose prompt budget, no "single move" constraint, optimized for charisma rubric) vs `cell_205_pedagogy_tuned_id` (tight prompt budget, mandatory "single move" constraint, optimized for v2.2). Run both on the full pilot scope. Use the result to map the trade-off explicitly.

## 8. Audit trail

All commits on `experiment/cell-100-id-charisma`:

- `8418efd` — id-director architecture + Weberian charisma rubric (initial scaffold)
- `380d8da` — wire id-director dispatch through eval runner; persona prose lands
- `283fc58` — tighten id-director prompt; lift Turn 2 vulnerability response

All pilot data persisted in `evaluation_results` (shared SQLite at `~/.machinespirits-data/evaluations.db`):

- `eval-2026-04-26-220628d4` — 601 history-tech (18 rows, 18 success)
- `eval-2026-04-26-4df177e6` — 701 ethics-ai (18 rows, 17 success)
- `eval-2026-04-26-0d15c1b5` — 901 ai-literacy (18 rows, 18 success)

Per-row JSON in:
- `evaluation_results.tutor_charisma_scores` — 8-dimension charisma scores
- `evaluation_results.scores_with_reasoning` — 8-dimension v2.2 per-turn scores
- `evaluation_results.id_construction_trace` (where written) — id's authored persona, persona_delta, reasoning per turn

## 9. Reproduction

To replicate the pilot from a fresh worktree on `experiment/cell-100-id-charisma`:

```bash
# Worktree setup (assumes node_modules symlinked from main repo)
git worktree add ../machinespirits-eval-id-charisma experiment/cell-100-id-charisma
cd ../machinespirits-eval-id-charisma
ln -s ../machinespirits-eval/node_modules node_modules
ln -s ../machinespirits-eval/data data
ln -s ../machinespirits-eval/logs logs
ln -s ../machinespirits-eval/.env .env
npm test  # 2,512 tests should pass

# Pilot — 3 curricula in parallel
for c in history-tech ethics-ai ai-literacy; do
  case "$c" in
    history-tech) scns=charisma_phaedrus_invitation,charisma_print_pressure,charisma_attention_shift ;;
    ethics-ai)    scns=charisma_fairness_invitation,charisma_nudge_pressure,charisma_responsibility_shift ;;
    ai-literacy)  scns=charisma_aura_invitation,charisma_genre_pressure,charisma_deepfake_shift ;;
  esac
  EVAL_CONTENT_PATH="$(pwd)/content-${c}" \
  EVAL_SCENARIOS_FILE="$(pwd)/content-${c}/scenarios-${c}.yaml" \
  node scripts/eval-cli.js run \
    --profiles cell_200_id_director_charisma,cell_201_recog_id_director_charisma \
    --scenarios "$scns" --runs 3 --skip-rubric --parallelism 2 \
    --description "pilot ${c}: 2 cells × 3 scenarios × 3 repeats" &
done
wait

# Score under both rubrics
for runId in <three-run-ids-from-stdout>; do
  node scripts/eval-cli.js evaluate "$runId" --tutor-only --parallelism 3 &
  node scripts/evaluate-charisma.js "$runId" &
done
wait
```

Post-hoc analysis SQL templates: see §3.2 cross-tab and §3.3 scenario-type breakdown above for the queries.
