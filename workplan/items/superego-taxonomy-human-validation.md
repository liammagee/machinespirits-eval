---
id: superego-taxonomy-human-validation
title: "Validate the superego taxonomy with independent expert coding"
status: blocked
type: research
priority: P2
owner: human
source: paper
created: 2026-07-22
updated: 2026-08-30
verification: "Two independent expert coders complete the frozen 40-item packet; agreement and Cohen's kappa are reported by category and overall; kappa >= 0.60 supports the taxonomy, while lower agreement is preserved as an explicit instability result rather than tuned away."
claim_status: planned
blocked_by: "Two independent expert coders for the frozen 40-item validation packet"
links:
  paper: §5.3, §8.2, §9
  notes:
    - docs/research/human-coding-codebook.md
  scripts:
    - scripts/human-validation-sample.js
    - scripts/human-validation-analyze.js
  paths:
    - /human-coding-admin
tags:
  - superego-taxonomy
  - human-validation
  - inter-rater-reliability
milestone: human-pilot-prep
---

Paper 2.0's nearest empirical validation gap is no longer a missing simulation
run. The taxonomy has a frozen, stratified 40-item packet and an administration
surface; it needs independent human judgments before the proposed categories
can be treated as more than model-graded structure.

This card owns only the human coding and agreement analysis. Changes to the
codebook, packet composition, or decision threshold after coding begins require
an explicit amendment. Recruitment, IRB work, and human-learner outcomes remain
on the separate A1 pilot card.

2026-08-30 Codex: Blocker refresh confirmed that the frozen 40-item sample and
answer key are present, but no human rater CSVs exist. Agreement analysis
therefore cannot run as human validation. The external dependency remains live
and still requires two independent expert coders.

2026-08-30 Codex: Reclassified from P1 to P2 after the human-work review. The
coding remains necessary publication hygiene while Paper 2.0 retains the
ten-category process taxonomy, but agreement on those labels would validate a
descriptive classifier—not show that a superego improves adaptation or learning.
