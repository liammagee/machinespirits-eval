# Warm versus non-warm confirmation sample size

Date: 2026-08-23  
Status: prospective executable design; Smoke B passed; no live dialogue launched

## Decision

Use 200 wholly fresh independent dialogues: 100 assigned to
`warm_shared_invitation` and 100 assigned to `nonwarm_reference`, arranged as
50 sealed balanced blocks of four. Analyze only after all blocks seal. There is
one predeclared two-sided Fisher exact test at alpha 0.05 and no interim outcome
analysis.

The statistical target is 89 determinate outcomes per arm. Exact enumeration
of the two-sided Fisher rejection region gives power 0.9017447309 for recovery
rates of 0.10 and 0.30, an absolute 20-point difference. With 100 allocated per
arm and the observed Sol-Sonnet joint semantic-instrument coverage of 113/120,
the binomial probability of retaining at least 89 determinate outcomes in an
arm is 0.9862998944. If coverage is independent across arms, the probability
that both arms retain at least 89 is 0.9727874816. If either arm has fewer than
89 determinate outcomes,
the confirmatory claim is underpowered and remains indeterminate; units are
never repaired, replaced, or selected on that basis.

## Why these rates

The obsolete 18-per-arm calculation used the calibration-only 1/6 versus 4/6
rates, a 50-point difference. That design has only 0.2046442911 power for a
10% versus 30% contrast. The completed V10 records provide planning evidence,
not a treatment estimate: 0 of 35 determinate delivered-warm cases recovered,
whose two-sided 95% exact upper bound is 0.1000324356. The new design therefore
uses 0.10 as the warm-side planning rate and defines a 20-point absolute change
as the smallest effect worth confirming. The test remains two-sided; these
planning rates do not predeclare the direction of the effect.

The 12 calibration dialogues, every incomplete V1–V10 confirmation block, the
60-dialogue manipulation validation, and both engineering smokes are excluded
from the 200 dialogues
and from the Fisher table. Their only permitted uses here are construct design,
instrument validation, and prospective sample-size planning.

## Measurement and model architecture

GPT-5.5 is removed from the prospective programme. Luna remains the generating
model. Sol and Sonnet are the two independently pinned semantic judges for the
trigger, recovery endpoint, and treatment fidelity. They are blinded to arm
and to each other's answer where the instrument permits. Exact agreement is
required; disagreement, invalid spans, schema failure after bounded
response-free technical recovery, or low confidence is
`measurement_indeterminate`, never nonadherence or nonrecovery.

The V8 fresh held-out semantic validation already passed its registered primary
and fidelity gates across frozen misses, strong negatives, and unseen
paraphrases. The prospective non-warm label is a deterministic coarsening of
its validated `plain` and `neither` labels, not a new semantic construct. Smoke
B then passed the exact V6 two-judge trigger wrapper on four fresh excluded
dialogues. These exact checks are complete and are not repeated unless their
instrument inputs change.

## Operational envelope

Removing GPT-5.5 reduces the conservative per-dialogue plan from 41 to 34 role
calls: five fewer trigger-judge calls, one fewer final recovery-judge call, and
one fewer fidelity-judge call. At three transport reservations per planned
call, the hard confirmation safeguard is 102 reservations per dialogue and
20,400 for 200 dialogues. The two excluded smokes used 100 reservations, so the
recorded programme ledger is 5,594 and the programme ceiling is 25,994. These
counts are operational safeguards only and did not determine the sample size.
Bounded technical recovery is limited to the same missing or failed unit, the
remaining 102-reservation per-dialogue room, the unchanged study ceiling, and
at most three process attempts. Valid outputs and semantic indeterminacy are
never rerun.
