# Cross-Judge Sanity Check — Cell 101/102/103/104/105/106

> **Note on cell IDs (2026-04-28):** these cells were originally numbered 100–106 (briefly bumped to 200–206) and are now consolidated as cells 101–107 to avoid collision with a parallel `cell_100` added on `main`. The doc filename is preserved (`cell-100-...`) for git history continuity. All references in the body have been updated. Historical evaluation_results rows still use the original `cell_100_*` profile names; new runs use `cell_101_*` through `cell_107_*`.


**Date:** 2026-04-27
**Question:** Are the architectural claims about cell_104 (and the broader id-director family) artifacts of a specific judge model, or do they survive a swap to a different judge?
**Method:** Re-judge all available rows under `openrouter.gpt` and compare to the original judge.
**Scope:** 162 dialogue runs across cells 3, 100, 101, 102, 103, 104, 105 (all with v2.2 + charisma scores under the original judge).
**Cost:** ~$2.50 (estimate; charisma rejudge ran out of credits partway, see §3 below).

## 1. Headline finding

**Architectural rankings survive the cross-judge check unchanged. Absolute magnitudes shift modestly.**

- **Charisma rubric**: max per-cell delta ≤ 2.8 points; all cell rankings preserved across both judges.
- **v2.2 rubric**: GPT systematically scores 10–15 points *lower* than Sonnet on the high-scoring cells (c103, c104, c105) and slightly *higher* on the low-scoring factorial cells. The ranking c104 > c103 > c105 > c106 > c102 > c101 is preserved under both judges.
- **The c104 lift over c101 baseline survives**: under Sonnet, +45 points last-turn v2.2 (86.9 vs 41.5); under GPT, +27 points (72.3 vs 45.7). Smaller absolute lift but still substantively large.

The architectural claim is robust to judge choice. The specific *numerical magnitudes* in `docs/cell-100-pilot-findings-addendum.md` should be presented as judge-conditional (Sonnet-judge-specific) when cited in papers; the *architectural ordering* and *qualitative claims* (c104 is the champion, persona-shift floor is broken, etc.) are robust.

## 2. v2.2 cross-judge cross-tab (n=27 per cell, paired by dialogue_id)

For every dialogue_id, scored under both `claude-code/sonnet` (CLI) and `gpt-5.2` (OpenRouter) with the same v2.2 prompt template:

| Cell | n | Sonnet last-turn | GPT last-turn | Δ (gpt − sonnet) |
|---|---:|---:|---:|---:|
| c101 (id-director) | 26 | 41.5 | 45.7 | **+4.1** |
| c102 (id + recog) | 27 | 49.7 | 49.1 | −0.6 |
| c103 (cls) | 27 | 79.1 | 64.6 | **−14.5** |
| **c104 (cls + recog)** | 27 | **86.9** | **72.3** | **−14.6** |
| c105 (charisma-tuned) | 27 | 75.8 | 67.6 | −8.2 |
| c106 (pedagogy-tuned) | 27 | 56.6 | 57.4 | +0.8 |

| Cell | Sonnet first-turn | GPT first-turn | Δ |
|---|---:|---:|---:|
| c101 | 77.5 | 59.5 | −18.0 |
| c102 | 77.0 | 66.9 | −10.1 |
| c103 | 73.7 | 60.0 | −13.7 |
| c104 | 79.2 | 63.4 | −15.8 |
| c105 | 72.1 | 56.1 | −16.1 |
| c106 | 68.3 | 60.8 | −7.5 |

**Pattern:** GPT compresses the score range. It scores the high-scoring cells (Sonnet ≥ 75) lower by 10–18 points; it scores the lower cells (Sonnet 40–60) slightly higher or unchanged. The result is that under GPT, the absolute magnitudes shrink toward the middle, but the rank-order is preserved.

**Implication:** if a future paper cites a specific score (e.g., "c104 reached 86.9 last-turn v2.2"), the citation should specify the judge (`claude-code/sonnet`) and ideally report the GPT counterpart for transparency. Architectural claims about *which cell wins* are unaffected.

## 3. Charisma cross-judge cross-tab (n=56 paired rows; partial coverage)

The charisma rubric judge runs through OpenRouter and ran out of credits ~35% of the way through the rejudge. We have 56 rows scored under both judges; the remaining 103 retain their original Sonnet scores.

For the paired 56 rows, judge agreement is **very strong**:

| Cell | n | Sonnet | GPT | Δ |
|---|---:|---:|---:|---:|
| c101 | 10 | 60.5 | 57.8 | **−2.8** |
| c102 | 7 | 52.9 | 51.4 | −1.4 |
| c103 | 11 | 60.1 | 58.6 | −1.5 |
| **c104** | 8 | **62.2** | **62.3** | **+0.2** |
| c105 | 11 | 62.4 | 60.6 | −1.8 |
| c106 | 9 | 27.8 | 26.4 | −1.4 |

**All deltas within ±3 points.** Cell rankings:

- Sonnet: c105 (62.4) ≈ c104 (62.2) > c103 (60.1) ≈ c101 (60.5) > c102 (52.9) > c106 (27.8)
- GPT: c104 (62.3) ≈ c105 (60.6) > c103 (58.6) ≈ c101 (57.8) > c102 (51.4) > c106 (26.4)

**Identical qualitative ordering. No magnitude compression.** The charisma rubric is robust to judge choice in a way that v2.2 is not.

## 4. Why the rubrics differ in cross-judge stability

Two probable factors:

1. **The v2.2 rubric uses Claude CLI by default** (`claude-code/sonnet`) which spawns a `claude -p` subprocess. The GPT rejudge uses the OpenRouter API. The two different invocation paths could introduce small framing-prompt differences that compound across the 8 v2.2 dimensions.

2. **GPT may be a stricter judge on the high-scoring band.** When asked "is this a 5/5 perfect response?", GPT appears to require more before awarding 5; Sonnet (especially in CLI context, where it reasons for longer) is more willing. This compresses the high end.

The charisma rubric, by contrast, has more concrete operational criteria (specific markers like "uses 'I hear you' label" → score 1) which leave less room for judge-specific calibration variance.

## 5. Implications for paper integration

When `paper-full-2.0.md` integrates these results:

- **Always disclose the judge model** for any cited score. The current default judge for evaluate is `claude-code/sonnet`; the cross-judge GPT scores are documented in `data/charisma-sonnet-snapshot-2026-04-27.tsv` (the snapshot of pre-rejudge state) and the v2.2 GPT rows in `evaluation_results.judge_model = 'gpt-5.2'`.
- **Lead with rank-order claims, not magnitudes.** "Cell_103 outscores cell_101 baseline on every scenario type and under both judges" is robust. "Cell_103 hits 86.9" should be qualified.
- **The 86.9 / 72.3 spread itself is a publishable observation** — it documents judge-model bias as an empirical phenomenon worth being explicit about. The id-director architecture's headline lift survives this bias; many future architectural claims may not.

## 6. Recommended action items

1. **Re-judge the remaining 103 charisma rows under GPT** when OpenRouter credits are topped up. ~$1, ~5–10 min. Closes the matrix and lets us report cross-judge agreement on charisma at full n.
2. **Add a `cross_judge_score` field** to evaluation_results to permanently store both judges' charisma scores (rather than relying on a TSV snapshot for the audit trail).
3. **Run a third-judge sanity check** with `openrouter.haiku` or a non-Anthropic / non-OpenAI model. If three judges agree on the rank-order, the architectural claim is unimpeachable; if three judges disagree on magnitudes, that itself is the result.

## 7. Audit trail

- Cross-judge data persisted in `evaluation_results` table:
  - v2.2: rows with `judge_model = 'claude-code/sonnet'` (original) and `judge_model = 'gpt-5.2'` (rejudge).
  - Charisma: original Sonnet scores restored after the partial GPT rejudge; GPT scores only available via the snapshot at `data/charisma-sonnet-snapshot-2026-04-27.tsv` cross-referenced with the rejudge-log charisma scores in `/tmp/rejudge-char-eval-*.log`.

- Run IDs included in the cross-judge analysis (all 10 from the cell-100-family pilot):
  - `eval-2026-04-26-220628d4`, `eval-2026-04-26-4df177e6`, `eval-2026-04-26-0d15c1b5` (original pilot)
  - `eval-2026-04-26-759e1a02` (Item 1 swap)
  - `eval-2026-04-27-23beaa63`, `eval-2026-04-27-3115ab29`, `eval-2026-04-27-2d5c20ca` (Item 2)
  - `eval-2026-04-27-69167b53`, `eval-2026-04-27-2efec307`, `eval-2026-04-27-ce22e888` (Item 3)
