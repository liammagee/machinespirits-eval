---
name: ms-query-db
description: Answer a narrow, read-only question about evaluation results or run metadata with explicit SQLite. Use for ad hoc database facts and cross-run comparisons; use ms-analyze-run for a standard run summary and ms-deep-dive for transcripts or qualitative interpretation.
---

# Query Evaluation Database

Query `data/evaluations.db` read-only. Do not rely on a schema snapshot in this
skill.

## Workflow

1. Inspect `services/evaluationStore/migrations.js` and/or live schema:

   ```bash
   sqlite3 -readonly data/evaluations.db "PRAGMA table_info(evaluation_results);"
   ```

2. Resolve run shorthand to one exact ID before the substantive query. Report
   ambiguity rather than selecting the newest match silently.
3. Resolve numeric cells against mapping keys in `config/tutor-agents.yaml`.
   For historical/canonical cell 1 matching, use:

   ```sql
   profile_name = 'cell_1' OR profile_name GLOB 'cell_1_*'
   ```

   Never use `LIKE 'cell_1%'`, which also matches cells 10–19 and 100–199.
4. For scored comparisons, filter and group by the relevant judge model and
   tutor/learner/dialogue rubric version. Do not average across versions by
   accident.
5. Treat factor columns according to their live storage types. Do not assume
   boolean factors are text labels or that `scenario_type` encodes
   single-versus-multi-turn.
6. Use `json_extract` only after checking JSON validity and the current stored
   shape. Query public outcomes separately from private deliberation fields.

## Safety and interpretation

- Use `sqlite3 -readonly`; never run `UPDATE`, `DELETE`, migrations, or
  `evaluate --force` from this skill.
- Never recompute historical scores or translate missing historical
  measurements into false/null claims.
- Report counts and missingness before means.
- Treat mixed judges, mixed rubrics, config-hash drift, failed rows, and missing
  transcripts as provenance limitations.
- Inter-judge reliability requires the same response scored by different
  judges, matched on content—not merely similar cells.

Return the answer, exact SQL, DB path, lane filters, row count, and any
ambiguity or provenance caveat.
