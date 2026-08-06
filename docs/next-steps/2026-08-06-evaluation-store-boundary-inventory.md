# Evaluation-store boundary inventory

Date: 2026-08-06

Branch: `codex/refactor-evaluation-store-boundary-inventory`

Workplan item: `refactor-evaluation-store-boundary-inventory`

## Purpose

This is the R4 step 5 characterization checkpoint. It does not split or alter
`services/evaluationStore.js`. It makes the current compatibility boundary
executable so the persistence split can proceed without silently losing a
consumer, changing package resolution, or moving database bootstrap too early.

The machine-readable authority is
`config/evaluation-store-boundary-inventory.json`; run
`npm run eval-store:boundary-check` after changing a consumer, facade export,
or package path.

## Current boundary

At the pre-slice checkpoint, `services/evaluationStore.js` is 3,437 lines and
has 48 tracked direct consumers. The characterization test itself exercises the
file facade in a child process, so the committed ratchet contains 49:

| Consumer class | Count | Migration meaning |
|---|---:|---|
| Package root | 1 | `index.js` eagerly re-exports the store namespace. |
| Application runtime | 4 | The eval routes, standard runner, and two adaptive-tutor modules import the facade. |
| Operational scripts | 25 | Evaluation, scoring, reports, pilots, smoke tools, and data scripts depend on the facade or its bootstrap. |
| Archived one-offs | 4 | Historical scripts retain references but currently point at a non-existent archive-relative target; do not treat them as live hosts. |
| Tests | 15 | Tests use named, default, namespace, and deferred imports, often to set `EVAL_DB_PATH` first; this includes the new boundary smoke. |

Thirty files are therefore live application, operational, or package
consumers. Across all 49 files there are 25 namespace imports, 18 dynamic
imports, three named imports, two default imports, and one namespace re-export.

The facade has 44 named function exports and 41 members on its legacy default
object. `updateResultTutorScores`, `updateResultTutorCharismaScores`, and
`updateResultTutorRegisterScore` are named-only. That asymmetry is now pinned;
the persistence split must preserve it until a deliberate compatibility change
has its own consumer proof.

## Import-time contract

Importing the facade currently:

1. resolves the database from `EVAL_DB_PATH`, falling back to the repository
   `data/evaluations.db`;
2. recursively creates the database parent directory;
3. opens SQLite and selects WAL journal mode;
4. creates and migrates the evaluation schema immediately; and
5. leaves one module-scoped connection serving all repository functions.

The hermetic characterization test pins the five current tables:
`evaluation_results`, `evaluation_runs`, `interaction_evaluations`,
`score_audit`, and SQLite's `sqlite_sequence`. It also imports the store through
the package root, the `./services/*` export, and the file facade, proving that
all three paths resolve to the same function bindings.

One operational script, `scripts/grade-adaptive-dialogue.js`, imports the store
only to run migrations before opening a second direct SQLite connection. It is
the clearest import-time side-effect dependency and should be the first host
given an explicit migration/bootstrap call.

## Ordered R4 step 6 split

Keep `services/evaluationStore.js` as the unchanged compatibility facade while
moving implementation in this order:

1. **Connection and migrations.** Introduce an internal connection owner and
   migration runner. The facade must still call it at import time during this
   step; explicit startup is a later host migration.
2. **Run repository.** Move run create/update/list/complete, stale-run recovery,
   and incomplete-test accounting together.
3. **Result repository.** Move result persistence, rejudgment, score updates,
   provenance mapping, cloning, and score audit as one round-trip-sensitive
   family.
4. **Interaction repository.** Move interaction-evaluation CRUD and learner
   score updates without changing tutor/learner data symmetry.
5. **Projections and statistics.** Move row parsing, generation identity,
   run/scenario/factorial statistics, and configuration comparison behind
   explicit repository inputs.
6. **Exporters and dialogue-log readers.** Move JSON/CSV projections and
   mutable/immutable log loading last, after their result shapes are pinned.

Each extraction must leave named and default facade binding behavior intact and
run the boundary audit plus the existing store round-trip, scoring, resume, and
package gates.

## Host migration after the split

Move callers to explicit dependencies by cohort, with a separate parity gate
for each:

1. `evaluationRunner` and the eval CLI dependency adapter;
2. adaptive-tutor index and persistence;
3. `evalRoutes` and mounted application startup;
4. operational scripts, beginning with the migration-only adaptive grader;
5. package consumers, while retaining a deprecated facade path for external
   callers through at least one release boundary.

Do not remove import-time bootstrap merely because the internal files have
split. R4 step 8 begins only when the live/package direct-import inventory has
been driven to its explicitly approved compatibility remainder, every host has
an explicit connection lifecycle, and a packed-package smoke test proves the
new startup contract. The four broken archived references should be repaired
or declared permanently non-runnable under a separate archive-maintenance
decision; they are not blockers for live-host migration.
