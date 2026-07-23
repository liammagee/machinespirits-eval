---
id: repair-evaluation-store-roundtrip-integrity
title: Preserve evaluation provenance and attempt counts across store round trips
status: done
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-22
updated: 2026-07-23
verification: Store, reload, rejudge, rubric-version clone, completion, and
  resume round trips preserve generation provenance, factor fields, learner and
  id-director identity, total counts, and every expected attempt.
claim_status: planned
depends_on: []
links:
  code:
    - services/evaluationStore.js
tags:
  - provenance
  - rejudging
  - resume
  - data-integrity
milestone: evaluation-infrastructure
branch: codex/repair-evaluation-store-roundtrip-integrity
---

Several store paths reconstruct only a subset of an evaluation row.
`parseResultRow()` omits fields later read by `storeRejudgment()`, and both
rejudgment and rubric-version cloning can lose raw response, learner identity,
flat factors, id-construction traces, or hashes. Run accounting also ignores a
supplied completed total in one path, while incomplete-test detection treats a
profile/scenario pair as binary and can miss repeated attempts.

Acceptance:

- Centralize the generation/provenance field mapping used by parse, rejudge,
  clone, and export paths.
- Preserve raw response, learner ID, all factors, id-director trace, hashes,
  prompt versions, and generation metadata without inventing new values.
- Honor completed-run totals and make resume completeness account for
  `runsPerConfig` and attempt identity.
- Add database round-trip tests for legacy and current rows, including multiple
  attempts of the same profile/scenario pair.

2026-07-23 Codex: Centralized generation/provenance serialization and parsing
in `services/evaluationStore.js`, then reused it for storage, reload,
rejudgment, rubric-version cloning, manifests, and JSON/CSV exports. Added an
explicit `attempt_index`, attempt-aware resume and checkpoint filenames,
legacy-checkpoint fallback cleanup, successful-generation completion counts,
and corrected resume-status metadata parsing. Regression coverage now pins
current and legacy rows, repeated identical attempts, rejudgments, failed
attempts, clone idempotence, exports, run totals, and checkpoint isolation.

Verification: `npm test` (6,469 pass, 0 fail, 1 skipped); focused evaluation
store/runner/checkpoint/API/prompt suite (239/239 pass); `npm run lint`;
`node scripts/workplan.js check`; and `git diff --check`.
