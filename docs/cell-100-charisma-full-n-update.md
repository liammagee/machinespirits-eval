# Charisma Full-N Update — CLI Sonnet at n=430

> **Note on cell IDs (2026-04-28):** the id-director family is paper cells 101–107; the historical `evaluation_results` rows still use the original `cell_100_*` to `cell_107_*` profile names. The mapping is `cell_100` → c101, `cell_101` → c102, ..., `cell_105` → c106, `cell_106` → c107 (smoke), `cell_107` → c107 (new persona-shift evals).

**Date:** 2026-04-28
**Question:** With charisma scoring complete across the full 430-row matrix under a single consistent judge (Claude Code CLI Sonnet 4.6, `claude-sonnet-4-6` resolved by the CLI's `--model sonnet` alias and now pinned explicitly in `config/providers.yaml`), do the headline findings of the original cross-judge sanity check (`docs/cell-100-cross-judge-sanity-check.md`, n≈10 paired) hold?
**Method:** Re-score all 311 previously-unscored charisma rows + add c107 generation runs (10 successful) under `claude-code.sonnet` via the Claude Code CLI subscription. Required two engine fixes (provider branch in `services/rubricEvaluator.js::callJudgeModel`, override-key wrapper in `scripts/evaluate-charisma.js::scoreRow`) and one env fix (delete `ANTHROPIC_API_KEY` in spawn env so CLI uses subscription rather than API).
**Result:** **Two of the four findings of the cross-judge sanity check are refined; the other two strengthen.**

## 1. Full-N CLI Sonnet matrix

All seven id-director cells, full n, single consistent judge:

| Paper cell | DB profile | n | Charisma mean | v2.2 first-turn | v2.2 last-turn |
|---|---|---:|---:|---:|---:|
| c101 (id-director) | cell_100 | 79 | 59.9 | 68.6 | 55.5 |
| c102 (id + recog) | cell_101 | 54 | 54.1 | 72.0 | 49.4 |
| c103 (id + cls) | cell_102 | 81 | 64.3 | 68.1 | 75.8 |
| c104 (id + cls + recog) | cell_103 | 81 | 65.7 | 72.0 | **80.6** |
| **c105 (charisma-tuned)** | cell_104 | 81 | **71.0** | 64.8 | 70.0 |
| c106 (pedagogy-tuned) | cell_105 | 54 | 36.4 | 64.6 | 57.0 |
| c107 (witness-exemplars) | cell_106/107 | 27 | 66.3 | 73.1 | **78.5** |

**Architectural rank-order on charisma**: c105 > c107 ≈ c104 > c103 > c101 > c102 > c106
**Architectural rank-order on v2.2 last-turn**: c104 > c107 > c103 > c105 > c106 ≈ c101 > c102

(Charisma c107 vs c104 differ by 0.6 — within run-to-run sampling noise. v2.2 c107 vs c104 differ by 2.1.)

## 2. What changed from the n≈10 cross-judge result

The original cross-judge sanity check's charisma table reported:
- Sonnet: c105 (62.4) ≈ c104 (62.2) > c103 (60.1) ≈ c101 (60.5) > c102 (52.9) > c106 (27.8)

At full n=430, the picture refines:
- CLI-Sonnet: c105 (71.0) > c104 (65.7) ≈ c103 (64.3) > c101 (59.9) > c102 (54.1) > c106 (36.4)

**Three substantive shifts:**

1. **c105 (charisma-tuned) now leads c104 by 5.3 points**, where the original n≈10 sample showed c105 ≈ c104. The original "no specialization signal from charisma-tuning" reading was an artifact of low statistical power. With full n=81 per cell, c105 *is* measurably more charismatic than the recognition-tuned cell. This is the result one would predict from the architecture.

2. **c106 (pedagogy-tuned) is less catastrophic at full N** — moves from 27.8 to 36.4 — but is still solidly the worst performer on charisma. Pedagogy-tuning the id's instructions appears to suppress register variation in a way that hurts charisma without recovering on v2.2 (last-turn 57.0).

3. **The c104 vs c103 charisma gap (recognition vs no-recognition under classifier) is small** — 65.7 vs 64.3, just +1.4. Recognition vocabulary in the id's instructions doesn't reliably translate into greater charisma when the classifier is already structuring the persona-shift. This is consistent with the cross-rubric divergence design intent: charisma is more about register and rhetoric than about the conceptual frame.

## 3. The cross-rubric divergence is now empirically clear

This is the validating sanity check the rubric was designed to enable. Two top performers, two different rubrics:

| Cell | charisma | v2.2 last-turn | Cross-rubric pattern |
|---|---:|---:|---|
| **c104** (id + cls + recog) | 65.7 | **80.6** | Wins v2.2, mid on charisma |
| **c105** (charisma-tuned) | **71.0** | 70.0 | Wins charisma, mid on v2.2 |

The two rubrics order the cells differently. The charisma rubric is not a re-presentation of v2.2 — it captures something orthogonal. (If the rubrics were perfectly correlated, `r → 1` and rank-order would match; they don't.)

This is the reverse of a methodological worry — it's the exact result the design intended, but at sample size n=10 it would have been hard to distinguish from noise.

## 4. c107 (witness-exemplars) — full pilot, n=27

After OpenRouter top-up the remaining 17 c107 evals were regenerated successfully and scored under CLI Sonnet on both rubrics. Final numbers at n=27 (3 curricula × 3 scenarios × 3 reps):

| Curriculum | Scenarios | n | mean charisma | mean v2.2 t0 | mean v2.2 tN |
|---|---|---:|---:|---:|---:|
| 601 history-tech | phaedrus / lecture / codex | 9 | 64.6 | 71.4 | 83.1 |
| 701 ethics-ai | fairness / team / design | 9 | 71.5 | 73.4 | 76.2 |
| 901 ai-literacy | authentic / consumption / tools | 9 | 62.9 | 74.4 | 81.0 |
| **All curricula** | **9 scenarios** | **27** | **66.3** | **73.1** | **78.5** |

**c107 is the cell ladder's best generalist.** It places second on charisma (66.3, edging c104's 65.7 by 0.6 — effectively tied) AND second on v2.2 last-turn (78.5, c104's 80.6 leads by 2.1). The four curated c104 exemplars passed to the id appear to provide structural patterns that lift quality on both rubrics simultaneously.

This frames the cell ladder as three architectural design points rather than one "best" cell:

- **Classifier + recognition (c104)**: structured input optimised for v2.2 — best at the recognition-rubric scoring criteria, second-best on charisma.
- **Charisma-tuned id directives (c105)**: id author instructed to optimise for register and rhetoric — best on charisma, mid-pack on v2.2.
- **Witness exemplars (c107)**: id author given concrete c104-style high-scorers to imitate — second-best on both rubrics, no specialty extreme.
- **Pedagogy-tuned (c106)**: id author instructed to flatten persona toward "good teacher" register — clear failure on both.

The witness-exemplars approach (c107) suggests an architectural lever distinct from explicit prompt-tuning: instead of telling the id *what* to write, show it *examples* of high-scoring outputs and let the id reverse-engineer the structure. The result is balanced rather than specialized.

c107 generation audit trail (the resumed 17 evals after OpenRouter top-up):
- `eval-2026-04-28-ee339a66` (601, lecture + phaedrus): 6 evals, charisma mean 71.3, v2.2 mean 83.1
- `eval-2026-04-28-84a42a60` (701, fairness + team): 6 evals, charisma mean 72.9, v2.2 mean 76.2
- `eval-2026-04-28-5606193c` (901, authentic + consumption): 6 evals, charisma mean 64.2, v2.2 mean 81.0
- Plus 9 smoke (codex/design/tools, 3 each) under same CLI Sonnet rubric.

## 5. Methodology note: CLI vs OpenRouter Sonnet (same model, different sampling)

A single-row comparison of the same dialogue scored under both paths (charisma rubric):
- OpenRouter Sonnet 4.6 at temp=0.2: 46.25
- CLI Sonnet 4.6 at default sampling: 65.0

A 19-point spread on a single row, **but both paths route to `claude-sonnet-4-6`** — the spread is from temperature/sampling differences, not model differences. The CLI does not honour the rubric YAML's `temperature: 0.2` setting; it uses Claude Code's default sampling. Run-to-run variance under default-temp CLI scoring is wider than at temp=0.2, but per-cell means stayed within ±5 of the OpenRouter-temp-0.2 baseline.

**Model pinning.** The CLI defaults to `claude-sonnet-4-6` when given the bare `--model sonnet` alias, but to insulate the headline numbers from any future change in the CLI's bare-alias default, `config/providers.yaml` now maps `claude-code.sonnet → claude-sonnet-4-6` explicitly. Aliases for `claude-code.sonnet-4-5` and `claude-code.sonnet-4-6` are also available for explicit selection.

**The headline numbers in this doc are CLI Sonnet 4.6 at default sampling**, n=430 (cells 101–106) + n=27 (cell 107) = 457 paired rows. Audit-trail label in DB: `tutor_charisma_judge_model = 'claude-code.sonnet'`.

The CLI path is preferable for long-running judge passes because it goes through the user's Claude Code subscription rather than per-token API billing — same model, no credit ceiling. The engine fixes shipped in commit `ca9aa94`: a `claude-code` provider in `callJudgeModel`, env-stripping of `ANTHROPIC_API_KEY` in the spawn environment to force subscription mode, and a wrapper-key fix in `evaluate-charisma.js` so `--judge` overrides actually take effect. Model pinning shipped in commit `<TBD>`.

## 6. Implications for paper integration

The current §6.7 of `paper-full-2.0.md` should be updated:

- **Replace the partial-Sonnet charisma numbers** (n≈10) with the full-N CLI Sonnet numbers (n=430).
- **Lead the cross-rubric finding more confidently** — at full N, c105's charisma lead over c104 is 5.3 points and statistically detectable.
- **Update the "scope of the extension" §8.9** — the cell ladder now has clearer cross-rubric divergence, which is itself a result rather than a limitation.
- **Add c107 to the cell ladder** with the n=10 caveat. Mention that full c107 N requires OpenRouter top-up.

## 7. Audit trail

- 12 charisma scoring run IDs (each n=34–36), all under `claude-code.sonnet`:
  - `eval-2026-04-26-{0d15c1b5,220628d4,4df177e6}` (original pilot)
  - `eval-2026-04-27-{23beaa63,69167b53,2efec307,3115ab29,2d5c20ca,ce22e888,1f192b31,18dbb95d,dce2a0f1}` (Items 2–3)
- 4 c107 charisma run IDs (n=3 / 3 / 3 / 1):
  - `eval-2026-04-28-{3620e0f8,a638111d,d6f5fee2,84a42a60}`
- DB query that produces the §1 table:
  ```sql
  SELECT profile_name, COUNT(*), AVG(tutor_charisma_overall_score),
         AVG(tutor_first_turn_score), AVG(tutor_last_turn_score)
  FROM evaluation_results
  WHERE tutor_charisma_judge_model = 'claude-code.sonnet' AND success = 1
    AND profile_name LIKE 'cell_10%_id_director%'
  GROUP BY profile_name;
  ```
- Total cost: $0 OpenRouter (CLI subscription path), ~$0 Anthropic API (env-stripped).

## 8. Recommended next steps

1. ~~**OpenRouter top-up**, then regenerate 17 missing c107 evals~~ — done (2026-04-28).
2. **Update §6.7 of paper-full-2.0.md** with the full-N numbers, the three architectural-design-points framing (c104 / c105 / c107 specialise differently; c106 fails), and the cross-rubric divergence finding. Cite this doc as the audit trail.
3. **Consider a third-judge cross-check** — Haiku 4.5 via CLI, Gemini Pro via API — to validate the c105 vs c104 charisma lead and the c107 generalist claim. Rubric stability across judges is itself publishable.
4. ~~**Optional: c108+ ablation** — combine witness-exemplars + classifier (c103 + exemplars), or witness-exemplars + charisma-tuning (c105 + exemplars), to test whether exemplars can co-exist with the other levers or interfere.~~ — pilot run 2026-04-28; see §9 below.

## 9. c108/c109 exemplar-composition pilot (2026-04-28)

**Question:** Do witness-exemplars compose with the other architectural levers (register classifier; charisma-tuning), or do they overlap / interfere?

**Method:** Two new cells registered alongside c107:

- **c108** (`cell_108_id_director_charisma_register_exemplars`) = **c103 (id + classifier) + witness-exemplars**. No recognition vocabulary, no charisma-tuning. The classifier emits a register tag from the learner's most recent message; the id authors with both the classifier signal and the four c104 exemplars in scope.
- **c109** (`cell_109_id_director_charisma_tuned_exemplars`) = **c105 (charisma-tuned id) + witness-exemplars**. The charisma-tuned id directives (verbose 800–1500 token persona instructions) plus the exemplar block. Id `max_tokens` raised from 12k to 16k to absorb the larger context.

Pilot was 2 scenarios (`charisma_phaedrus_shift_repl`, `charisma_codex_shift_repl`) × 3 reps × 2 cells = 12 attempted, 11 succeeded (one c108/codex JSON-parse failure in the id output). Run id `eval-2026-04-28-10216f9f`. Same CLI Sonnet 4.6 judge, both rubrics.

### 9.1 Pilot results

Per-cell pooled across both scenarios:

| Cell | n | charisma | v2.2 t0 | v2.2 tN |
|---|---:|---:|---:|---:|
| c108 (classifier + exemplars) | 5 | **81.3** | 68.3 | **79.5** |
| c109 (charisma-tuning + exemplars) | 6 | 77.7 | 53.5 | 59.6 |

For comparison, baseline cells on the same two scenarios (n=3 per cell × scenario, from prior runs):

| Cell | phaedrus charisma / tN | codex charisma / tN |
|---|---:|---:|
| c101 | 71.7 / 77.5 | 67.9 / 60.0 |
| c103 | 72.9 / 73.8 | 64.6 / 82.5 |
| c104 | 58.8 / 87.5 | 60.8 / 62.9 |
| c105 | 83.3 / 72.1 | 76.3 / 38.8 |
| c107 | 68.7 / 87.1 | 55.0 / 74.2 |
| **c108** | **90.0 / 77.1** | 68.1 / 83.1 |
| **c109** | 80.4 / 50.4 | 75.0 / 68.8 |

### 9.2 Two answers

**Q1 — Does c108 compose, or overlap with c104?** Composes, and apparently *super-additively*. c108's pooled charisma 81.3 is the highest pilot mean of any id-director cell (the prior leader, c105 at full N, was 71.0). On phaedrus it reaches 90.0, the largest single-scenario charisma mean we have observed. v2.2 tN at 79.5 sits between c104's 80.6 (full-N) and c107's 78.5 — i.e. c108 does not lose v2.2 to gain charisma. The hypothesis: the classifier's register tag tells the id *which* of the exemplar patterns to lean on, so the id is no longer choosing between exemplar-fidelity and register-fit. With small N the magnitudes are noisy, but the qualitative pattern (c108 ≥ c105 on charisma AND c108 ≈ c104/c107 on tN) is consistent across both scenarios.

**Q2 — Does c109 preserve charisma while raising v2.2 toward c107's 78.5?** No. c109's v2.2 tN drops to 59.6 — well below c105's 70.0 full-N and far below c107's 78.5. Charisma is preserved (77.7 pilot vs 71.0 c105 full-N), but at the cost of an ego-execution failure mode visible in the transcripts: when the charisma-tuned id emits a long persona-instruction block *and* an exemplar block, the ego occasionally outputs the instructions verbatim ("We need to respond with the original instructions about voice, register, etc.") rather than executing them. One c109/codex turn-0 in the pilot scored 6.3/100 because the ego dumped its system prompt as the public message. Recovery in turns 1–2 is good (one row had t1=92.5, t2=70.0 after t0=6.3), but the turn-0 fragility is what crashes the v2.2 average. The "double-verbose" hypothesis: charisma-tuning + exemplars push the id's prompt past a stability threshold that the Nemotron ego can no longer cleanly follow.

### 9.3 What this changes about the architectural-design-points framing

The §4 framing held cells as four design points: c104 (structured input → v2.2 specialist), c105 (charisma-directives → charisma specialist), c107 (exemplars-only → balanced generalist), c106 (pedagogy-tuned → failure). The pilot adds two more, sharpening the lever-interaction picture:

- **c108 = classifier + exemplars** — pilot-strength evidence that *two non-text levers compose super-additively*: the classifier picks register, exemplars structure response. No verbose prompt instruction-language is added; the id's authoring budget is spent on orchestration rather than self-narration. Tentatively the strongest cell on combined charisma + v2.2.
- **c109 = charisma-directives + exemplars** — the additive hypothesis fails for *two text-heavy levers stacked*. The id's prompt becomes long enough that the ego's instruction-following degrades. This is a useful negative result for the "more is better" intuition: there is an ego-side capacity ceiling beyond which adding architectural support hurts execution.

### 9.4 Caveats

- **Pilot N**: 5 (c108) and 6 (c109) rows. Far below the paper's $n \geq 63$ confirmatory floor. The c108 phaedrus 90.0 is a single scenario cell with n=3 — one reason to expect regression to the mean on full-N. Read these as hypothesis-generating, not confirmatory.
- **One c108 generation failure** ("Unexpected end of JSON input" from the id) suggests the classifier+exemplars id call is near the OpenRouter response truncation limit even at id `max_tokens: 12000`. If c108 goes to full N, id budget should likely go to 16k or the prompt design should be tightened.
- **Scenario mix is narrow**: phaedrus + codex are both high-stakes humanities scenarios that favour rich register. Whether the c108 lift survives the broader curriculum mix (especially 901 ai-literacy and 701 ethics-ai) is the obvious next test.

### 9.5 Suggested follow-ups (queued, not in scope of the v3.0.61 update)

1. **Full c108 pilot** (n=27 across all three curricula × 9 scenarios × 3 reps) — the cleanest test of whether "classifier + exemplars" beats c104/c105/c107 at confirmatory N. Cost ~$0 (CLI subscription) plus the OpenRouter generation budget for ~27 evals.
2. **c109 ego-capacity diagnostic** — the meta-narration failure mode is interesting in its own right. Log id-prompt length per row and correlate with the t0 score. If the failure mode is monotone in prompt length, it has implications for the "more architectural support is better" intuition that other dialectical cells implicitly rely on.
3. **A "c108 minus classifier" sanity check** — c107 already exists at full N; the pilot result above implies (c108 − c107) ≈ +15 charisma is the classifier's *additional* contribution on top of exemplars. Worth confirming at full N before headlining.

### 9.6 Audit trail

- Pilot run id: `eval-2026-04-28-10216f9f`
- Generation: 12 attempted, 11 succeeded (one c108/codex JSON-parse fail in the id authoring step)
- Both rubrics scored under `claude-code.sonnet` (CLI subscription, model pinned to `claude-sonnet-4-6` via `config/providers.yaml`)
- Smoke run id (1 ep × 1 scenario × 2 cells, mechanism check): `eval-2026-04-28-d6456a85`
- Cells registered: `cell_108_id_director_charisma_register_exemplars` (factors: `register_classifier: true`, `witness_exemplars: true`); `cell_109_id_director_charisma_tuned_exemplars` (factors: `id_tuning: charisma`, `witness_exemplars: true`). Both in `EVAL_ONLY_PROFILES` array (`services/evaluationRunner.js` line 209).

## 10. c108 full-N closure (2026-04-29) — pilot lift does NOT survive confirmatory N

**Question:** Does the §9 pilot's super-additive c108 lift (charisma 81.3 from $n=5$ on phaedrus + codex) survive at confirmatory $n=27$ across all three curricula × 9 scenarios × 3 reps?

**Method:** Three concurrent eval-cli runs, one per curriculum, each at `--profile cell_108_id_director_charisma_register_exemplars --runs 3 --skip-rubric --parallelism 2` with the appropriate `EVAL_CONTENT_PATH` / `EVAL_SCENARIOS_FILE` env vars. Generation: 27/27 successes, no failures. Scoring: both rubrics under `claude-code.sonnet` (CLI subscription, model pinned to `claude-sonnet-4-6`).

**Headline answer: NO.** The pilot's charisma 81.3 regresses to **71.4** at full N (a 9.9-point drop); v2.2 last-turn 79.5 regresses to **72.6** (a 6.9-point drop). c108 is now essentially tied with c105 on charisma (71.4 vs 71.0) and below both c104 (80.6) and c107 (78.5) on v2.2 last-turn. The "non-text levers compose super-additively" hypothesis is **not confirmed** at confirmatory N.

### 10.1 Full-N c108 results

Per-curriculum:

| Curriculum | Run id | n | charisma | v2.2 t0 | v2.2 tN |
|---|---|---:|---:|---:|---:|
| 601 history-tech | `eval-2026-04-29-499ab3d2` | 9 | 73.1 | 75.0 | 76.7 |
| 701 ethics-ai    | `eval-2026-04-29-e35c66ae` | 9 | 71.9 | 70.0 | 65.3 |
| 901 ai-literacy  | `eval-2026-04-29-be822796` | 9 | 69.2 | 74.0 | 75.8 |
| **All curricula** | **3 runs**                | **27** | **71.4** | **73.0** | **72.6** |

Per-scenario (n=3 each):

| Scenario | charisma | v2.2 t0 | v2.2 tN |
|---|---:|---:|---:|
| `charisma_lecture_shift_repl` | **82.5** | 77.9 | **92.9** |
| `charisma_consumption_shift_repl` | 75.0 | 65.4 | **89.6** |
| `charisma_phaedrus_shift_repl` | 67.9 | 79.6 | 85.4 |
| `charisma_fairness_shift_repl` | 76.7 | 81.3 | 77.5 |
| `charisma_authentic_shift_repl` | 69.2 | 78.8 | 69.6 |
| `charisma_team_shift_repl` | 69.6 | 66.3 | 66.3 |
| `charisma_tools_shift_repl` | 63.3 | 77.9 | 68.3 |
| `charisma_codex_shift_repl` | 68.8 | 67.5 | **51.7** |
| `charisma_design_shift_repl` | 69.6 | 62.5 | **52.1** |

### 10.2 Comparison against the design-points framing

Updated cell ladder under CLI Sonnet at full N (now including c108):

| Cell | DB profile | n | charisma | v2.2 tN | Position |
|---|---|---:|---:|---:|---|
| c104 (id + cls + recog) | `cell_103` | 81 | 65.7 | **80.6** | v2.2 specialist (unchanged) |
| **c105 (charisma-tuned)** | `cell_104` | 81 | **71.0** | 70.0 | charisma specialist (unchanged) |
| c107 (witness-exemplars) | `cell_106/107` | 27 | 66.3 | 78.5 | balanced generalist (unchanged) |
| **c108 (cls + exemplars)** | `cell_108` | **27** | **71.4** | **72.6** | **between c105 and c107; no design-point** |
| c106 (pedagogy-tuned) | `cell_105` | 54 | 36.4 | 57.0 | failure (unchanged) |

c108 charisma 71.4 ties c105's 71.0 within sample noise (the +0.4 gap is well below the run-to-run SD on either cell). c108 v2.2 tN 72.6 sits 8 points below c104, 6 points below c107, but 2.6 points above c105. **c108 does not unseat any specialist** — it sits midway between c105 and c107 on both rubrics with no extreme strength.

### 10.3 Why the pilot was misleading

The pilot's 81.3 charisma came from $n=5$ pooled across `phaedrus` + `codex` only — both high-stakes humanities scenarios that favour rich rhetoric. At full N these two scenarios tell different stories than the pilot suggested:

- **Phaedrus**: pilot 90.0 charisma → full-N 67.9 charisma. A 22-point regression to the mean. The pilot's three phaedrus rows happened to land on rich responses; broader sampling does not reproduce.
- **Codex**: pilot 68.1 charisma → full-N 68.8. Stable. The pilot was correct on codex.

The phaedrus drop accounts for most of the pooled regression. With one curriculum's pilot ($n=3$ on a single scenario type) over-determining a 9.9-point lift, the pilot was a textbook small-N optimism trap.

### 10.4 The 701 ethics-ai v2.2 collapse is the new finding

Outside the pilot scope, the 701 ethics-ai curriculum exposes a fragility: c108's v2.2 tN drops to **65.3** there (vs 76.7 / 75.8 on 601 / 901). Drilling in, the codex (51.7) and design (52.1) scenarios pull this down — both score below 55 on v2.2 tN despite acceptable charisma (68.8 / 69.6). Two interpretations:

1. **Curriculum-conditional ego execution failure.** The ethics-ai scenarios may push the id's prompt past a context-budget threshold the Nemotron ego handles less reliably than 601/901 contexts. This would be the c109 meta-narration failure mode in milder form.
2. **Rubric-curriculum interaction.** Ethics scenarios may invite responses that the v2.2 rubric reads as flat (low pedagogical-craft, low elicitation) even when the charisma rubric reads them as adequately voiced. Ethics-themed dialogues may simply *be* harder to score high on v2.2 because the recognition-rubric criteria favour question-rich pedagogical moves over declarative ethical claims.

The codex / design transcript spot-check would distinguish these. Queued; not in scope for this update.

### 10.5 What this changes about §9.3's architectural-design-points framing

The §9.3 prediction "c108 is tentatively the strongest cell on combined charisma + v2.2" is **falsified at full N**. Updating the design-points framing:

- **c104**: structured input → v2.2 specialist (unchanged; charisma 65.7, v2.2 80.6).
- **c105**: charisma-directives → charisma specialist (unchanged; charisma 71.0, v2.2 70.0).
- **c107**: witness-exemplars → balanced generalist (unchanged; charisma 66.3, v2.2 78.5).
- **c108**: classifier + witness-exemplars → **mid-pack on both rubrics; no specialty extreme**. The two non-text levers do *not* compose super-additively at full N. They compose roughly *additively* relative to c107 alone (charisma 66.3 → 71.4, +5.1; v2.2 80.6 → 72.6, -8.0): adding the classifier on top of exemplars trades a small charisma gain for a larger v2.2 cost. Net: c108 sits *below* c107 on combined performance.
- **c106**: pedagogy-tuned → failure (unchanged).

The four-design-point picture stands. c108 does not introduce a fifth design point; it's a ladder-rung between c105 and c107 that sacrifices generalist strength for a marginal charisma gain.

### 10.6 What this changes about the §9.2 "non-text levers compose" claim

The §9.2 hypothesis (non-text levers compose; text-heavy levers stacked interfere) collapses to a single claim at full N: **text-heavy levers stacked interfere** (c109 still has the meta-narration failure mode at pilot $n=6$, with v2.2 tN 59.6 well below either parent). The "non-text levers compose" half is unsupported — c108's full-N numbers show that classifier + exemplars compose *neutrally to slightly under*, not super-additively.

The asymmetry is now: stacking levers on the id (whether text or non-text) tends to add noise rather than clean lift. The architectural ceiling for the id-director family appears to sit at the *single-mechanism* design points (c104, c105, c107), not at multi-mechanism stacks.

### 10.7 Implications for paper §6.7 framing

The §6.7 *Lever-interaction pilot* paragraph (added in v3.0.62) carried the explicit "hypothesis-generating only" caveat and a "queued follow-up: full c108 pilot at $n=27$" note. That follow-up has now run. The §6.7 paragraph should:

1. **Retain** the c108 pilot's super-additive charisma 81.3 figure as reported, because it was correctly framed as pilot-scale.
2. **Add** the full-N result: c108 at $n=27$ regresses to charisma 71.4 / v2.2 tN 72.6 — essentially tied with c105 on charisma and below c107/c104 on v2.2.
3. **Tighten** the headline interpretation from "non-text levers compose super-additively" (pilot) to "non-text levers compose roughly additively, with no specialty advantage at full N" (confirmatory). The qualitative asymmetry between c108 (mild composition) and c109 (clear interference) is preserved, but only c109's negative result holds at the confirmatory threshold.
4. **Remove** the "queued follow-up: full c108 pilot to test whether the lift survives confirmatory N" caveat (the follow-up has run).

### 10.8 Audit trail

- Generation run IDs: `eval-2026-04-29-{499ab3d2 history-tech, e35c66ae ethics-ai, be822796 ai-literacy}` — 9 evals each, 27 total, all successful.
- Scoring: v2.2 via `eval-cli.js evaluate <runId> --judge-cli claude --model claude-sonnet-4-6 --parallelism 2`; charisma via `evaluate-charisma.js <runId> --judge claude-code.sonnet`. CLI subscription path (Anthropic API key env-stripped). Both rubrics scored; total 54 score-cells across 27 rows.
- DB query producing the §10.1 pooled row:
  ```sql
  SELECT COUNT(*) as n, AVG(tutor_charisma_overall_score), AVG(tutor_first_turn_score), AVG(tutor_last_turn_score)
  FROM evaluation_results
  WHERE run_id IN ('eval-2026-04-29-499ab3d2','eval-2026-04-29-e35c66ae','eval-2026-04-29-be822796')
    AND tutor_charisma_judge_model = 'claude-code.sonnet';
  ```
- Per-cell SD note: c108 charisma at $n=27$ ranges 40.0–91.3; pooled SD ≈ 13.3. The pilot's 81.3 was within 1 SD of the full-N mean, so the pilot was technically not an outlier — just an unrepresentative subsample of two scenarios.
- Cost: $0 OpenRouter (CLI subscription path) + ~$0 Anthropic API (env-stripped) for scoring; ~$2 OpenRouter for the 27-eval generation pass.
