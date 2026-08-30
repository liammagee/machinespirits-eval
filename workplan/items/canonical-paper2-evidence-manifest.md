---
id: canonical-paper2-evidence-manifest
title: Make canonical Paper 2.0—not the legacy paper—the evidence-manifest authority
status: done
type: infra
priority: P1
owner: codex
source: review
created: 2026-08-28
updated: 2026-08-28
verification: The default paper-manifest command validates
  docs/research/paper-full-2.0.md against a Paper 2.0-specific evidence
  manifest; every empirical claim family is classified as computationally
  reproducible, artifact-reproducible, or disclosed historical-only; legacy
  paper validation requires an explicit target; fixture tests prove a missing or
  misdirected canonical claim fails rather than producing a green summary.
claim_status: methods
links:
  code:
    - scripts/validate-paper-manifest.js
    - config/paper-manifest.json
    - config/paper2-evidence-manifest.v1.json
    - services/paper2EvidenceManifestValidator.js
  paper: docs/research/paper-full-2.0.md
  items:
    - refactor-paper-manifest-fixtures
    - paper2-priority1-closeout
    - edra-m3-second-mechanism-lexicon
  prs:
    - https://github.com/liammagee/machinespirits-eval/pull/848
tags:
  - paper-2
  - provenance
  - reproducibility
  - validator
  - supplementary-scan
branch: codex/canonical-paper2-evidence-manifest
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

## Log

- 2026-08-28 — Implemented the versioned Paper 2.0 evidence manifest and made
  it the default CLI/npm authority. All 29 top-level result sections are
  classified across two database-recomputable, four archived-artifact-
  recomputable, and one historical-only claim family. The legacy 4,312-score
  manifest remains available only through the explicit `legacy` target.
- 2026-08-28 — Added semantic claim fingerprints over selected authority
  content, fail-closed substrate and section coverage checks, and hermetic
  fixtures for target selection, missing artifacts, unclassified evidence,
  historical disclosure, and misdirected canonical claims. No paper text,
  empirical number, database row, or archived result was changed; model and
  provider calls remained zero.
