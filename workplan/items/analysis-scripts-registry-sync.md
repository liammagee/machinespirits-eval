---
id: analysis-scripts-registry-sync
title: "Mechanically sync ANALYSIS-SCRIPTS.md with the real script set"
status: triaged
type: maintenance
priority: P2
owner: codex
source: manual
created: 2026-08-27
updated: 2026-08-27
verification: A sync script with check and write modes reconciles
  scripts/ANALYSIS-SCRIPTS.md against the analyze-* files on disk; the check
  mode runs as a test or CI step and fails on drift; the 80 missing scripts
  are registered with a one-line purpose and flags each; entries are grouped
  by study family so the doc stays navigable.
claim_status: methods
links:
  notes:
    - scripts/ANALYSIS-SCRIPTS.md
    - scripts/sync-hermetic-test-manifest.js
tags:
  - docs
  - analysis
  - codex-sol
  - effort-xhigh
---

The registry opens with "All post-hoc analysis scripts in scripts/" and lists
23 of 103 analyze-* files — 80 missing, and nothing enforces the claim. The
project rule says to read this file rather than guess a script name, so the
gap sends agents guessing.

The hermetic test manifest solved the same problem the right way: a sync
script with check and write modes, run in CI. Copy that pattern. The missing
set clusters into study families (the A-series, the D-series, figure
falsifier, tutor-stub resistance, adaptive state, recognition), and several
have tests from which the argument strings are recoverable, so registration
is tractable rather than 80 unrelated archaeology digs. Frozen pre-registered
scripts get registered as frozen, not edited.

Suggested worker: Codex Sol at Extra High reasoning effort.
