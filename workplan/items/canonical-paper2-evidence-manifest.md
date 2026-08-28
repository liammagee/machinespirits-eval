---
id: canonical-paper2-evidence-manifest
title: "Make canonical Paper 2.0—not the legacy paper—the evidence-manifest authority"
status: triaged
type: infra
priority: P1
owner: unassigned
source: review
created: 2026-08-28
updated: 2026-08-28
verification: The default paper-manifest command validates
  docs/research/paper-full-2.0.md against a Paper 2.0-specific evidence
  manifest; every empirical claim family is classified as computationally
  reproducible, artifact-reproducible, or disclosed historical-only; legacy
  paper validation requires an explicit target; fixture tests prove a missing
  or misdirected canonical claim fails rather than producing a green summary.
claim_status: methods
links:
  code:
    - scripts/validate-paper-manifest.js
    - config/paper-manifest.json
  paper: docs/research/paper-full-2.0.md
  items:
    - refactor-paper-manifest-fixtures
    - paper2-priority1-closeout
    - edra-m3-second-mechanism-lexicon
tags:
  - paper-2
  - provenance
  - reproducibility
  - validator
  - supplementary-scan
---

The current validator and manifest still default to the legacy
`docs/research/paper-full.md`; the manifest itself was generated in February
2026 and names that file. Canonical Paper 2.0 is now v3.0.293 on `main`, while
the pending EDRA amendment is v3.0.295. Consequently a 60-pass default
paper-manifest result does not exercise the paper being edited or its newer
claim families.

The EDRA M3 preservation audit also found that a contemporaneously reported
0.333 lift has neither the original item-gate artifact nor its 27 v4
measurements. That should be a declared evidence class, not a one-off surprise.

Acceptance:

- Preserve the existing manifest as an explicit legacy-paper target or migrate
  it without silently applying its old expected counts to Paper 2.0.
- Make the default CLI and durable npm/CI entry point resolve canonical Paper
  2.0 and its own versioned evidence manifest.
- Inventory Paper 2.0's empirical claim families and classify each as
  database-recomputable, archived-artifact-recomputable, or historical-only
  with a visible disclosure; missing and unclassified substrate fails closed.
- Point source fingerprints at semantic authority modules rather than file
  locations invalidated by pure refactors.
- Add hermetic fixtures for canonical/legacy selection, missing substrate, and
  a disclosed historical-only claim. Do not change empirical numbers or
  reconstruct absent measurements on this card.

This is zero-call integrity work and can proceed while EDRA review is pending.
