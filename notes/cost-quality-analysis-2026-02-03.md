# Cost/Quality Tradeoff Analysis

Date: 2026-02-03
Data: 2,120 results across all completed runs (all cells, all scenarios)

## Cost-per-point by factorial cell

| Cell | n | Avg Score | Avg Cost | Cost/Point | Avg Input Tok | Avg Rounds | Avg Calls |
|------|---|-----------|----------|------------|---------------|------------|-----------|
| cell_6_recog_single_psycho | 203 | 69.0 | $0.0140 | **$0.000202** | 21,823 | 0.2 | 2.0 |
| cell_5_recog_single_unified | 203 | 65.3 | $0.0148 | $0.000227 | 22,222 | 0.3 | 2.1 |
| cell_1_base_single_unified | 211 | 44.1 | $0.0119 | $0.000269 | 20,680 | 0.3 | 2.1 |
| cell_2_base_single_psycho | 204 | 43.3 | $0.0121 | $0.000280 | 21,911 | 0.3 | 2.7 |
| cell_7_recog_multi_unified | 193 | 78.9 | $0.0264 | $0.000335 | 43,366 | 2.0 | 4.9 |
| cell_8_recog_multi_psycho | 194 | 80.7 | $0.0295 | $0.000365 | 44,184 | 2.1 | 5.0 |
| cell_3_base_multi_unified | 204 | 47.7 | $0.0182 | $0.000381 | 29,620 | 1.8 | 3.3 |
| cell_4_base_multi_psycho | 201 | 45.4 | $0.0187 | $0.000412 | 31,180 | 1.8 | 4.0 |

Sorted by cost-per-point (most efficient first). Cell 6 (recognition + single-agent +
ego_superego learner) is the most cost-efficient configuration.

## Efficient frontier: is multi-agent worth it?

| Group | n | Avg Score | Avg Cost | Cost/Point |
|-------|---|-----------|----------|------------|
| Single-agent recognition (5+6) | 406 | 67.2 | $0.0144 | $0.000214 |
| Multi-agent recognition (7+8) | 387 | 79.8 | $0.0280 | $0.000350 |

Direct comparison:

- Score delta: **+12.6 points** (67.2 → 79.8)
- Cost delta: **+$0.0136 per eval (+94%)**
- Token delta: **+21,754 input tokens (+99%)**
- Marginal cost per point: **$0.0011/point**

Multi-agent nearly doubles cost for +12.6 points. Each additional point costs
$0.0011 — whether that's worth it depends on the quality threshold. If 67 is
acceptable, single-agent recognition is the clear winner on efficiency. If the
target is 80+, multi-agent is currently the only path.

## Base prompt multi-agent is poor value

| Group | n | Avg Score | Avg Cost | Cost/Point |
|-------|---|-----------|----------|------------|
| Single-agent base (1+2) | 415 | 43.7 | $0.0120 | $0.000274 |
| Multi-agent base (3+4) | 405 | 46.6 | $0.0184 | $0.000396 |

Multi-agent adds only +2.9 points for +53% cost. The superego catches some generic
fallbacks but the base prompt doesn't give the ego enough to work with on revision.
Without recognition-enhanced prompts, the multi-agent loop is poor ROI.

## Key takeaway

The cost-efficiency ranking is:

1. **Best ROI: cell_6** (recognition + single + psycho learner) — $0.000202/point
2. **Highest quality: cell_8** (recognition + multi + psycho learner) — 80.7 avg but $0.000365/point
3. **Worst ROI: cell_4** (base + multi + psycho learner) — $0.000412/point for only 45.4 avg

The recognition prompt is both the cheapest and most effective intervention.
Multi-agent is a premium feature that makes sense only when paired with recognition
prompts and when the quality target demands it.
