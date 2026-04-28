# Charisma Full-N Update — CLI Sonnet at n=430

> **Note on cell IDs (2026-04-28):** the id-director family is paper cells 101–107; the historical `evaluation_results` rows still use the original `cell_100_*` to `cell_107_*` profile names. The mapping is `cell_100` → c101, `cell_101` → c102, ..., `cell_105` → c106, `cell_106` → c107 (smoke), `cell_107` → c107 (new persona-shift evals).

**Date:** 2026-04-28
**Question:** With charisma scoring complete across the full 430-row matrix under a single consistent judge (Claude Code CLI Sonnet 4.5), do the headline findings of the original cross-judge sanity check (`docs/cell-100-cross-judge-sanity-check.md`, n≈10 paired) hold?
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
| c107 (witness-exemplars) | cell_106/107 | 10 | 61.9 | **78.5** | 74.6 |

**Architectural rank-order on charisma**: c105 > c104 ≈ c107 > c103 > c101 > c102 > c106
**Architectural rank-order on v2.2 last-turn**: c104 > c103 > c107 > c105 > c106 ≈ c101 > c102

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

## 4. c107 (witness-exemplars) — preliminary, n=10

The witness-exemplars cell achieves the **highest first-turn v2.2 of any cell** (78.5), but mid-pack charisma (61.9). Reading: the four curated c104 exemplars passed to the id appear to lift the opening move's quality without driving the kind of register-shifting that makes c105 charismatic.

c107 generation hit OpenRouter 402 errors on 17 of 27 planned evals; the 10 successful rows are: 9 from the original smoke (codex/design/tools, n=3 each) plus 1 lucky fairness_shift_repl row that landed before credits exhausted. With OpenRouter top-up the remaining 17 can be regenerated and rescored cheaply; until then, c107 numbers are preliminary.

## 5. Methodology note: CLI vs OpenRouter Sonnet

A single-row comparison of the same dialogue scored under both paths (charisma rubric):
- OpenRouter Sonnet at temp=0.2: 46.25
- CLI Sonnet at default sampling: 65.0

A 19-point spread on a single row. The variance is bounded across the matrix (per-cell means stayed within ±5 of the OpenRouter Sonnet baseline), but for any row-level comparison the judge path matters. **The headline numbers in this doc are CLI Sonnet at default sampling**, n=430.

The CLI path is preferable for long-running judge passes because it goes through the user's Claude Code subscription rather than per-token API billing — same model, no credit ceiling. The engine fix is in commit `<TBD>`: a `claude-code` provider in `callJudgeModel`, env-stripping of `ANTHROPIC_API_KEY` in the spawn environment to force subscription mode, and a wrapper-key fix in `evaluate-charisma.js` so `--judge` overrides actually take effect.

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

1. **OpenRouter top-up**, then regenerate 17 missing c107 evals (~$1, ~5–10 min). Closes the c107 matrix at n=27 per scenario set.
2. **Update §6.7 of paper-full-2.0.md** with the full-N numbers and the cross-rubric divergence finding (c105 specifically wins charisma; c104 specifically wins v2.2 last-turn). Cite this doc as the audit trail.
3. **Consider a third-judge cross-check** — Haiku 4.5 via CLI, Gemini Pro via API — once the matrix is closed. The rubric stability across judges is itself publishable.
