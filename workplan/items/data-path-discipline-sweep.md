---
id: data-path-discipline-sweep
title: "Path-discipline sweep: DB, logs, exports, and archive resolvers everywhere"
status: done
type: maintenance
priority: P1
owner: codex
source: manual
created: 2026-08-27
updated: 2026-08-28
verification: Every listed offender opens the DB through the readonly helper or
  the canonical path resolver, honors the env overrides, and takes a --db flag
  where it had none; the archive script's default resolves against the repo root
  from any working directory; no committed absolute home paths remain in
  executable code; the existing path-guard test and check script are extended to
  cover the fixed call sites so none of it regresses; frozen pre-registered
  scripts pinned by sealed manifests are left byte-identical.
claim_status: methods
links:
  notes:
    - services/evaluationDataPaths.js
    - services/evaluationDbReadonly.js
    - scripts/check-evaluation-data-paths.js
  prs:
    - 835
tags:
  - data-paths
  - hermetic
  - codex-sol
  - effort-xhigh
branch: codex/data-path-discipline-sweep
---

Compliance with the read-path rule is high but the stragglers form clean
clusters:

- Nine analysis scripts (the analyze-d1 family plus analyze-recognition-lexicon
  and analyze-text-behaviors) resolve `data/evaluations.db` by hand, ignore
  `EVAL_DB_PATH`, and have no `--db` flag — in a worktree they silently read
  the production DB.
- Three services (pilotStore.js:38, poeticsStore.js:12, the legacy-chat
  compatibility router:124) reimplement the DB fallback and skip the data-home
  branch of the canonical resolver. A symlink masks this on the main machine;
  a fresh clone or worktree opens a different file from the evaluation store.
  pilotStore also creates its DB at import time, as a side effect.
- The archive script's default (`archive-run-artifacts.js:52`) resolves the
  private-archive path against the process working directory, and it already
  imports the correct resolver without using it. Three replay/steering scripts
  commit absolute `/Users/lmagee/...` constants.
- One poetics service (liveCompose.js:703) writes into the source tree past
  the exports override its sibling job runner honors; the a19 adjudication
  panel stops one fallback short of the standard exports chain.

Fix the lot, then extend the existing guard test and check script so the rule
is enforced, not just documented. Do not touch scripts whose bytes are pinned
by sealed study manifests — list any such conflict instead of editing it.

Suggested worker: Codex Sol at Extra High reasoning effort.

2026-08-28 Codex: Centralized the remaining analysis, pilot, poetics,
legacy-chat, transcript, archive, and replay path defaults. All nine named
analysis readers now honor the canonical DB chain plus `--db`; pilot persistence
opens lazily; live-compose and A19 inherit `EVAL_EXPORTS_DIR`; and archive/replay
defaults are repository- or archive-relative. The sealed adaptive-warrant
steering script and the first-draft historical evidence ledger remain
byte-identical and are explicit guard exceptions.

Verification: 121 focused data-path/A19/archive/live-compose/poetics/legacy-chat
checks pass; 57 pilot, resistant-learner registration, and sealed steering
checks pass; `npm run lint`, `npm run format:check`,
`node scripts/check-evaluation-data-paths.js`, `npm run wp:source-check`, and
`git diff --check` pass.

2026-08-28 Closeout: PR #835 merged to `main`; its replacement hosted run
passed the hermetic contract, all four Node test shards, lint, risk coverage,
PTY/loopback concurrency, validation, and workplan checks.
