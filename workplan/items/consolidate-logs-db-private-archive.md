---
id: consolidate-logs-db-private-archive
title: Consolidate dialogue logs + DB into one canonical archive
status: done
type: infra
priority: P2
owner: codex
source: manual
created: 2026-06-22
updated: 2026-06-28
verification: From a fresh worktree, evaluationStore resolves LOGS_ROOT to
  ~/.machinespirits-data/logs (now a materialized real dir, not a symlink) and the
  paper2.provenance.dialogue_hashes gate scores value=1.0 (1937 passed, 0 failed, 54
  waived) against the canonical DB + archive. The two named follow-ups (non-git
  decoupling + orphan quarantine) are DONE; only minor/maintainer items remain.
links:
  items:
    - build-workplan-tooling
    - normalize-provenance-validator-data-paths
    - colocate-runner-secondary-artifacts
    - debloat-private-log-archive
tags:
  - infra
  - provenance
  - logs
  - archive
milestone: paper-2-evidence-cleanup
---

**Reopened 2026-06-27** (was marked `done` 2026-06-24, but the problem recurs and
the verification does not hold).

## Implemented 2026-06-27 — decision (A), the recurrence-killer + coverage

(A) chosen: filesystem beside the DB. **Code fix landed** (`services/evaluationStore.js`):
`LOGS_ROOT` now resolves `EVAL_LOGS_DIR` → `<DATA_HOME>/logs` (`DATA_HOME = MS_DATA_HOME ||
~/.machinespirits-data`, when present) → `<repo>/logs` fallback. So **any worktree finds the
canonical logs without a per-worktree symlink** — the recurrence is killed at the writer
(evaluationStore writes the dialogue logs; the runner delegates to it). All three branches
verified; the `EVAL_LOGS_DIR` override (CI / hermetic / desktop) and the website shallow-clone
fallback are preserved.

**Coverage measured** (canonical DB ↔ archive): **3,316 / 3,371** distinct
`dialogue_content_hash` (**98.4%**) are already in the archive (`machinespirits-eval-private/logs`,
reached via the `~/.machinespirits-data/logs` symlink) — above the 0.95 `dialogue_hashes`
threshold, so the code fix alone makes provenance pass. **No union needed:** the scattered
worktree logs (tutor-core 5.9k, etc.) belong to other/local DBs and do not improve canonical
coverage. **55 orphans (1.6%)** are genuine transcript loss — recent runs whose logs went to
tmp/cleaned paths; un-verifiable, to be quarantined rather than chased.

## Both named follow-ups DONE 2026-06-28

- **Non-git decoupling — DONE (materialized).** `~/.machinespirits-data/logs` was a symlink →
  `machinespirits-eval-private/logs`; it is now a **real directory** (rsync -a of the 49,984-file
  / ~7 GB tree from the symlink target → `logs.real`, count-verified, atomic swap: `rm` the
  symlink + `mv` the copy into place). The private repo's `logs/` is **untouched** (reversible:
  `rm -rf ~/.machinespirits-data/logs && ln -s <private>/logs ~/.machinespirits-data/logs`). New
  logs now land in the real dir (non-git), and Syncthing can carry the content — a symlink
  pointing outside the shared folder would not have synced. The historical 6.9 GB in the private
  repo's git history remains the splittable de-bloat (history rewrite / LFS), deferred to the
  maintainer.
- **Orphan quarantine — DONE (waiver).** The authoritative logless set is **54 dialogues, all from
  `eval-2026-06-24-250c6251`** (the cited D4 SEL disposition-gradient run, cells 40-45). Verified
  2026-06-28 as genuine, permanent loss — not recoverable in any worktree by dialogue_id OR
  content_hash. (The earlier "55" was content-hash-keyed; one of those rows' `{dialogue_id}.json`
  actually exists, so it is not a `log_file_missing` orphan under either check.) Committed
  `config/provenance-orphan-waivers.json` enumerates them; a shared `loadOrphanWaivers()` in
  `provableDiscourse.js` is wired into both the paper gate (`evaluateProvenanceCheck`
  `dialogue_hash_match`) and `validate-provenance.js` Section 2. A waived missing log is counted
  as `waived` (reported explicitly), not `failed` — only genuine ABSENCE is waived; a hash
  MISMATCH still fails. Net effect: the paper gate moves from 0.9729 (54 silently within the 0.95
  margin) to **value=1.0, 54 waived, 0 failed** — strictly tighter (any NEW unwaived loss fails
  immediately). The D4 run's cited Δ/d stand: scores + tutor outputs are retained in the DB
  (`tutor_scores`/`suggestions`/`scores_with_reasoning`, all 144 rows) and in
  `exports/d4-sel-disposition-gradient-eval-2026-06-24-250c6251.md`; only the hash-reverifiable
  dialogue-log JSON is lost.

## Split follow-up maintenance cards 2026-06-28

The two named follow-ups are complete and the acceptance check now passes. The
remaining non-blocking cleanup has been split into standalone cards so this
consolidation item can close without hiding future maintenance work:

- `normalize-provenance-validator-data-paths` — teach provenance/manifest validators
  to honor the canonical data-home env vars instead of requiring repo-local symlinks.
- `colocate-runner-secondary-artifacts` — move runner `transcripts/` and `checkpoints/`
  writes onto the same canonical logs/data-home path.
- `debloat-private-log-archive` — decide and execute the private archive de-bloat
  path for the historical 6.9 GB log history.

Historical note: this item was reopened because the writer default had been
per-worktree and the fresh-worktree provenance gate failed. PR #64 fixed the
writer default; PR #66 materialized the data-home logs directory and documented
the 54 genuine D4 orphan-log waivers.
