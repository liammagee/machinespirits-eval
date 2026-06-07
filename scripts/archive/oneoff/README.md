# Archived one-shot scripts

Scripts here were written for a **single execution** — a one-time data backfill, a
score recovery after a bad run, or an ad-hoc debugging probe against a specific
cell/run. They have already done their job. They are kept (rather than deleted)
because they document *how* a column was populated or *how* a defect was diagnosed,
and `git mv` preserved their full history.

**Do not wire these into `npm` scripts, CI, or the post-hoc analysis pipeline.**
The live, repeatable analysis tooling is registered in
[`../../ANALYSIS-SCRIPTS.md`](../../ANALYSIS-SCRIPTS.md). If you find yourself
reaching for one of these, prefer one of two things instead:
copy the relevant logic into a maintained script, or run a fresh one-off — these
are frozen at the schema/run they targeted and may reference columns or run IDs
that have since moved.

| Script | What it did (once) |
|--------|--------------------|
| `backfill-hashes.js` | Backfilled provenance hash columns (`config_hash`, `dialogue_content_hash`, `prompt_content_hash`) on historical rows. |
| `backfill-judge-input-hashes.js` | Backfilled the judge-input hash used by inter-judge reliability matching. |
| `backfill-holistic.sh` | Shell wrapper that drove a one-time holistic-score backfill. |
| `recover-sonnet-scores.js` | Recovered Sonnet judge scores after a run wrote them to the wrong column/shape. |
| `check-dialogue-judgements.js` | Audited dialogue-judgement rows for completeness during a specific recovery. |
| `check-parse-failures.js` | Tallied JSON parse failures in a batch of raw judge responses. |
| `check-run.js` | Quick row-count / status probe for a single run ID. |
| `debug-cell-115-history.js` | Traced cell-115 state-schema history during the P2.2 ablation debugging. |
| `debug-cell-115-prod-path.js` | Verified cell-115's production code path during the same debugging. |
| `inspect-judge-prompt.js` | Dumped the exact assembled judge prompt for one row to diagnose a scoring mismatch. |

Archived 2026-06-07 as part of the repo tidy-up (Phase 4 of
`notes/2026-06-02-repo-consolidation-plan.md`).
