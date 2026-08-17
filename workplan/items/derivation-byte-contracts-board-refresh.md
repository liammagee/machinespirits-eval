---
id: derivation-byte-contracts-board-refresh
title: Stop the [skip ci] board refresh from silently breaking the derivation byte contracts
status: triaged
type: infra
priority: P2
owner: claude
source: manual
created: 2026-08-17
updated: 2026-08-17
verification: A change to workplan/board.json on main can no longer make
  tests/poeticsDerivationPresentation.test.js fail without CI seeing it —
  either the refresh automation also refreshes the contracts in the same
  commit, or the rendered pages take their search index from a pinned
  fixture board so repo state cannot move the bytes.
claim_status: methods
links:
  items: guarded-learner-outcome-study
tags:
  - ci
  - poetics
---

The derivation pages embed a search index built from `workplan/board.json`.
The byte-contract test (`tests/poeticsDerivationPresentation.test.js`) pins
the exact bytes and hashes of the rendered pages, so every board change
moves them. After each merge to main, the automation adds a
"workplan: refresh generated views [skip ci]" commit — and because it
skips CI, main goes red without anyone seeing it. The next PR then fails
the risk-coverage job for a change it did not make.

This has now happened twice: e7e04453 (after PR #642) and 5478ee2a
(on PR #646, after PR #645). Both fixes recomputed the six digests
by hand.

Two candidate fixes, pick one:

1. **Refresh in the same commit.** The board-refresh automation also
   recomputes the six digests and writes them into the test file, so the
   contract and the board move together. Small script; the test file
   stays the source of the pinned values.
2. **Pin the input instead of the output.** The test renders against a
   fixture board checked into `tests/fixtures/`, not the live
   `workplan/board.json`. The contract then only breaks when the
   renderer changes, which is what it is for. Needs a seam in the
   renderer to inject the board.

Option 2 is the cleaner end state: the test exists to freeze the
renderer, not the board.
