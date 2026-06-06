# A18.34 Cue-Risk Hardening: Selector-Like Self-Solving

Date: 2026-06-06

Status: zero-API reporter hardening complete.

## Problem

A18.32 passed the cue-map preflight, but A18.33 showed the preflight was still
too permissive. `fold_anchor_priority` used a visible folded nub adjacent to the
selected target. S1 used the intended governance relation, but S0 also read the
same public geometry as a pointer and solved the held-out cases without policy
memory.

Failure class:

`selector_like_public_governance_self_solving`

## Change

`scripts/report-recursive-tutor-cue-map-risk.js` now reads:

- `selected_cue.geometry`
- `empirical_status`
- `requires_constructed_device`

It flags `selector_like_public_governance_self_solving` when:

- `selected_relation_type` is selector/governance-like;
- `selected_cue.geometry` is `adjacent_marker`;
- `requires_constructed_device` is not true;
- `empirical_status` is not `prior_panel_pass`.

This catches fresh marker-adjacent authority cues that are likely to become S0
self-solves.

Touched artifacts:

- `scripts/report-recursive-tutor-cue-map-risk.js`
- `config/recursive-tutor-learning/a18-post-v2-cue-maps.yaml`
- `tests/recursiveTutorCueMapRisk.test.js`
- `TODO.md`

## Calibration

The cue-map sidecar now marks:

- `selector_rail_priority`: `prior_panel_pass`, `adjacent_marker`, still passes.
- `bead_predecessor_priority`: `prior_panel_pass`, `constructed_relation`,
  still passes.
- `diagonal_socket_priority`: `local_negative`, inverse instability, fails.
- `thread_source_priority`: `local_negative`, direct visible source, fails.
- `fold_anchor_priority`: `local_negative`, selector-like adjacent marker,
  now fails.

## Validation

Targeted test:

```bash
node --test tests/recursiveTutorCueMapRisk.test.js
```

Result:

- `5/5` pass

Reporter checks:

- `selector_rail_priority`: `pass`
- `bead_predecessor_priority`: `pass`
- `fold_anchor_priority`: `fail` with
  `selector_like_public_governance_self_solving`

## Interpretation

This is the first post-v2 step that demonstrates actual higher-order learning
in the apparatus: a family that passed the old preflight, then failed locally,
is now rejected by the updated preflight while prior empirical positives remain
accepted.

Claim boundary:

- This does not rescue A18.33 as an adaptation result.
- This does not claim the next constructed-device family will work.
- It only converts one observed local false negative into a reusable zero-API
  preflight constraint.

Next families should either require a constructed public device, use a
non-adjacent selected relation, or be explicitly treated as a replication of a
prior empirical positive rather than a fresh family.
