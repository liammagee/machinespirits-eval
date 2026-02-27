# Rubric Version Archive — Backfill Strategy

When a rubric file did not exist at a given version, it was backfilled from
the **next-oldest version** that contains it. This means scores from backfilled
rubrics will be identical across versions where the file didn't originally exist
— only rubrics that actually changed between versions will produce different scores.

## Version sources

| Version | Git source | Description |
|---------|-----------|-------------|
| v1.0 | `53b614d` (parent of `9a1d2fd`) | Pre-overhaul: original dimensions, original weights |
| v2.0 | `9a1d2fd` (Feb 26 16:35 AEDT) | Dimension overhaul: restructured dims, new weights, cross-turn calibration |
| v2.1 | `6624237` (Feb 27 13:22 AEDT) | Public-only output scoring + deliberation rubric |
| v2.2 | Untracked files (Feb 27) | Latest revision |

## Backfill map

| File | v1.0 | v2.0 | v2.1 | v2.2 |
|------|------|------|------|------|
| tutor per-turn | native | native | native | native |
| learner | native | native | native | native |
| tutor-holistic | native | native | native | native |
| dialogue | native | native | native | native |
| deliberation | **v2.1** | **v2.1** | native | native |

"native" = extracted from that version's git commit.
**bold** = backfilled from the indicated version (file did not exist at this version).

## Implication for cross-version comparison

- Deliberation scores will be identical for v1.0, v2.0, and v2.1 (all use v2.1 rubric)
- Deliberation scores may differ for v2.2 if the deliberation rubric changed
- All other scoring dimensions will reflect genuine rubric differences per version
- Version fields in all YAML files are normalized to match directory name (e.g. "1.0")
