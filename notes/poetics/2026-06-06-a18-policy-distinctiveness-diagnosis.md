# A18.18 Policy-Distinctiveness Diagnosis

Date: 2026-06-06

Status: zero-API diagnosis complete.

## Question

A18.17 failed the frozen local candidate gate because
`hinge_shadow_priority` produced:

- S0 = `revise_again`
- S1 = `survivor`
- policy correctness = `policy_memory_correctness_advantage`
- policy contrast = `not_policy_distinct`

A18.18 asks whether this means the A18.16 protocol should be changed, or whether
the family should simply be rejected under protocol v1.

## Evidence

Report:

`exports/recursive-tutor-learning/a18.17-fresh-family-local/hinge_shadow_priority/a18.17-hinge-holdout-teal-local/a18.17-fresh-family-frozen-protocol-report.json`

Policy-contrast gate:

- S0 overlap = `0.545`
- S1 overlap = `0.545`
- distinctiveness = `0`
- required distinctiveness = `0.12`
- S0 strategy names: `name_the_disagreement`, `scope_test`
- S1 strategy names: `pose_counterexample`

The arms are not identical, and S1 is better under the local checker. But S0
still reconstructs enough of the same public hinge/fold relation that the policy
signature does not separate them:

- S0: uses a "hinge-contact test" and asks which sima can meet the hinge smudge
  and badge nick.
- S1: uses the grey mark on the hinge edge as a fold mark and asks which pocket
  the hinge smudge would press across from.

That is a real qualitative difference, but not enough for the frozen
policy-distinctiveness gate. The no-policy arm is already inside the same repair
neighborhood.

## Diagnosis

Do not revise A18.16 protocol v1 in response to this family. The failure is
primarily family-side, not protocol-side:

- the public setup lexicalizes the selected relation too strongly (`hinge`,
  `smudge`, `folding card`, `pocket`);
- S0 can generate a hinge-contact repair without the policy memory;
- S1 applies the registered target more cleanly, but the selected-policy
  signature is not different enough from S0's locally improvised route.

The frozen protocol is therefore doing useful work. It blocks a case that would
look like a success under raw local survival plus policy correctness alone.

## Decision

Keep A18.16 protocol v1 for the next run. Do not introduce a post-hoc v2
signature rule yet.

The next family should be designed so the selected repair is less recoverable
from public vocabulary alone. Concretely:

- make the selected repair depend on a relational transformation, not a named
  object already foregrounded in the public setup;
- keep public visible features multiple and plausible, but avoid naming the
  selected repair's governing relation in ordinary language;
- reserve the policy memory's `preferred_move` and `material_constraint` for a
  sharper move name than the stage itself suggests;
- continue requiring S0 failure or non-correctness plus `policy_distinct`.

## Next Move

A18.19 should author another fresh family under protocol v1, with a pre-static
check for lexical self-solving risk. No generation until the fixture passes the
existing frozen validator and a manual lexical-risk review.
