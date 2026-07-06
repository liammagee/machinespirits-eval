# Agon report

Runs: exports/agon/agon-pilot-02-a1p, exports/agon/agon-pilot-01 · episodes: 12 · generated 2026-07-05T20:33:11.226Z

## Per-episode ledger

| episode | arm | turns | demo | transfer | score | win | 1st-demo turn | dodges charged | wasted probes | bounces | leaks | entropy | opp-miss | off-set probes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A0-e1 | A0 | 14 | 2 | 0 | 6 | W | 11 | 5 | 0 | 0 | 1 | 0.99 | 2 | 0 |
| A0-e2 | A0 | 14 | 2 | 1 | 7 | W | 11 | 5 | 0 | 0 | 1 | 1.00 | 1 | 0 |
| A0-e3 | A0 | 14 | 2 | 1 | 7 | W | 11 | 5 | 0 | 0 | 1 | 1.00 | 1 | 0 |
| A0-e4 | A0 | 14 | 2 | 1 | 7 | W | 11 | 5 | 0 | 0 | 2 | 0.99 | 2 | 0 |
| A1-e1 | A1 | 14 | 2 | 0 | 6 | W | 11 | 5 | 0 | 0 | 1 | 0.99 | 2 | 0 |
| A1-e2 | A1 | 14 | 2 | 0 | 6 | W | 11 | 5 | 0 | 0 | 1 | 0.99 | 2 | 0 |
| A1-e3 | A1 | 14 | 2 | 0 | 6 | W | 11 | 5 | 0 | 0 | 1 | 0.99 | 2 | 0 |
| A1-e4 | A1 | 14 | 1 | 0 | 2 | L | 13 | 5 | 1 | 0 | 1 | 1.30 | 1 | 1 |
| A1p-e1 | A1p | 14 | 2 | 1 | 7 | W | 11 | 5 | 0 | 0 | 1 | 1.00 | 0 | 0 |
| A1p-e2 | A1p | 14 | 2 | 2 | 8 | W | 11 | 5 | 0 | 0 | 2 | 1.00 | 0 | 0 |
| A1p-e3 | A1p | 14 | 2 | 2 | 8 | W | 11 | 5 | 0 | 0 | 2 | 1.00 | 0 | 0 |
| A1p-e4 | A1p | 14 | 2 | 1 | 7 | W | 11 | 5 | 0 | 0 | 1 | 1.00 | 0 | 0 |

(opp-miss = turns where a well-posed probe existed but the tutor did not probe; off-set = probes issued that were not well-posed. Recovered by deterministic replay; "—" = replay unavailable.)

## Per-arm aggregates

| arm | n | win rate | demo (mean±sd) | score (mean±sd) | 1st-demo turn | never-demo | dodges charged | wasted | move entropy | superego REVISE rate | opp-miss (mean) | off-set (total) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A0 | 4 | 1.00 | 2.00±0.00 | 6.75±0.50 | 11.0 | 0 | 5.00 | 0.00 | 0.99 | 0.09 | 1.50 | 0 |
| A1 | 4 | 0.75 | 1.75±0.50 | 5.00±2.00 | 11.5 | 0 | 5.00 | 0.25 | 1.06 | 0.11 | 1.75 | 1 |
| A1p | 4 | 1.00 | 2.00±0.00 | 7.50±0.58 | 11.0 | 0 | 5.00 | 0.00 | 1.00 | 0.02 | 0.00 | 0 |

## A1 − A0 (raw-state scoreboard vs blind; descriptive at pilot n — not a promotable claim)

- Δ demonstrations: -0.25
- Δ score: -1.75
- Δ win rate: -0.25
- Δ wasted probes: 0.25 (negative = A1 more disciplined)
- Δ dodges charged: 0.00 (positive = A1 extracts more of the budget)
- Δ opportunity misses: 0.25 (negative = A1 cashes more legal probes)
- Δ move entropy: 0.07

## A1p − A0 (action-set brief vs blind; descriptive at pilot n — not a promotable claim)

- Δ demonstrations: 0.00
- Δ score: 0.75
- Δ win rate: 0.00
- Δ wasted probes: 0.00 (negative = A1p more disciplined)
- Δ dodges charged: 0.00 (positive = A1p extracts more of the budget)
- Δ opportunity misses: -1.50 (negative = A1p cashes more legal probes)
- Δ move entropy: 0.01

## A1p − A1 (action-set brief vs raw-state scoreboard; descriptive at pilot n — not a promotable claim)

- Δ demonstrations: 0.25
- Δ score: 2.50
- Δ win rate: 0.25
- Δ wasted probes: -0.25 (negative = A1p more disciplined)
- Δ dodges charged: 0.00 (positive = A1p extracts more of the budget)
- Δ opportunity misses: -1.75 (negative = A1p cashes more legal probes)
- Δ move entropy: -0.06
