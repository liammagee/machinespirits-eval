---
id: analysis-scripts-registry-sync
title: Mechanically sync ANALYSIS-SCRIPTS.md with the real script set
status: review
type: maintenance
priority: P2
owner: codex
source: manual
created: 2026-08-27
updated: 2026-08-28
verification: A sync script with check and write modes reconciles
  scripts/ANALYSIS-SCRIPTS.md against the analyze-* files on disk; the check
  mode runs as a test or CI step and fails on drift; the 88 missing scripts are
  registered with a one-line purpose and flags each; entries are grouped by
  study family so the doc stays navigable.
claim_status: methods
links:
  prs:
    - 843
  notes:
    - scripts/ANALYSIS-SCRIPTS.md
    - scripts/analysis-scripts-registry.json
    - scripts/sync-analysis-scripts-registry.js
    - scripts/sync-hermetic-test-manifest.js
tags:
  - docs
  - analysis
  - codex-sol
  - effort-xhigh
branch: codex/analysis-scripts-registry-sync
---

The registry opened with "All post-hoc analysis scripts in scripts/" and listed
23 of 111 live analyze-* files — 88 missing, and nothing enforced the claim.
The project rule says to read this file rather than guess a script name, so the
gap sent agents guessing.

The hermetic test manifest solved the same problem the right way: a sync
script with check and write modes, run in CI. Copy that pattern. The missing
set clusters into study families (the A-series, the D-series, figure
falsifier, tutor-stub resistance, adaptive state, recognition), and several
have tests from which the argument strings are recoverable, so registration
is tractable rather than 88 unrelated archaeology digs. Frozen pre-registered
scripts get registered as frozen, not edited.

Suggested worker: Codex Sol at Extra High reasoning effort.

- 2026-08-28 — Recounted current `origin/main`: 111 live `scripts/analyze-*`
  files, 23 previously registered, 88 previously missing. Added a source-backed
  manifest, deterministic `--check`/`--write` sync tool, eight study-family
  sections, one-line purposes, supported flags, and frozen-instrument labels
  without editing any registered analysis script.
- 2026-08-28 — Integrated drift through the existing hermetic root-test
  manifest rather than changing a workflow. Evidence: registry check 111/111;
  focused hermetic tests 2/2; CI classifier/local-runner audit tests 30/30;
  ESLint and Prettier passed; hermetic test-manifest and workplan source checks
  passed; `git diff --check` passed.
- 2026-08-28 — Opened PR #843.
