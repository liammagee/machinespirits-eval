---
id: harden-consolidated-labelling-integrity
title: Harden consolidated labelling saves, identities, and corpus provenance
status: active
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
branch: codex/harden-consolidated-labelling-integrity
links:
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
