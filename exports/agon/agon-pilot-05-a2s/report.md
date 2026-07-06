# Agon report

Runs: exports/agon/agon-pilot-05-a2s, exports/agon/agon-pilot-05-a2a, exports/agon/agon-pilot-03-xl · episodes: 13 · generated 2026-07-06T04:41:02.789Z

## Per-episode ledger

| episode | arm | turns | demo | transfer | score | win | 1st-demo turn | dodges charged | wasted probes | bounces | leaks | entropy | opp-miss | off-set probes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A0-e1 | A0 | 16 | 3 | 0 | 9 | W | 11 | 5 | 0 | 0 | 1 | 1.51 | 2 | 0 |
| A0-e2 | A0 | 16 | 2 | 1 | 7 | L | 11 | 5 | 0 | 0 | 1 | 1.00 | 0 | 0 |
| A0-e3 | A0 | 16 | 3 | 0 | 9 | W | 11 | 5 | 0 | 0 | 1 | 0.99 | 2 | 0 |
| A0-e4 | A0 | 16 | 3 | 0 | 9 | W | 11 | 5 | 0 | 0 | 1 | 1.27 | 2 | 0 |
| A1p-e1 | A1p | 16 | 3 | 1 | 10 | W | 11 | 5 | 0 | 0 | 1 | 1.00 | 0 | 0 |
| A1p-e2 | A1p | 16 | 3 | 0 | 9 | W | 12 | 5 | 0 | 0 | 0 | 1.00 | 0 | 0 |
| A1p-e3 | A1p | 16 | 3 | 1 | 10 | W | 11 | 5 | 0 | 0 | 1 | 1.00 | 0 | 0 |
| A1p-e4 | A1p | 16 | 3 | 1 | 10 | W | 11 | 5 | 0 | 0 | 1 | 1.00 | 0 | 0 |
| A2a-e1 | A2a | 16 | 3 | 0 | 9 | W | 11 | 5 | 0 | 0 | 1 | 0.99 | 2 | 0 |
| A2s-e1 | A2s | 16 | 3 | 1 | 10 | W | 11 | 5 | 0 | 0 | 1 | 1.00 | 2 | 0 |
| A2s-e2 | A2s | 16 | 3 | 0 | 9 | W | 11 | 5 | 0 | 0 | 1 | 0.99 | 2 | 0 |
| A2s-e3 | A2s | 16 | 3 | 0 | 9 | W | 11 | 5 | 0 | 0 | 1 | 0.99 | 2 | 0 |
| A2s-e4 | A2s | 16 | 3 | 0 | 9 | W | 11 | 5 | 0 | 0 | 1 | 0.99 | 2 | 0 |

(opp-miss = turns where a well-posed probe existed but the tutor did not probe; off-set = probes issued that were not well-posed. Recovered by deterministic replay; "—" = replay unavailable.)

## Per-arm aggregates

| arm | n | win rate | demo (mean±sd) | score (mean±sd) | 1st-demo turn | never-demo | dodges charged | wasted | move entropy | superego REVISE rate | opp-miss (mean) | off-set (total) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A0 | 4 | 0.75 | 2.75±0.50 | 8.50±1.00 | 11.0 | 0 | 5.00 | 0.00 | 1.19 | 0.08 | 1.50 | 0 |
| A1p | 4 | 1.00 | 3.00±0.00 | 9.75±0.50 | 11.3 | 0 | 5.00 | 0.00 | 1.00 | 0.05 | 0.00 | 0 |
| A2a | 1 | 1.00 | 3.00±— | 9.00±— | 11.0 | 0 | 5.00 | 0.00 | 0.99 | 0.00 | 2.00 | 0 |
| A2s | 4 | 1.00 | 3.00±0.00 | 9.25±0.50 | 11.0 | 0 | 5.00 | 0.00 | 0.99 | 0.09 | 2.00 | 0 |

## A1p − A0 (action-set brief vs blind; descriptive at pilot n — not a promotable claim)

- Δ demonstrations: 0.25
- Δ score: 1.25
- Δ win rate: 0.25
- Δ wasted probes: 0.00 (negative = A1p more disciplined)
- Δ dodges charged: 0.00 (positive = A1p extracts more of the budget)
- Δ opportunity misses: -1.50 (negative = A1p cashes more legal probes)
- Δ move entropy: -0.19

## A2a − A2s (action-shaped playbook vs state-shaped playbook; descriptive at pilot n — not a promotable claim)

- Δ demonstrations: 0.00
- Δ score: -0.25
- Δ win rate: 0.00
- Δ wasted probes: 0.00 (negative = A2a more disciplined)
- Δ dodges charged: 0.00 (positive = A2a extracts more of the budget)
- Δ opportunity misses: 0.00 (negative = A2a cashes more legal probes)
- Δ move entropy: -0.00

## A2a − A0 (action-shaped playbook vs blind; descriptive at pilot n — not a promotable claim)

- Δ demonstrations: 0.25
- Δ score: 0.50
- Δ win rate: 0.25
- Δ wasted probes: 0.00 (negative = A2a more disciplined)
- Δ dodges charged: 0.00 (positive = A2a extracts more of the budget)
- Δ opportunity misses: 0.50 (negative = A2a cashes more legal probes)
- Δ move entropy: -0.20

## A2s − A0 (state-shaped playbook vs blind; descriptive at pilot n — not a promotable claim)

- Δ demonstrations: 0.25
- Δ score: 0.75
- Δ win rate: 0.25
- Δ wasted probes: 0.00 (negative = A2s more disciplined)
- Δ dodges charged: 0.00 (positive = A2s extracts more of the budget)
- Δ opportunity misses: 0.50 (negative = A2s cashes more legal probes)
- Δ move entropy: -0.20
