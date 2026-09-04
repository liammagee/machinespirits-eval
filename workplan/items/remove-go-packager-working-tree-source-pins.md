---
id: remove-go-packager-working-tree-source-pins
title: Remove working-tree source pins from the historical GO packager
status: done
type: infra
priority: P1
owner: codex
branch: codex/remove-go-packager-working-tree-pins
source: review
created: 2026-09-03
updated: 2026-09-03
verification: "Historical GO packets still materialize byte-identically from their recorded launch commits, but ordinary uncommitted code or dependency changes no longer make packaging fail; the affected packager tests and full hermetic suite pass without changing any sealed request artifact."
claim_status: planned
links:
  items:
    - shared-paid-study-launch-contract
  notes:
    - docs/paid-study-authorization-policy.md
    - scripts/package-tutor-stub-resistant-profile-study-go-request.js
  prs:
    - https://github.com/liammagee/machinespirits-eval/pull/991
tags:
  - paid-study
  - provenance
  - testing
  - maintenance
---

The retired historical GO-request packager reads each source-closure blob from
its recorded launch commit, then also requires the current working copy of that
file to have the same digest. A routine `package.json` edit therefore makes 23
full-suite assertions fail before they can replay immutable historical packet
construction. This is a live form of the source-pinning behavior banned by the
current paid-study authorization policy.

Keep the historical packet bytes and launch-commit provenance intact. Remove
only the comparison against the current checkout: materialization must use the
recorded Git blob, independent of later code edits. Do not alter, repin, or
revalidate any consumed request artifact, and do not use this legacy packager
for a new study.

## Audit note

2026-09-03 — A minimal removal of the working-copy digest check made the six
original failures progress, but exposed eleven byte-identity failures across
three historical packager suites. Their expected request builders also compute
source-closure digests from the live checkout. The exploratory source change
was reverted; no request or sealed artifact changed. A safe repair must isolate
historical launch-commit replay fixtures from current-source request builders,
not merely remove one guard.

## Implementation note

2026-09-03 — The packager now materializes protected files only from the
recorded launch commit and never compares them with the working tree. The three
affected suites explicitly separate current-source validator fixtures from
launch-commit replay fixtures; all 24 focused packager tests pass. No sealed
request artifact changed.

2026-09-03 — PR #991 merged with every required hosted check green. The clean
post-implementation hermetic run passed 10,295 root tests and 145 tutor-core
tests with zero failures; 27 registered skips remained unchanged.
