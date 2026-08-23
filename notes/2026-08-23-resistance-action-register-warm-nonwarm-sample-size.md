# Warm versus non-warm confirmation sample size

Date: 2026-08-23  
Status: prospective design only; no launch authorization

## Decision

Use 196 wholly fresh independent dialogues: 98 assigned to
`warm_shared_invitation` and 98 assigned to `nonwarm_reference`, arranged as
49 sealed balanced blocks of four. Analyze only after all blocks seal. There is
one predeclared two-sided Fisher exact test at alpha 0.05 and no interim outcome
analysis.

The statistical target is 89 determinate outcomes per arm. Exact enumeration
of the two-sided Fisher rejection region gives power 0.9017447309 for recovery
rates of 0.10 and 0.30, an absolute 20-point difference. With 98 allocated per
arm and a semantic-instrument coverage rate of 0.95, the binomial probability
of retaining at least 89 determinate outcomes in an arm is 0.9750829004. If
coverage is independent across arms, the probability that both arms retain at
least 89 is 0.9507866626. If either arm has fewer than 89 determinate outcomes,
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

The 12 calibration dialogues, every incomplete V1–V10 confirmation block, and
the 60-dialogue manipulation validation are excluded from the 196 dialogues
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

Before launch, the binary warm/non-warm instrument must pass a fresh frozen
validation with at least 95% coverage and the predeclared sensitivity,
specificity, and agreement gates: at least 0.90 sensitivity and specificity,
0.90 raw agreement, 0.80 Cohen's kappa, and 0.90 coverage within each target
class. Historical zero-call reaggregation of Sol and Sonnet is only diagnostic:
their exact outcome agreement was 32/36 in V10, and binary warm/non-warm
fidelity agreement was 55/60 in the manipulation validation. Those figures are
below the required new validation standard and cannot authorize launch.

## Operational envelope

Removing GPT-5.5 reduces the conservative per-dialogue plan from 41 to 34 role
calls: five fewer trigger-judge calls, one fewer final recovery-judge call, and
one fewer fidelity-judge call. At three transport reservations per planned
call, the hard confirmation safeguard is 102 reservations per dialogue and
19,992 for 196 dialogues. Against the recorded programme ledger of 5,494, the
programme ceiling would need to be at least 25,486 before confirmation, plus
any separately authorized instrument-validation reservations incurred first.
These counts are operational safeguards only and did not determine the sample
size.
