---
id: eval-logs-root-rule-copies
title: Twenty scripts each carried their own copy of the logs-root rule
status: done
type: infra
priority: P2
owner: claude
source: manual
created: 2026-08-08
updated: 2026-08-08
branch: unify-logs-root-resolver
verification: An analysis script run from a git worktree reads the same dialogue traces it reads from the main checkout. Pinned by tests/evaluationLogsPathAgreement.test.js — the order itself, a source scan that fails if any script resolves the root on its own again (proved by reintroducing a copy in both languages), and four cases run through both the JavaScript rule and its Python mirror.
claim_status: methods
links:
  items:
    - eval-db-writer-reader-path-split
    - sarcasm-precondition-claim-bearing-mood
depends_on:
  - eval-db-writer-reader-path-split
tags:
  - infra
  - data-integrity
  - worktrees
---

`eval-db-writer-reader-path-split` fixed the database path and recorded that
"dialogue logs were unaffected — `LOGS_ROOT` resolves correctly." That was
wrong. It looked right because the check was run from the main checkout, where
`logs` is a symlink to `~/.machinespirits-data/logs`, so a script that resolves
`<checkout>/logs` follows the link and finds everything. A worktree has no such
link. From this one, `logs/tutor-dialogues` held **0** files and the archive
held **49,014**.

Twenty files carried their own version of the rule and none of them mentioned
the archive:

- eleven analysis scripts with `path.join(process.env.EVAL_LOGS_DIR || path.join(REPO_ROOT, 'logs'), 'tutor-dialogues')`,
- two that used `process.cwd()` in place of the repo root,
- four that had each independently noticed the archive problem and written
  their own candidate list — no two the same, which is the clearest evidence
  the rule needed one home,
- one with a bare relative `./logs/eval-progress/`,
- `services/progressLogger.js` and `services/adaptiveTutor/persistence.js`,
  both writers, which is what made this a writer/reader split and not merely a
  reader bug,
- three Python scripts, which cannot import the JavaScript at all.

Twelve of them carried a matching `EVAL_DB_PATH || <root>/data/evaluations.db`
copy on the adjacent line, with the same symlink coincidence holding it up.
Those are fixed here too: leaving half of a script repaired leaves the script
broken.

The shared order now lives once, in `services/evaluationDataPaths.js` —
explicit `EVAL_LOGS_DIR`, then a handed-over run folder's own `logs/`, then the
archive, then the checkout. `resolveEvaluationLogsRoot` is its first element.
Readers that legitimately *search* rather than resolve get the whole list from
`resolveTutorDialoguesDirCandidates`, so a script with a genuinely extra root
(a sibling private checkout, a second pinned runtime) appends to the shared list
instead of restating it.

Python gets a mirror, `scripts/lib/eval_data_paths.py`, because it has no other
option. A mirror is a copy and a copy is the whole defect, so the test runs both
implementations over the same four cases and fails if they diverge.

No run, no re-judging, no published number moves. Nothing was *scored* wrong —
the failure mode is a script reporting no data, not a script reporting bad data.
What it cost was the assumption, on the card above, that this half was already
fine.

Left open, and not silently: twelve further files carry only the database copy
(`analyze-a10-nemotron-replication.js`, `analyze-a7-longitudinal.js`,
`analyze-d4-disposition-gradient.js`, `analyze-recognition-definitions.js`,
`analyze-rubric-pca.js`, `analyze-rubric-sensitivity.js`,
`package-poetics-run.js`, `replay-discursive-transcript.js`,
`run-discursive-replay-loop.js`, `stage-poetics-deploy-db.mjs`,
`services/legacyChatCompatibilityRouter.js`, `services/pilotStore.js`,
`services/poeticsStore.js`, plus one under `scripts/archive/`). They are the
same class, and they belong with the read-path discipline already documented in
`CLAUDE.md` (`openEvaluationDbReadonly`), which is a larger per-file change than
swapping a constant. Card them there rather than half-doing them here.
