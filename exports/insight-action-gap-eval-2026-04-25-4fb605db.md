# Insight-Action Gap (D3)

**Runs analyzed:** eval-2026-04-25-4fb605db
**Cells with ≥5 reflection-action pairs:** 2 (0 skipped)

## What this measures

- **Coupling** — cosine similarity between a turn's `ego_self_reflection` text and the same turn's final tutor message. High = reflection themes show up in the action.
- **Gap** — `1 − Coupling`. Big numbers mean the insight stayed cognitive.
- **Turn drift** — cosine distance between consecutive final tutor messages on the same dialogue. The "how much does the tutor change between turns at all" baseline.
- **Gap − Drift** — diagnostic. If ≈ 0, reflection content is no more present in next-turn behavior than any neighbouring turn would be (i.e. reflection adds no special coupling).
- **EoQ%** — fraction of `actionMessage` ending in `?`. The sibling D1 fifth-pass found `ends-with-question` is the sole within-cell mediator of the orientation-family effect (commits e8dc7a8 / 3c9eaa6 / c334722); reporting it here lets cross-checking of whether D3 architectural bridges shift the same channel.

## Per-cell summary

| Cell | Cond | N pairs | Coupling (cos) | Coupling (Jaccard) | Gap | Turn drift | Gap−Drift | EoQ% |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| cell_40_base_dialectical_suspicious_unified_superego | base | 159 | 0.601 | 0.115 | 0.399 | 0.292 | 0.107 | 20% |
| cell_97_base_dialectical_suspicious_unified_directive | base | 158 | 0.608 | 0.117 | 0.392 | 0.284 | 0.108 | 20% |

## How to read

A small **Gap** with a large **Turn drift** is the strongest evidence the reflection shaped behavior — the tutor changes between turns *and* the change tracks the reflection. A large **Gap − Drift** says reflection content is no more present in next-turn behavior than a neighbouring turn would be: awareness without coupling. Compare across cells to see which mechanisms (suspicious vs adversary vs advocate; base vs recog) actually narrow the gap.