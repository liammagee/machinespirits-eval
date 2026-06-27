---
id: consolidate-logs-db-private-archive
title: Consolidate dialogue logs + DB into one canonical archive
status: active
type: infra
priority: P2
owner: unassigned
source: manual
created: 2026-06-22
updated: 2026-06-28
verification: From a fresh worktree, evaluationStore resolves LOGS_ROOT to
  ~/.machinespirits-data/logs (now a materialized real dir, not a symlink) and the
  paper2.provenance.dialogue_hashes gate scores value=1.0 (1937 passed, 0 failed, 54
  waived) against the canonical DB + archive. The two named follow-ups (non-git
  decoupling + orphan quarantine) are DONE; only minor/maintainer items remain.
links:
  items: build-workplan-tooling
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

**Remaining (minor / deferred):**
- **Runner secondary artifacts** — `evaluationRunner.js` writes `transcripts/`/`checkpoints/` to
  `EVAL_ROOT/logs` (not via `LOGS_ROOT`); co-locating those is a minor follow-up (not the
  `dialogue_hashes` logs).
- **Validators hardcode repo-relative paths** — `validate-provenance.js` (`LOG_DIR`/`DB_PATH`),
  `validate-bug-claims.js`, `validate-paper-manifest.js` resolve `<repo>/logs` and
  `<repo>/data/evaluations.db`, so a fresh worktree still needs those symlinked (or `--db`) even
  though the *writer* auto-resolves. Honouring `MS_DATA_HOME`/`EVAL_DB_PATH` in the validators
  would close the last manual step.
- **Private-repo git de-bloat** — the 6.9 GB git history (history rewrite / LFS); maintainer task.

## Why it is not actually done

- The full `paper:provable-discourse` provenance check (`paper2.provenance.dialogue_hashes`)
  fails from a fresh worktree with `log_file_missing` for **all ~1,973** scored
  dialogues (observed 2026-06-27 in `machinespirits-eval-cd-deep`).
- Logs are **not** co-located with the DB. The canonical DB is `~/.machinespirits-data/evaluations.db`
  (296M) with **zero** log files beside it; the dialogue logs live in
  `machinespirits-eval-private/logs` (6.9G, **git-tracked**) and are freshly
  re-scattered across worktrees (`machinespirits-tutor-core` 516M / 5.9k files,
  `…-charisma-recognition-desire` 43M, `machinespirits-design` 99M, others).

## Root cause (structural, not a one-time tidy)

`services/evaluationStore.js:59` resolves `LOGS_ROOT = process.env.EVAL_LOGS_DIR || path.join(ROOT_DIR, 'logs')`,
and the runner writes each dialogue to `<LOGS_ROOT>/tutor-dialogues/{contentHash}.json`
(read path: `evaluationStore.js:3027`, falling back to a `{dialogueId}.json` /
partial-scan lookup). **The default is per-worktree**, so any checkout or run that
does not export `EVAL_LOGS_DIR` writes logs locally → scatter recurs. The prior
pass pointed `EVAL_LOGS_DIR` for one context but never changed the default, so it
regressed.

## What it affects (and what it does not)

- **Affected** (anything that reads transcripts, not just scores): `provenance:validate`,
  `paper:provable-discourse` (the `dialogue_hashes` check), `audit:message-chain`,
  and transcript-reading re-analysis (`analyze-mechanism-traces.js`,
  `analyze-trajectory-curves.js`, qualitative coding, rejudge passes).
- **Not affected**: paper N-counts / claims (in the DB — `validate-paper-manifest.js`
  passes 60/0/0), and new generation/scoring (writes fresh logs to the active
  `EVAL_LOGS_DIR`). The gap is the *historical* scattered logs.

## Decision to make first: where is the canonical logs home?

This is the crux; the tension is **multi-host sync vs git bloat**.

- **(A) Filesystem, beside the DB** — `~/.machinespirits-data/logs/` (non-git,
  content-hash-deduped). Makes "co-located with the DB" literally true and avoids
  6.9G-in-git. But `~/.machinespirits-data` is machine-local → **loses multi-host
  sync**.
- **(B) The private git repo** (`machinespirits-eval-private`) as the archive, with
  the DB moved there too. Keeps multi-host sync (clone → get everything) but
  git-tracking ~7.5G of logs is a bloat anti-pattern (needs git-LFS or pruning).

The private repo currently provides the (bloated) sync story; pick the home before
moving anything.

## Scope (once the home is chosen)

1. **Union-consolidate** all scattered `logs/tutor-dialogues/*.json` into the
   canonical home. Filenames are content hashes, so dedup is trivial (union by
   filename; the two largest stores already share 0 filenames). ≈ 56k files / ≈
   7.5G. Decide whether the sibling dirs (`run-manifests/`, `transcripts/`,
   `checkpoints/`, top-level `*.log`) come too — only `tutor-dialogues/` is needed
   for `dialogue_hashes`.
2. **Re-point the writer default** (`evaluationStore.js` `LOGS_ROOT`, or a global
   `EVAL_LOGS_DIR`) so new runs land in the canonical home automatically — this is
   what kills the recurrence. Preserve the hermetic/CI tmp override and the
   `EVAL_WRITING_PAD_DIR`-style relocation so the packaged desktop app still boots.
3. **Coverage check**: confirm the union covers every `dialogue_content_hash` in
   `evaluations.db` (orphan DB rows = still-missing logs to chase; orphan logs =
   harmless).
4. **Verify** `provenance:validate` + `paper:provable-discourse` (full) report 0
   `log_file_missing` from a *fresh* worktree — the acceptance test the prior pass
   skipped.
5. *(Related, splittable)* **De-bloat** the private repo: stop git-tracking logs
   (gitignore + filesystem archive) or migrate to git-LFS — a heavier
   history-rewrite sub-task that can be its own item.

Net: the load-bearing fix is the **default write path** (step 2), not a one-time
copy; the prior "just point `EVAL_LOGS_DIR` and remove the stopgap" framing
under-scoped it.
