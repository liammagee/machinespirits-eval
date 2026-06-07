# A18.27 Diagonal-Socket Local Failure Diagnosis

Date: 2026-06-06

Status: zero-API diagnosis complete.

## Question

Should `diagonal_socket_priority` be repaired and rerun, or abandoned as a
post-v2 fresh-family candidate?

## Diagnosis

The A18.26 failure is not mainly a panel-rule problem and not mainly a local
checker problem. It is a family-design problem.

The selected rule was intended to be:

> same-position tick duplicates; opposite/paired offset completes.

But the public task naturally invites a simpler rule:

> the token whose tick is in the same position as the final badge wins.

That simpler same-position rule is a strong ordinary public inference. In the
red sibling, it aligns with color and nearness on the wrong target, so both arms
drifted toward it. The policy-memory arm did not make the old same-position
check visibly fail before asking the learner to use the inverse relation.

## Evidence From A18.26

`socket_holdout_red_upper`:

- S0: survivor but wrong target (`right reku`).
- S1: survivor but wrong target (`right reku`), with no selected-repair marker
  hit.
- policy contrast: `not_policy_distinct`, distinctiveness `0.111`.
- policy correctness: `no_correct_policy_application`.

Representative S1 continuation:

> "The stamp's tick is below-right too--so the right reku's tick matches the stamp's position."

This shows the failure mode directly: the model made "matching position" the
decisive public relation. The intended inverse/completion rule was not
publicly forced.

`socket_holdout_blue_lower`:

- S0: `revise_again`.
- S1: survivor and selected-policy correct.
- policy contrast: `policy_distinct`, distinctiveness `0.166`.

The blue sibling shows the repair can work once, but not reliably enough for a
family-level gate.

## Decision

Do not panel `diagonal_socket_priority`.

Do not treat an in-place patch as a fresh v2 replication. A repaired diagonal
family would be post-failure tuning and should be labelled as such.

The better next move is a new post-v2 family whose selected relation is not an
inverse of an obvious public match relation. The selected policy should make a
specific public check fail by counterexample, but it should not require the
critic/model to reverse an ordinary same-position reading without first seeing
why same-position is invalid.

## Design Constraint For The Next Family

Avoid selected repairs where the intended target is the "opposite" of a salient
matching feature unless the public transcript first makes the matching rule
misclassify a visible case.

Prefer a relation with:

- a non-inverse selected repair;
- multiple plausible public repairs;
- public vocabulary that does not name the selected policy;
- a selected-policy target that does not fight two or more high-salience public
  cues at once;
- a public counterexample the tutor can introduce after learner resistance.
