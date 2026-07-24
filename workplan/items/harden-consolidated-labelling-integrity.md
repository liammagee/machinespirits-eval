---
id: harden-consolidated-labelling-integrity
title: Harden consolidated labelling saves, identities, and corpus provenance
status: done
type: infra
priority: P1
owner: codex
source: review
created: 2026-07-22
updated: 2026-07-24
verification: Navigation and dataset switches cannot lose queued or in-flight
  edits; coder artifacts cannot collide; impasse labels are bound to immutable
  corpus hashes; browser, route, store, and CLI regressions pass.
claim_status: planned
depends_on: []
branch: codex/harden-labelling-corpus-provenance
links:
  prs:
    - https://github.com/liammagee/machinespirits-eval/pull/180
    - https://github.com/liammagee/machinespirits-eval/pull/181
    - https://github.com/liammagee/machinespirits-eval/pull/186
  items:
    - consolidated-labelling-game-harness
    - impasse-corpus-phase1
tags:
  - human-labelling
  - data-integrity
  - impasse-program
  - evaluation-infrastructure
milestone: impasse-program-v1
---

The consolidated labelling harness is functional, but the review found several
ways judgments can be lost or attached to the wrong evidence. The browser's
debounced save reads the current selection after navigation, dataset switching
can discard a pending timer, and overlapping saves can drop later edits.
Separately, the two stores canonicalize coder IDs differently and lossily, so
distinct human identifiers can overwrite the same artifact. Impasse sidecars
are joined only by episode ID and carry no source or content hash.

Acceptance:

- Queue immutable save payloads and flush them before item navigation or
  dataset switches; ignore stale responses without discarding newer edits.
- Use one collision-free coder-ID contract across both stores and provide an
  explicit migration/check for existing rater files.
- Validate unique episode IDs and persist corpus plus per-item content hashes;
  refuse mismatched sidecars unless an explicit migration succeeds.
- Reject overlong notes rather than silently truncating them, and set matching
  client limits.
- Make standalone CLI EOF and setup failures exit deterministically, with spawn
  tests covering both paths.

Log:

- 2026-07-24 — Activated from merged `origin/main` after PR #177 made the labelling save-state coverage group first-class. Initial implementation slice targets immutable browser save payloads, ordered save flushing across navigation/dataset changes, and matching browser regressions before changing artifact identity or corpus formats.
- 2026-07-24 — Completed the first browser-integrity slice: saves now use immutable operation snapshots, coalesce pending edits, serialize in-flight requests, and flush before item, coder, comparison, or dataset transitions. Six queue regressions and the 19-test labelling risk group pass (77.78% lines, 68.14% branches, 83.56% functions); live browser QA loaded and switched to the 29-item impasse packet with no console warnings or errors.
- 2026-07-24 — Opened PR #180 for the browser save-integrity tranche. The card remains active for the coder-ID, corpus-provenance, note-limit, and CLI failure-handling acceptance criteria.
- 2026-07-24 — PR #180 merged. Continued in `codex/harden-labelling-coder-identities` with a shared reversible coder-ID artifact token and an explicit fail-closed legacy check/migration path for both taxonomy CSVs and impasse JSON sidecars.
- 2026-07-24 — Completed the coder-identity tranche locally. Exact normalized IDs now round-trip through unambiguous `cid~` artifact tokens; both stores reject legacy/current collisions and impasse sidecars with mismatched embedded identity. `npm run labelling-game:coder-artifacts -- --check` reports legacy/current/collision state, while `--apply` requires a mapping or explicit inferred-ID confirmation and preflights all files before mutation. The 27-test labelling risk group passes at 79.57% lines, 70.96% branches, and 85.96% functions.
- 2026-07-24 — Opened PR #181 for the coder-identity tranche; the card remains active for corpus provenance, note limits, and deterministic CLI failure handling.
- 2026-07-24 — PR #181 merged. Continued the remaining acceptance criteria in `codex/harden-labelling-corpus-provenance`: immutable corpus/item provenance first, followed by note-limit and standalone CLI failure handling.
- 2026-07-24 — Completed the remaining integrity tranche locally. Impasse sidecars now carry canonical corpus and per-item SHA-256 provenance, fail closed on missing or mismatched bindings, and have an explicit preflighted `--accept-current-corpus` migration. Both datasets expose and enforce the same 5,000-character note limit, while the standalone CLI exits cleanly on EOF and reports setup failures without stacks. The 36-test labelling risk group passes at 81.46% lines, 74.59% branches, and 88.21% functions; the full 6,576-test root phase passes (one skipped), and all 133 tutor-core tests pass. Ready for review.
- 2026-07-24 — Fast-forwarded to `origin/main` at `8cd11351` and registered the new provenance suite in the explicit hermetic manifest introduced by PR #182. Post-sync verification passes: 47 focused integration/contract tests; the 36-test labelling risk group at 81.66% lines, 74.59% branches, and 88.21% functions; the complete 451-file root manifest with 6,580/6,581 passing and one declared skip; plus lint, formatting, and the 161-item workplan check. The unchanged tutor-core phase remains green at 133/133 from the pre-sync full run.
- 2026-07-24 — Opened PR #186 for the final corpus-provenance, note-limit, and deterministic CLI failure-handling tranche.
- 2026-07-24 — Closed after PR #186 merged to `main`; the merged branch and
  worktree were removed after ancestry and clean-worktree checks.
