# Unreliable-learner visibility contrast — mechanical scoring

group `unreliable-v1` · 12/12 registered runs on file · scored 2026-06-11T21:25:41.241Z
registration: UNRELIABLE-LEARNER-PREREG.md (endpoints §5, hypotheses §6)

## Runs

| run | world | arm | seed | verdict | turns | decay | tutor repairs | per-slip | selected | mean latency | schedule |
|---|---|---|---|---|---|---|---|---|---|---|---|
| noc-decay-v1-A-s1 | world_001_nocturne | A | 1 | grounded_anagnorisis | 36 | 12 | 11 | 0.917 | 5 | 5 | ok |
| noc-decay-v1-A-s2 | world_001_nocturne | A | 2 | grounded_anagnorisis | 36 | 12 | 11 | 0.917 | 5 | 5.18 | ok |
| noc-decay-v1-A-s3 | world_001_nocturne | A | 3 | grounded_anagnorisis | 35 | 12 | 11 | 0.917 | 8 | 4 | ok |
| noc-decay-v1-B-s1 | world_001_nocturne | B | 1 | aporia | 39 | 4 | 2 | 0.500 | 0 | 14.5 | ok |
| noc-decay-v1-B-s2 | world_001_nocturne | B | 2 | aporia | 39 | 5 | 3 | 0.600 | 0 | 11 | ok |
| noc-decay-v1-B-s3 | world_001_nocturne | B | 3 | disengagement | 39 | 4 | 2 | 0.500 | 0 | 1 | ok |
| wit-decay-v1-A-s1 | world_004_withercombe | A | 1 | grounded_anagnorisis | 21 | 9 | 8 | 0.889 | 6 | 2.13 | ok |
| wit-decay-v1-A-s2 | world_004_withercombe | A | 2 | disengagement | 11 | 6 | 4 | 0.667 | 2 | 1.5 | ok |
| wit-decay-v1-A-s3 | world_004_withercombe | A | 3 | disengagement | 11 | 6 | 4 | 0.667 | 2 | 1.5 | ok |
| wit-decay-v1-B-s1 | world_004_withercombe | B | 1 | disengagement | 7 | 2 | 0 | 0.000 | 0 | — | ok |
| wit-decay-v1-B-s2 | world_004_withercombe | B | 2 | disengagement | 7 | 2 | 0 | 0.000 | 0 | — | ok |
| wit-decay-v1-B-s3 | world_004_withercombe | B | 3 | disengagement | 7 | 2 | 0 | 0.000 | 0 | — | ok |

## Tutor repairs, classified (selection signature §5)

| run | arm | premise | decay→repair | latency | last release at repair | non-lastRelease | critical | SELECTED |
|---|---|---|---|---|---|---|---|---|
| noc-decay-v1-A-s1 | A | m_style | t4→t5 | 1 | m_style | no | no | no |
| noc-decay-v1-A-s1 | A | m_style | t6→t7 | 1 | p_watermark | yes | no | no |
| noc-decay-v1-A-s1 | A | p_watermark | t7→t8 | 1 | p_watermark | no | yes | no |
| noc-decay-v1-A-s1 | A | p_watermark | t9→t15 | 6 | p_porter | yes | yes | **yes** |
| noc-decay-v1-A-s1 | A | m_style | t10→t11 | 1 | p_stock | yes | no | no |
| noc-decay-v1-A-s1 | A | p_stock | t11→t13 | 2 | m_away | yes | yes | **yes** |
| noc-decay-v1-A-s1 | A | m_style | t13→t22 | 9 | p_heardOnly | yes | no | no |
| noc-decay-v1-A-s1 | A | p_stock | t15→t19 | 4 | p_quotes | yes | yes | **yes** |
| noc-decay-v1-A-s1 | A | p_watermark | t19→t36 | 17 | p_hand | yes | yes | **yes** |
| noc-decay-v1-A-s1 | A | p_stock | t22→t24 | 2 | m_guest | yes | yes | **yes** |
| noc-decay-v1-A-s1 | A | m_style | t24→t35 | 11 | p_hand | yes | no | no |
| noc-decay-v1-A-s2 | A | m_style | t4→t5 | 1 | m_style | no | no | no |
| noc-decay-v1-A-s2 | A | m_style | t6→t11 | 5 | p_stock | yes | no | no |
| noc-decay-v1-A-s2 | A | p_watermark | t7→t8 | 1 | p_watermark | no | yes | no |
| noc-decay-v1-A-s2 | A | p_watermark | t9→t10 | 1 | p_stock | yes | yes | **yes** |
| noc-decay-v1-A-s2 | A | p_watermark | t11→t13 | 2 | m_away | yes | yes | **yes** |
| noc-decay-v1-A-s2 | A | p_stock | t11→t12 | 1 | m_away | yes | yes | **yes** |
| noc-decay-v1-A-s2 | A | m_style | t12→t33 | 21 | p_hand | yes | no | no |
| noc-decay-v1-A-s2 | A | m_away | t13→t16 | 3 | p_porter | yes | no | no |
| noc-decay-v1-A-s2 | A | p_watermark | t16→t36 | 20 | p_hand | yes | yes | **yes** |
| noc-decay-v1-A-s2 | A | m_away | t33→t34 | 1 | p_hand | yes | no | no |
| noc-decay-v1-A-s2 | A | p_stock | t34→t35 | 1 | p_hand | yes | yes | **yes** |
| noc-decay-v1-A-s3 | A | p_watermark | t7→t8 | 1 | p_watermark | no | yes | no |
| noc-decay-v1-A-s3 | A | p_watermark | t9→t10 | 1 | p_stock | yes | yes | **yes** |
| noc-decay-v1-A-s3 | A | p_stock | t10→t11 | 1 | p_stock | no | yes | no |
| noc-decay-v1-A-s3 | A | p_watermark | t11→t12 | 1 | m_away | yes | yes | **yes** |
| noc-decay-v1-A-s3 | A | p_watermark | t13→t15 | 2 | p_porter | yes | yes | **yes** |
| noc-decay-v1-A-s3 | A | p_stock | t13→t16 | 3 | p_porter | yes | yes | **yes** |
| noc-decay-v1-A-s3 | A | m_away | t15→t23 | 8 | m_guest | yes | no | no |
| noc-decay-v1-A-s3 | A | p_watermark | t16→t22 | 6 | p_heardOnly | yes | yes | **yes** |
| noc-decay-v1-A-s3 | A | p_stock | t22→t28 | 6 | p_ward | yes | yes | **yes** |
| noc-decay-v1-A-s3 | A | p_watermark | t23→t35 | 12 | p_hand | yes | yes | **yes** |
| noc-decay-v1-A-s3 | A | p_quotes | t28→t31 | 3 | p_ledger | yes | yes | **yes** |
| noc-decay-v1-B-s1 | B | m_style | t4→t8 | 4 | p_watermark | yes | no | no |
| noc-decay-v1-B-s1 | B | m_style | t9→t34 | 25 | p_hand | yes | no | no |
| noc-decay-v1-B-s2 | B | m_style | t4→t5 | 1 | m_style | no | no | no |
| noc-decay-v1-B-s2 | B | m_style | t6→t37 | 31 | p_hand | yes | no | no |
| noc-decay-v1-B-s2 | B | p_watermark | t7→t8 | 1 | p_watermark | no | yes | no |
| noc-decay-v1-B-s3 | B | m_style | t4→t5 | 1 | m_style | no | no | no |
| noc-decay-v1-B-s3 | B | p_watermark | t7→t8 | 1 | p_watermark | no | yes | no |
| wit-decay-v1-A-s1 | A | m_taint | t3→t5 | 2 | p_course | yes | no | no |
| wit-decay-v1-A-s1 | A | p_course | t5→t6 | 1 | p_lore | yes | yes | **yes** |
| wit-decay-v1-A-s1 | A | m_taint | t6→t7 | 1 | p_lore | yes | no | no |
| wit-decay-v1-A-s1 | A | p_course | t8→t9 | 1 | p_rill | yes | yes | **yes** |
| wit-decay-v1-A-s1 | A | p_lore | t9→t15 | 6 | m_drain | yes | yes | **yes** |
| wit-decay-v1-A-s1 | A | p_course | t15→t17 | 2 | p_residue | yes | yes | **yes** |
| wit-decay-v1-A-s1 | A | p_lore | t17→t18 | 1 | p_residue | yes | yes | **yes** |
| wit-decay-v1-A-s1 | A | p_course | t18→t21 | 3 | p_brought | yes | yes | **yes** |
| wit-decay-v1-A-s2 | A | m_taint | t3→t5 | 2 | p_course | yes | no | no |
| wit-decay-v1-A-s2 | A | p_course | t5→t6 | 1 | p_lore | yes | yes | **yes** |
| wit-decay-v1-A-s2 | A | m_taint | t6→t7 | 1 | p_lore | yes | no | no |
| wit-decay-v1-A-s2 | A | p_course | t7→t9 | 2 | p_rill | yes | yes | **yes** |
| wit-decay-v1-A-s3 | A | m_taint | t3→t5 | 2 | p_course | yes | no | no |
| wit-decay-v1-A-s3 | A | p_course | t5→t6 | 1 | p_lore | yes | yes | **yes** |
| wit-decay-v1-A-s3 | A | m_taint | t6→t7 | 1 | p_lore | yes | no | no |
| wit-decay-v1-A-s3 | A | p_course | t7→t9 | 2 | p_rill | yes | yes | **yes** |

## Pooled endpoints

| arm | runs | decay events | tutor repairs | pooled per-slip | cross-check | selected | decay/run | repairs/run | successes | stall-ended |
|---|---|---|---|---|---|---|---|---|---|---|
| A (told) | 6 | 57 | 49 | 0.860 | 0.860 | 28 | 9.5 | 8.17 | 4 | 2 |
| B (conduct) | 6 | 19 | 7 | 0.368 | 0.368 | 0 | 3.17 | 1.17 | 0 | 6 |

anchors (§4): incidental floor 0.33 · surfing 0.58 (decay/run 2.4) · eager decay/run ≈19–21

## Hypotheses (registration §6)

- **H1a** (arm-A pooled rate ≥ 0.66): rate 0.860 → PASS
- **H1b** (selected ≥ 1/run and ≥ 50% of repairs): 4.67/run, share 57% → PASS
- **H1** (arm A uses the channel): **SUPPORTED**
- **H2** (one-sided, B < A): A 0.860 vs B 0.368, gap +0.491 — direction consistent with H2; bootstrap 95% CI [0.313, 0.746] (10000 run-level resamples, seed 20260611); share of resamples with gap < 0: 0
  registered reading: B ≈ A is the fifth explicit-channel-redundancy result, reported with equal prominence; B > A at meaningful size triggers a G3 re-audit before interpretation.
- **H3** (exploratory parsimony): decay/run A 9.5, B 3.17 vs surfing 2.4 and eager ≈19–21 — descriptive only.

**VERDICT: set complete (12/12) — hypotheses adjudicated above.**
