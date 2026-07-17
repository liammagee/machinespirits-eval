# V33 model-free audit reconciliation

Date: 2026-07-17  
Status: audit-recognition correction; not generation improvement  
Model calls: 0

V33 remains failed historical development evidence. Its consumed seed, saved
candidate, original audit, and 0/2 qualitative causal-fidelity result are not
rewritten by this re-audit.

## Root cause

The two reports were not evaluating the same owned text:

- the whole-response configuration audit could find the phrase `not yet` in
  HANDOFF and report the evidentiary-boundary tactic visible;
- the strict joint audit correctly restricted tactic ownership to
  `performance_entry + performance_response`, but its older recognizer did not
  understand a proposition being *weakened* as an evidentiary boundary.

This combined inconsistent span selection with an owner-local recognition
gap. It was not evidence that the model had failed to state any boundary.

## Canonical result

Both audits now consume one canonical realization result with:

- predicate: `selected_actorial_performance_visible`;
- owner: `performance`;
- span ids: `performance_entry`, `performance_response`;
- owned-text SHA-256:
  `007776eedc006bfcaee032eb4578ca53ef0f7908f226bfa7b1d2b3107dbd7ca9`;
- recognized construction: `bounded_claim_revision`.

The saved V33 performance therefore satisfies the declared owner-local
evidentiary-boundary requirement. The historical failure cluster
`jointPerformanceAudit:axis_not_realized_in_owner:actorial_performance` is an
audit-recognition false negative when re-evaluated under the canonical audit.

## Independent generation failure retained

The saved learner-writable line remains invalid:

> The dark chargers did not prevent Tallow Street browning out at 18:40.

The public counterfactual is an inactive candidate alongside a persisting
outcome. It licenses a negative *production* relation (the chargers did not
cause or explain the brownout), not a negative *prevention* relation. The
model-free requested-entry recognizer now reports:

- requested family: `prevention`;
- public support: `inactive_candidate_with_persisting_outcome`;
- causal relation supported: `false`.

Thus the coherent interpretation is: V33 did enact the selected boundary, but
its learner-facing minutes sentence reversed the causal role. The first change
is audit recognition; the second remains a genuine generation defect and the
independent qualitative failure still governs V33's failed status.

## Regression coverage

The canonical fixture includes the exact V33 candidate, a clear positive, a
label-only negative, a boundary placed only in HANDOFF, a declarative boundary
without advocate enactment, and a properly enacted advocate boundary. It also
keeps the earlier V27 `did not prevent` candidate as a historical generation
failure instead of silently preserving the old false-positive recognition.
