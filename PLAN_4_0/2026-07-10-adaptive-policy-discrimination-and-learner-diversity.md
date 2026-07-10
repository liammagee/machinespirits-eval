# Adaptive Policy Discrimination Requires Learner-Contingent Headroom

Date: 2026-07-10
Status: interpretation and next-experiment note. Local synthetic evidence only; no human-learning claim.

## Question

Why did the completed frontier comparison show reliable register variation but no adaptive-policy advantage, and will the more diverse learner profiles make policy differences easier to detect?

## Why the frontier comparison was flat

The completed frontier matrix at
`.tutor-stub-auto-eval/frontier-continuous-sentinel-n3-2026-07-09T22-10-38Z/`
contained 84 trajectories: four learner profiles, seven policies, and three
runs per cell. Every trajectory completed successfully, grounded the secret,
and reached full evidence coverage.

That creates an endpoint ceiling. Once reliability, closure, coverage, and
leak discipline are tied, the outcome score is driven mainly by turn
efficiency. `bland` therefore ranked first not because it demonstrated better
teaching, but because it reached the common endpoint in fewer turns:

| Policy | Mean outcome | Mean turns |
| --- | ---: | ---: |
| `bland` | 0.967 | 23.750 |
| `trajectory` | 0.965 | 25.000 |
| `continuous_dynamical_system` | 0.963 | 26.333 |
| `empirical_dynamical_system` | 0.963 | 26.167 |
| `field` | 0.963 | 27.333 |
| `dynamical_system` | 0.961 | 28.167 |
| `continuous_empirical_dynamical_system` | 0.960 | 28.584 |

Three design properties explain the convergence:

1. The policies primarily alter register and interactional stance. They share
   the same proof DAG, evidence schedule, human-discourse scaffold, and tutor
   generation machinery. The intervention is therefore narrower than the
   common pedagogical substrate.
2. Until-grounded stopping lets slower policies catch up. A policy can take
   substantially longer and still receive the same closure and coverage
   credit.
3. The safe palette does not reliably trigger pressure-sensitive behavior.
   In particular, `affective_resistant` is informative only when the design
   includes a public pressure event and then measures whether the tutor repairs
   it. Without such an event, the profile's defining behavior can remain
   latent.

The frontier comparison also predates the current profile design: its four
final summaries used one learner-profile contract v1 and three v2 contracts.
It is not a test of the new v3 population. Its model provenance is mixed as
well: although all four summaries requested `codex.gpt-5.5`, authoritative
`run_start` metadata records 52 trajectories on `codex.gpt-5.5` and 32 on
`codex.gpt-5.6-terra`. The learner-profile comparison is therefore confounded
with a mid-run model change and should be treated as descriptive only.

## What more diverse profiles can add

More diverse profiles should improve policy discrimination, but only when
diversity means a persistent, observable failure operator rather than a
different personality description. The v3 contracts move in this direction:

- `proof_skipper` repeatedly omits the warrant between evidence and claim;
- `false_memory` publicly imports or distorts evidence and repairs only after
  an explicit record contrast;
- `affective_resistant` withholds evidential progress under interactional
  pressure and re-engages after face repair;
- each profile now defines onset, recurrence, forbidden normalization, repair
  behavior, trace targets, and an observability gate.

The small v3 onset/persistence smoke provides preliminary support. Across
`false_memory` and `proof_skipper`, both profiles met their onset and recurrence
checks. Their pooled cosine similarity was 0.864, narrowly missing the target
of less than 0.85, while mean policy-conditioned similarity was 0.773. This is
an important distinction: learner discrimination is interactional. Some tutor
policies reveal the difference between learners, while others make their
traces converge. The smoke is only n=1 per profile-policy cell and is a
manipulation check, not an outcome result.

The separate headroom contrast already shows the shape we should expect from a
successful discrimination design: the hostile `negative` register helped some
cognitive-failure profiles but collapsed on `affective_resistant`. That
cross-over establishes that register choice can have learner-dependent
consequences. It does not yet establish that the adaptive selector chooses the
right register better than a strong fixed control.

## What would count as adaptive success

The target is not necessarily one adaptive policy beating `bland` for every
learner. A credible adaptive result should contain profile-policy interactions:

- evidence re-grounding should repair `false_memory` more effectively;
- warrant-focused precision should repair `proof_skipper` more effectively;
- low-pressure, agency-preserving moves should restore progress for
  `affective_resistant` after a controlled pressure event;
- the selector should choose those responses contingently, and the resulting
  state transitions should have positive outcome-linked reward.

If rankings do not cross by learner type, either the learner profiles are not
behaviorally distinct, the policy action space is too weak, or the learner
state-to-register mapping is not using the distinction productively.

## Next discriminating matrix

The next comparison should use the v3 contracts and retain `bland` as the fixed
control, but change both exposure and measurement:

1. Report fixed-horizon progress at learner turns 8, 12, and 16 as well as
   eventual closure.
2. Measure time to grounding and area under the mastery, risk, and evidence
   coverage trajectories.
3. Include predeclared profile-specific triggers, especially a pressure arm
   for `affective_resistant`, and score recovery after the trigger.
4. Estimate policy by learner-profile interactions rather than relying only on
   a global policy ranking.
5. Retain contingency and transition evidence: register/state contingency,
   sufficient state-action observations, and positive mean reward proxy.
6. Use at least n=3 per cell for screening and n=5 or more for a serious
   comparison; learner diversity does not substitute for replication.
7. Interleave cells deterministically so provider timing or quota windows do
   not become policy or profile confounds.

## Interpretation rule

More diverse learners create the possibility of detecting useful adaptation;
they do not manufacture adaptive competence. The decisive evidence remains
whether the policy detects a learner-relevant state, selects a fitting action,
and improves an outcome channel that it does not directly control. If the v3
profiles create genuine headroom and `bland` still matches or exceeds every
adaptive policy, the register machinery is producing stylistic variation
without enough pedagogical leverage.

## Related notes

- `PLAN_4_0/2026-07-10-phase6-gate-explainer-and-headroom-result.md`
- `PLAN_4_0/2026-07-10-preconscious-adaptation-review.md`
- `PLAN_4_0/PHASE_6_EVIDENCE_GATE_PLAN.md`
