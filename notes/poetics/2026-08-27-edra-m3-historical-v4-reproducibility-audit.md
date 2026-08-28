# EDRA-M3 historical-v4 reproducibility audit

Date: 2026-08-27

Workplan item: `edra-m3-second-mechanism-lexicon`

Scope: read-only evidence inventory; no generation, judging, score mutation, or
historical recomputation

## Question

Can the May 2026 matched-pair result for
`phase2-adaptation-recognition-loop-20260529T023023Z-i01` through `i03` be
reproduced exactly after the semantic-v5 measurement change?

The contemporaneous report recorded 9 valid D42/D50/D53 pairs, 3 positive and
6 null, recognitive-closure lift 0.333, Wilson95 [0.12, 0.65], and zero control
leaks. Exact reproduction requires either the emitted `item_gates.jsonl` used
for that aggregate or the complete `tutor-adaptation-v4` rows from which those
gates were derived.

## Preserved substrate

Read-only queries against the canonical database at
`~/.machinespirits-data/evaluations.db` found:

- 27 `poetics_items` rows for the three runs (3 iterations × 3 dramas × 3 arms);
- 104 `poetics_scores` rows (36 in iterations i01 and i02, 32 in i03); and
- 0 matching `poetics_tutor_adaptations` rows, including 0 rows under analyzer
  version `tutor-adaptation-v4`.

The immutable database snapshot contains the same 27 items and no adaptation
rows. The item records retain paths and paired-prefix metadata, but the pointed
run directories and the cited aggregate `exports/paired-codex-20260529-full.json`
are no longer present. Repository history, current local project storage,
recorded Claude task outputs, and unreachable Git commits contain references to
the reported aggregate but no copy of the emitted item-gate file.

The database inventory is reproducible with read-only SQL:

```sql
SELECT COUNT(*)
FROM poetics_items
WHERE run_id IN (
  'phase2-adaptation-recognition-loop-20260529T023023Z-i01',
  'phase2-adaptation-recognition-loop-20260529T023023Z-i02',
  'phase2-adaptation-recognition-loop-20260529T023023Z-i03'
);

SELECT COUNT(*)
FROM poetics_scores s
JOIN poetics_items i ON i.id = s.item_id
WHERE i.run_id IN (
  'phase2-adaptation-recognition-loop-20260529T023023Z-i01',
  'phase2-adaptation-recognition-loop-20260529T023023Z-i02',
  'phase2-adaptation-recognition-loop-20260529T023023Z-i03'
);

SELECT
  COUNT(*) AS adaptations_total,
  SUM(CASE WHEN a.analyzer_version = 'tutor-adaptation-v4' THEN 1 ELSE 0 END)
    AS v4_adaptations
FROM poetics_tutor_adaptations a
JOIN poetics_items i ON i.id = a.item_id
WHERE i.run_id IN (
  'phase2-adaptation-recognition-loop-20260529T023023Z-i01',
  'phase2-adaptation-recognition-loop-20260529T023023Z-i02',
  'phase2-adaptation-recognition-loop-20260529T023023Z-i03'
);
```

## Disposition

The published 0.333 value is a historical reported result, not an aggregate
that is currently computationally reproducible from the preserved substrate.
That provenance gap does not demonstrate that the original aggregate was
wrong; it means the present repository cannot independently verify it. Treating
the absent adaptation measurements as `false` would manufacture a 0/9 null and
is therefore prohibited.

`aggregate-poetics-paired-increment.js --historical-v4` now fails before writing
an aggregate or new item-gate export when any expected v4 measurement is
missing. If the original item-gate file is recovered, it can be reaggregated
without scoring or database mutation via `--historical-v4 --item-gates-in FILE`;
the output records the source file's SHA-256 and labels its use
`historical_reproduction_only`.

The exact 3-positive/6-null arithmetic is retained as a synthetic contract test
for the gate-file reader. It verifies the aggregator, not the missing empirical
substrate. Prospective semantic-v5 results remain a separate create-once path;
they cannot replace, overwrite, or retrospectively validate v4 evidence.
