---
id: shared-paid-study-launch-contract
title: "Use one lightweight launch contract for post-policy paid studies"
status: done
type: infra
priority: P1
owner: codex
source: review
created: 2026-08-28
updated: 2026-08-28
verification: An importable, fixture-tested launch helper enforces the standing
  design-file, clean detached launch-commit, signed GO-note, numeric spend-cap,
  create-once destination, and append-only ledger contract before provider
  initialization; all post-2026-08-22 launchers use it or carry a reviewed
  historical/live-run exemption, while sealed legacy launchers and artifacts
  remain byte-identical.
claim_status: methods
links:
  notes:
    - docs/paid-study-authorization-policy.md
  code:
    - scripts/run-tutor-stub-resistance-action-register-manipulation-validation.js
    - scripts/run-tutor-stub-resistance-warm-nonwarm-confirmation.js
    - scripts/run-tutor-stub-resistant-learner-calibration.js
  items:
    - paid-study-endpoint-runtime-preflight
    - budget-tracker-balance-probe-and-rates
  prs:
    - https://github.com/liammagee/machinespirits-eval/pull/846
tags:
  - paid-study
  - launch
  - provenance
  - spend-ceiling
  - supplementary-scan
branch: codex/shared-paid-study-launch-contract
---

The standing 2026-08-22 policy deliberately reduced paid-study authorization
to three authorities: a merged design, a clean detached launch commit, and one
signed GO note naming the design, commit, and spend cap. Shared runtime code is
supposed to own the remaining reusable rails.

Three recent launchers independently implement nearly identical source and GO
checks today. They already differ in numeric parsing and in extra facts demanded
from the note, so the simple policy is beginning to drift back toward bespoke
per-study ceremony.

Acceptance:

- Extract one dependency-light helper for repository-relative design paths,
  clean detached source verification, committed design bytes, GO-note ancestry,
  exact first-nonblank `GO`, and separator-tolerant numeric spend-cap matching.
- Keep models, endpoints, seeds, thresholds, destinations, and disposition
  rules authoritative in the design file; do not turn the GO note into a second
  registration.
- Pair the helper with the shared budget ledger, create-once destination, and
  append-only run-ledger admission before any provider or child process starts.
- Migrate only post-policy launchers that are not serving a live run. Preserve
  every historical request, certificate, consumed authorization, sealed source,
  and frozen launcher byte-for-byte.
- Add positive and negative zero-call fixtures plus an inventory ratchet that
  requires every new paid launcher to adopt the helper or declare a narrow
  historical exemption.

This is consolidation of the lightweight policy, not a new approval layer.

2026-08-28: Added the shared admission and fail-before-call ledger helper,
fixture tests, and a nine-launcher inventory ratchet. No launcher migration was
eligible: the six post-policy launchers in scope have already served sealed or
live runs, so their bytes remain unchanged under narrow historical/live
exemptions.
