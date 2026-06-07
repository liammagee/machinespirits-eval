# A18.33/A18.34 Documentation Audit

Date: 2026-06-06

Status: sufficient after this audit. No A18.35 files were touched.

## Scope

This audit covers:

- A18.33 local-only run for the A18.32 cue-pass family.
- A18.34 cue-risk reporter hardening against selector-like self-solving.

It does not evaluate or document A18.35, which is being run separately.

## Evidence Checklist

Required A18.33 evidence:

- Family and source config named: `fold_anchor_priority` in
  `config/recursive-tutor-learning/a18.32-fresh-family-cue-pass.yaml`.
- Chain named: `exports/recursive-tutor-learning/a18.32-fresh-family-local`.
- Attempt-1 result captured: `survivor: 1`.
- Policy fill result captured: `filled: 1`.
- Both held-out local report paths recorded:
  `a18.33-fold-holdout-blue-local/a18.33-cue-pass-family-local-report.json`
  and `a18.33-fold-holdout-gold-local/a18.33-cue-pass-family-local-report.json`.
- Both local verdicts captured: `no_local_headroom`, effective
  `no_local_survivor`.
- Policy contrast captured: blue `not_policy_distinct`, gold
  `policy_distinct`.
- Policy correctness captured: both `no_correct_policy_application`.
- No-panel stop captured: no panel because S0 also solved locally.
- Mechanistic failure class named:
  `selector_like_public_governance_self_solving`.

Required A18.34 evidence:

- Reporter change named: `scripts/report-recursive-tutor-cue-map-risk.js`.
- Sidecar change named:
  `config/recursive-tutor-learning/a18-post-v2-cue-maps.yaml`.
- Test named: `tests/recursiveTutorCueMapRisk.test.js`.
- Trigger rule recorded: selector/governance-like selected relation,
  `adjacent_marker` geometry, no constructed device, and no
  `prior_panel_pass` empirical status.
- Positive controls preserved: `selector_rail_priority` and
  `bead_predecessor_priority` still pass.
- Negative controls preserved: `diagonal_socket_priority` and
  `thread_source_priority` still fail.
- New negative captured: `fold_anchor_priority` fails with
  `selector_like_public_governance_self_solving`.
- Validation command recorded:
  `node --test tests/recursiveTutorCueMapRisk.test.js`.

## Sufficiency Judgment

A18.33 is sufficiently documented as a local negative: it records the run
family, the two held-out siblings, the S0/S1 outcomes, the report artifact
paths, and the reason no panel should be run. The decisive point is no local
headroom, not just narrow correctness markers.

A18.34 is sufficiently documented as a reporter-hardening step: it records the
new rule, the files changed, the calibration against prior positives and known
negatives, and the test command.

The claim boundary is also explicit: A18.33/A18.34 do not establish reliable
adaptation. They establish a higher-order apparatus repair: a family that passed
the old cue-map preflight, then failed local S0/S1 screening, is now rejected by
the zero-API preflight.

## Residual Gap

The detailed report JSON files live under `exports/` and are not expected to be
durable git artifacts. The durable record is therefore the pair of notes plus
this audit. If those export artifacts are cleaned later, the repo still retains
the family, verdict, failure class, claim boundary, and next preflight
constraint.
