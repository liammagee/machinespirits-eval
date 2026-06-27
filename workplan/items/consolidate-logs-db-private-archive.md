---
id: consolidate-logs-db-private-archive
title: Consolidate dialogue logs + DB into one canonical archive
status: triaged
type: infra
priority: P2
owner: unassigned
source: manual
created: 2026-06-22
updated: 2026-06-27
verification: From a freshly-cloned worktree with only the canonical EVAL_LOGS_DIR
  (or the new default) set, `npm run provenance:validate` finds the logs and
  `paper:provable-discourse` (full) reports 0 `log_file_missing`; the union of
  archived `tutor-dialogues/*.json` covers every `dialogue_content_hash` in
  `evaluations.db`.
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
