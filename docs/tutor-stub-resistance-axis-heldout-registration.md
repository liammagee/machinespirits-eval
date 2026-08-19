# Resistance-Axis Held-Out Study — Frozen Zero-Call Registration

**Frozen:** 19 August 2026.
**Status:** engineering registration only; no model call or live run is authorized.
**Workplan item:** `resistance-action-register-integration`.

The machine-readable authority is
`config/tutor-stub-resistance-axis-heldout-registration.v1.json`.

## Decision

The study asks only whether two target public behaviours recur specifically in
a fresh cohort:

- `bored`: effort withholding on at least `0.45` of turns, visible by turn 2 in
  every dialogue, while no non-bored profile exceeds `0.20` on that axis;
- `frame_defiant`: frame-legitimacy dispute on at least `0.40` of turns,
  visible by turn 2 in every dialogue, while no non-frame profile exceeds
  `0.20` on that axis.

Both are co-primary and must pass independently. The thresholds retain the
pre-existing recurrence floors while replacing the failed nearest-neighbour
geometry with direct public-axis specificity.

`low_agency`, `skeptical`, and `low_trust_skeptic` remain comparison controls.
Epistemic distrust is reported for `low_trust_skeptic`, but has no threshold
and cannot pass, fail, rescue, or penalize either primary endpoint. The prior
`5/24` trust observation is therefore treated as a useful nested diagnostic,
not as a validated primary learner-profile distinction.

## Held-out design

The matrix remains six profiles by three runs: 18 dialogues, eight turns,
`field` policy, safe register palette, strict DAG, and Luna for tutor, analysis,
and learner roles. The seed is new (`20260819`), and no prior trace is pooled or
rescored. The maximum remains 48 model attempts per dialogue and 864 total.

This is still a simulated-profile measurement study. It cannot establish that
a tutor action works, that sarcasm or irony helps, that a human learns, or that
any result transfers to the cell harness.

## Zero-call proof

The existing preparation command accepts the new registration and prints only
a dry execution plan. The generic paid-study endpoint machinery then passes 18
synthetic dialogues through the registered axis result assembler, completing
the two primary endpoints and the low-trust diagnostic with zero model calls
and zero production writes.

The readiness HOLD reuses the already consumed Luna route result because the
route, model, effort, roles, bridge, and payload class are unchanged. That reuse
makes no new call and carries no study authorization.
